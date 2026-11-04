"""DeepSeek chat completions transport shared by the editor AI services."""

from collections.abc import Callable, Iterator
import json
import urllib.request

from .configuration.deepseek_settings import DeepSeekSettings


def build_request(
    settings: DeepSeekSettings,
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    thinking: bool = False,
    stream: bool | None = None,
) -> urllib.request.Request:
    """JSON completions omit stream and Accept. Text chat sends an explicit stream flag."""
    endpoint = settings.base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint += "/chat/completions"
    headers = {"Authorization": "Bearer " + settings.api_key, "Content-Type": "application/json"}
    body: dict[str, object] = {"model": settings.model, "temperature": temperature, "max_tokens": max_tokens}
    if stream is None:
        body["response_format"] = {"type": "json_object"}
    body["thinking"] = {"type": "enabled" if thinking else "disabled"}
    if stream is not None:
        body["stream"] = stream
        headers["Accept"] = "text/event-stream" if stream else "application/json"
    body["messages"] = messages
    return urllib.request.Request(
        endpoint, data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers=headers, method="POST",
    )


def _first_choice(data: object) -> dict:
    choices = data.get("choices") if isinstance(data, dict) else None
    if isinstance(choices, list) and choices and isinstance(choices[0], dict):
        return choices[0]
    return {}


def _message_text(choice: dict) -> str:
    message = choice.get("message")
    content = message.get("content") if isinstance(message, dict) else None
    return content.strip() if isinstance(content, str) else ""


def _read_message(response, empty_error: str) -> str:
    data = json.loads(response.read().decode("utf-8"))
    content = _message_text(_first_choice(data))
    if not content:
        raise ValueError(empty_error)
    return content


def complete_json(
    settings: DeepSeekSettings,
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int,
    timeout: float,
    thinking: bool = False,
    empty_error: str = "DeepSeek 返回了空内容",
) -> str:
    request = build_request(
        settings, messages, temperature=temperature, max_tokens=max_tokens, thinking=thinking,
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return _read_message(response, empty_error)


def stream_text(
    request: urllib.request.Request, *, timeout: float, should_stop: Callable[[], bool],
) -> Iterator[str]:
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if "text/event-stream" not in str(response.headers.get("Content-Type") or "").lower():
            yield _read_message(response, "DeepSeek 返回了空内容")
            return
        for raw_line in response:
            if should_stop():
                return
            line = raw_line.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                return
            try:
                choice = _first_choice(json.loads(payload))
            except json.JSONDecodeError:
                continue
            delta = choice.get("delta")
            content = delta.get("content") if isinstance(delta, dict) else None
            yield content if isinstance(content, str) else _message_text(choice)
