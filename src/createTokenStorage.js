/**
 * Token-opslag-factory. Gebruikt een cookie (gedeeld over subdomeinen) wanneer
 * een `cookieDomain` is opgegeven, anders localStorage (dev / tests).
 *
 * Stack-agnostisch: alle projectspecifieke waarden (cookienaam, domein) worden
 * door het host-project meegegeven; de module leest geen env-variabelen.
 *
 * @param {object}  opts
 * @param {string}  [opts.cookieName='token']   Naam van de cookie.
 * @param {?string} [opts.cookieDomain=null]    Cookiedomein; null = localStorage.
 * @param {string}  [opts.storageKey='token']   localStorage-sleutel (dev-modus).
 * @param {number}  [opts.maxAge=2592000]       Cookie max-age in seconden (30 dagen).
 */
export function createTokenStorage({
  cookieName = 'token',
  cookieDomain = null,
  storageKey = 'token',
  maxAge = 60 * 60 * 24 * 30,
} = {}) {
  function getToken() {
    if (cookieDomain) {
      const match = document.cookie.match(new RegExp(`(?:^|; )${cookieName}=([^;]*)`))
      return match ? decodeURIComponent(match[1]) : null
    }
    return localStorage.getItem(storageKey)
  }

  function setToken(token) {
    if (cookieDomain) {
      if (token) {
        document.cookie = [
          `${cookieName}=${encodeURIComponent(token)}`,
          `domain=${cookieDomain}`,
          'path=/',
          'secure',
          'samesite=lax',
          `max-age=${maxAge}`,
        ].join('; ')
      } else {
        // Verwijder cookie door max-age=0
        document.cookie = `${cookieName}=; domain=${cookieDomain}; path=/; max-age=0`
      }
    } else {
      if (token) {
        localStorage.setItem(storageKey, token)
      } else {
        localStorage.removeItem(storageKey)
      }
    }
  }

  return { getToken, setToken }
}
