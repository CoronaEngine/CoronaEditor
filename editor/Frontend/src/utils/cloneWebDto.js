import { toRaw } from 'vue';

// Vue proxies may occur inside an otherwise plain DTO wrapper. Remove them
// recursively while preserving cycles and structured-clone native values.
export function cloneWebDto(value) {
  const seen = new WeakMap();
  const unwrap = input => {
    const raw = toRaw(input);
    if (!raw || typeof raw !== 'object') return raw;
    if (seen.has(raw)) return seen.get(raw);
    if (!Array.isArray(raw) && Object.getPrototypeOf(raw) !== Object.prototype) return raw;
    const result = Array.isArray(raw) ? [] : {};
    seen.set(raw, result);
    for (const key of Object.keys(raw)) {
      Object.defineProperty(result, key, { value: unwrap(raw[key]), enumerable: true, writable: true, configurable: true });
    }
    return result;
  };
  return globalThis.structuredClone(unwrap(value));
}
