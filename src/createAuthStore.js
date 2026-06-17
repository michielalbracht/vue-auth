import { ref, reactive, computed, watch } from 'vue'
import { defineStore } from 'pinia'

/**
 * Generieke, herbruikbare auth-store-factory.
 *
 * Ondersteunt twee modi:
 *  - 'session' (default): cookie/sessie-gebaseerd (Sanctum stateful + CSRF).
 *    Geen token; `ensureCsrf` wordt vóór mutaties aangeroepen.
 *  - 'token': Sanctum personal access tokens via `tokenStorage`.
 *
 * Domeinspecifieke getters/acties en preference-defaults voegt het project toe
 * via `defaults`, `mergePreferences` en `extra`.
 */
export function createAuthStore({
  id = 'auth',
  api,
  mode = 'session',
  tokenStorage,
  ensureCsrf,
  passkeyLogin,
  defaults = {},
  mergePreferences,
  extra,
} = {}) {
  const isToken = mode === 'token'
  const getToken = tokenStorage?.getToken ?? (() => null)
  const setToken = tokenStorage?.setToken ?? (() => {})

  const cloneDefaults = () => JSON.parse(JSON.stringify(defaults))

  const mergeFn = mergePreferences || ((target, saved) => {
    if (!saved) return
    for (const key of Object.keys(defaults)) {
      if (saved[key] !== undefined) target[key] = saved[key]
    }
  })

  // In sessie-modus is er geen CSRF-cookie nodig vóór login als de backend die
  // al op GET-responses zet; `ensureCsrf` is de canonieke, veilige aanpak.
  const prepareWrite = async () => {
    if (!isToken && typeof ensureCsrf === 'function') {
      await ensureCsrf()
    }
  }

  return defineStore(id, () => {
    const user = ref(null)
    const token = ref(isToken ? getToken() : null)
    const loading = ref(false)
    const preferences = reactive(cloneDefaults())

    let _saveTimer = null

    // Deep watch: elke mutatie aan preferences triggert een gedebouncede save
    // zolang er een gebruiker is ingelogd.
    watch(preferences, () => {
      if (!user.value) return
      clearTimeout(_saveTimer)
      _saveTimer = setTimeout(() => {
        api.put('/me/preferences', { preferences: JSON.parse(JSON.stringify(preferences)) }).catch(() => {})
      }, 800)
    }, { deep: true })

    const isIngelogd = computed(() => isToken ? (!!token.value && !!user.value) : !!user.value)
    const isGeverifieerd = computed(() => !!user.value?.email_verified_at)
    const isPro = computed(() => !!user.value?.is_pro)
    const isAdmin = computed(() => !!user.value?.is_admin)

    function _loadPreferences(opgeslagen) {
      mergeFn(preferences, opgeslagen, defaults)
    }

    function _setAuth(data) {
      user.value = data.user
      _loadPreferences(data.user?.preferences)
      if (isToken) {
        token.value = data.token
        setToken(data.token)
      }
    }

    function _clearAuth() {
      user.value = null
      if (isToken) {
        token.value = null
        setToken(null)
      }
      const fresh = cloneDefaults()
      for (const key of Object.keys(defaults)) preferences[key] = fresh[key]
    }

    async function register(gegevens) {
      await prepareWrite()
      const { data } = await api.post('/register', gegevens)
      _setAuth(data)
      return data
    }

    async function login(gegevens) {
      await prepareWrite()
      const { data } = await api.post('/login', gegevens)
      _setAuth(data)
      return data
    }

    async function loginMetPasskey() {
      await prepareWrite()
      const data = await passkeyLogin()
      _setAuth(data)
      return data
    }

    // Magic-link: vraag een eenmalige inloglink aan (anti-enumeratie: altijd ok).
    async function vraagMagicLinkAan(email) {
      await prepareWrite()
      const { data } = await api.post('/magic-link', { email })
      return data
    }

    // Magic-link: verzilver de token uit de e-maillink en log in.
    async function loginMetMagicLink(payload) {
      await prepareWrite()
      const { data } = await api.post('/magic-link/login', payload)
      _setAuth(data)
      return data
    }

    async function logout() {
      try {
        await prepareWrite()
        await api.post('/logout')
      } catch {}
      _clearAuth()
    }

    async function fetchMe() {
      // Token-modus: zonder token geen probe. Sessie-modus: altijd proberen
      // (de sessiecookie bepaalt of er een gebruiker is).
      if (isToken && !token.value) return
      loading.value = true
      try {
        const { data } = await api.get('/me')
        user.value = data
        _loadPreferences(data.preferences)
      } catch {
        _clearAuth()
      } finally {
        loading.value = false
      }
    }

    async function updateProfiel(gegevens) {
      const { data } = await api.put('/me', gegevens)
      user.value = data
      return data
    }

    async function uploadAvatar(file) {
      const formData = new FormData()
      formData.append('avatar', file)
      const { data } = await api.post('/me/avatar', formData)
      user.value = data
      return data
    }

    function updatePreferences(patch) {
      Object.assign(preferences, patch)
    }

    const base = {
      user, token, loading, preferences,
      isIngelogd, isGeverifieerd, isPro, isAdmin,
      register, login, loginMetPasskey, vraagMagicLinkAan, loginMetMagicLink,
      logout, fetchMe, updateProfiel, uploadAvatar, updatePreferences,
      _setAuth, _clearAuth,
    }

    const extended = typeof extra === 'function'
      ? extra({ user, token, preferences, api, base })
      : {}

    return { ...base, ...extended }
  })
}
