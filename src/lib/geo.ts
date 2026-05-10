const COUNTRY_TO_LANG: Record<string, string> = {
  FR: 'fr', BE: 'fr', CH: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', CM: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es',
  DE: 'de', AT: 'de',
  PT: 'pt', BR: 'pt',
  IT: 'it',
  NL: 'nl',
  PL: 'pl',
  RU: 'ru',
  ZH: 'zh', CN: 'zh', TW: 'zh',
  JP: 'ja',
  KR: 'ko',
  SA: 'ar', AE: 'ar', EG: 'ar', DZ: 'ar', MA: 'ar', IQ: 'ar', LY: 'ar',
  TR: 'tr',
  IN: 'hi',
}

export function getLanguageFromCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return 'en'
  return COUNTRY_TO_LANG[countryCode.toUpperCase()] ?? 'en'
}

// Get country from Vercel's geo headers or CF-IPCountry
export function getCountryFromRequest(headers: Headers): string | null {
  return (
    headers.get('x-vercel-ip-country') ??
    headers.get('cf-ipcountry') ??
    headers.get('x-country-code') ??
    null
  )
}

export const LANG_NAMES: Record<string, string> = {
  en: 'English', fr: 'Français', es: 'Español', de: 'Deutsch',
  pt: 'Português', it: 'Italiano', nl: 'Nederlands', pl: 'Polski',
  ru: 'Русский', zh: '中文', ja: '日本語', ko: '한국어',
  ar: 'العربية', tr: 'Türkçe', hi: 'हिन्दी',
}
