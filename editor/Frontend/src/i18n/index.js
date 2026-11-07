import { createI18n } from 'vue-i18n';
import { getWebMessages } from '../api/webMessages.js';
import zhCN from './messages/zh-CN.js';
import enUS from './messages/en-US.js';

export const LOCALE_STORAGE_KEY = 'corona.ui.locale';
export const LOCALE_CHANGED_EVENT = 'corona-ui-locale-changed';
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'];
export const DEFAULT_LOCALE = 'zh-CN';

const messages = {
  'zh-CN': zhCN,
  'en-US': enUS,
};
let localeSync;

function normalizeLocale(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace('_', '-').toLowerCase();
  if (normalized === 'zh' || normalized === 'zh-cn' || normalized === 'zh-hans') return 'zh-CN';
  if (normalized === 'en' || normalized === 'en-us' || normalized === 'en-gb') return 'en-US';
  return '';
}

export function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale);
}

export function resolveInitialLocale() {
  const stored = normalizeLocale(globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY));
  if (stored) return stored;

  const preferred = [
    ...(Array.isArray(globalThis.navigator?.languages) ? globalThis.navigator.languages : []),
    globalThis.navigator?.language,
  ];
  for (const locale of preferred) {
    const normalized = normalizeLocale(locale);
    if (normalized) return normalized;
  }
  return DEFAULT_LOCALE;
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: resolveInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  missingWarn: true,
  fallbackWarn: true,
  messages,
});

function currentLocale() {
  const locale = i18n.global.locale;
  return typeof locale === 'string' ? locale : locale.value;
}

function applyLocaleToDocument(locale) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  root.lang = locale;
  root.dataset.locale = locale;
}

export function setLocale(locale, options = {}) {
  const nextLocale = normalizeLocale(locale) || DEFAULT_LOCALE;
  if (!isSupportedLocale(nextLocale)) return currentLocale();

  i18n.global.locale.value = nextLocale;
  applyLocaleToDocument(nextLocale);

  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, nextLocale);
  } catch {}

  if (!options.silent) {
    globalThis.dispatchEvent?.(
      new CustomEvent(LOCALE_CHANGED_EVENT, { detail: { locale: nextLocale } })
    );
  }
  if (options.broadcast !== false) void localeSync?.publish(nextLocale).catch(error => console.warn('[locale]', error));
  return nextLocale;
}

export function translate(key, params) {
  return i18n.global.t(key, params);
}

export function createLocaleSync(webMessages, { read, apply }) {
  const lifetime = new AbortController();
  const accept = value => { if (isSupportedLocale(value) && value !== read()) apply(value); };
  const stopEvent = webMessages.on('ui.localeChanged', accept);
  const stopRequest = webMessages.role === 'main' ? webMessages.handle('ui.locale', read) : () => {};
  const ready = webMessages.role === 'main' ? Promise.resolve() : webMessages.request('main', 'ui.locale', null,
    { waitForHandler: true, signal: lifetime.signal }).then(accept);
  return { ready, publish: value => webMessages.emit('ui.localeChanged', value),
    dispose() { lifetime.abort(); stopEvent(); stopRequest(); } };
}

export function setupLocaleSync() {
  if (localeSync) return;
  setLocale(currentLocale(), { silent: true, broadcast: false });
  localeSync = createLocaleSync(getWebMessages(), { read: currentLocale,
    apply: value => setLocale(value, { broadcast: false }) });
  void localeSync.ready.catch(error => { if (error.code !== 'ABORTED') console.warn('[locale]', error); });
  globalThis.addEventListener?.('pagehide', () => { localeSync?.dispose(); localeSync = null; }, { once: true });
}

export function useLocale() {
  return {
    defaultLocale: DEFAULT_LOCALE,
    locales: SUPPORTED_LOCALES,
    setLocale,
    storageKey: LOCALE_STORAGE_KEY,
  };
}
