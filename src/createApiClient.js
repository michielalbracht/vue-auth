import axios from 'axios'

/**
 * Maakt een axios-instance met bearer-token-injectie en 401-afhandeling.
 *
 * @param {object}   opts
 * @param {string}   opts.baseURL                Basis-URL van de API.
 * @param {object}   [opts.tokenStorage]         { getToken, setToken } (token-modus; zie createTokenStorage).
 * @param {function} [opts.onUnauthorized]       Callback bij een 401-respons.
 * @param {object}   [opts.headers]              Extra default-headers.
 * @param {boolean}  [opts.withCredentials=true] axios withCredentials.
 * @param {boolean}  [opts.xsrf=false]           withXSRFToken voor sessie/CSRF-modus.
 */
export function createApiClient({
  baseURL,
  tokenStorage,
  onUnauthorized,
  headers = {},
  withCredentials = true,
  xsrf = false,
} = {}) {
  const api = axios.create({
    baseURL,
    // Geen expliciete Content-Type — axios stelt dit automatisch in:
    // application/json voor objecten, multipart/form-data+boundary voor FormData.
    headers: { Accept: 'application/json', ...headers },
    withCredentials,
    withXSRFToken: xsrf,
  })

  api.interceptors.request.use((config) => {
    // Alleen in token-modus: bearer-token meesturen.
    const token = tokenStorage?.getToken?.()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        onUnauthorized?.(error)
      }
      return Promise.reject(error)
    }
  )

  return api
}
