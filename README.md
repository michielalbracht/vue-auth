# @albrachtsystems/vue-auth

Herbruikbare Vue 3 + Pinia authenticatielaag die hoort bij
`albrachtsystems/laravel-auth`. Bevat factories voor de auth-store, de API-client,
token-opslag en passkey-helpers. Ondersteunt **sessie/cookie** (default) en
**token**.

UI (views) blijft per project; deze package levert alleen de logica.

## Installatie (monorepo)

```jsonc
// frontend/package.json
"dependencies": {
  "@albrachtsystems/vue-auth": "file:../packages/vue-auth",
  "@simplewebauthn/browser": "^13",   // peer (passkeys)
  "axios": "^1", "pinia": "^3", "vue": "^3"
}
```

De `file:`-dependency wordt door npm gesymlinkt. Zet daarom in Vite:

```js
// vite.config.js
resolve: { preserveSymlinks: true }
```

zodat de gelinkte package zijn imports (vue/pinia/axios/@simplewebauthn) uit
`frontend/node_modules` resolvet (één Vue-instantie).

## Exports

Barrel `@albrachtsystems/vue-auth` of subpaths (beter voor code-splitting):

- `@albrachtsystems/vue-auth/create-auth-store` → `createAuthStore`
- `@albrachtsystems/vue-auth/create-api-client` → `createApiClient`
- `@albrachtsystems/vue-auth/create-token-storage` → `createTokenStorage`
- `@albrachtsystems/vue-auth/create-passkey-api` → `createPasskeyApi`

## Sessie-modus (aanbevolen)

```js
// api/axios.js
import axios from 'axios'
import { createApiClient } from '@albrachtsystems/vue-auth/create-api-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const SANCTUM_BASE = API_URL.replace(/\/api\/?$/, '')

export const ensureCsrf = () =>
  axios.get(`${SANCTUM_BASE}/sanctum/csrf-cookie`, { withCredentials: true })

export default createApiClient({
  baseURL: API_URL,
  xsrf: true,                                  // stuurt X-XSRF-TOKEN mee
  onUnauthorized: (error) => {
    if ((error.config?.url ?? '').endsWith('/me')) return // auth-probe
    window.location.href = '/login'
  },
})
```

```js
// stores/auth.js
import { computed } from 'vue'
import api, { ensureCsrf } from '@/api/axios'
import { createAuthStore } from '@albrachtsystems/vue-auth/create-auth-store'

export const useAuthStore = createAuthStore({
  api,
  mode: 'session',
  ensureCsrf,
  passkeyLogin: async () => (await import('@/api/passkeys')).loginMetPasskey(),
  defaults: { /* domein-preferences */ },
  mergePreferences: (target, saved) => { /* optioneel: genuanceerde merge */ },
  extra: ({ user, api }) => ({
    // domein-getters & -acties
    mijnVakIds: computed(() => user.value?.vakken?.map(v => v.id) ?? []),
    async updateVakken(ids) {
      const { data } = await api.put('/me/vakken', { vak_ids: ids }); user.value = data
    },
  }),
})
```

Roep op app-start `auth.fetchMe()` aan; de sessiecookie bepaalt of er een
gebruiker is.

## Token-modus

```js
import { createTokenStorage } from '@albrachtsystems/vue-auth/create-token-storage'

const tokenStorage = createTokenStorage({ cookieName: 'app_token', cookieDomain: import.meta.env.VITE_COOKIE_DOMAIN })
const api = createApiClient({ baseURL, tokenStorage })           // injecteert Bearer
const useAuthStore = createAuthStore({ api, mode: 'token', tokenStorage, ... })
```

## API

**`createAuthStore(opts)`** → Pinia `defineStore`. Opts: `id`, `api`, `mode`
(`session`|`token`), `tokenStorage`, `ensureCsrf`, `passkeyLogin`, `defaults`,
`mergePreferences`, `extra`. Levert o.a. `user`, `isIngelogd`, `isGeverifieerd`,
`isAdmin`, `isPro`, `preferences`, `register`, `login`, `loginMetPasskey`,
`logout`, `fetchMe`, `updateProfiel`, `uploadAvatar`, `updatePreferences`.

**`createApiClient(opts)`** → axios-instance. Opts: `baseURL`, `tokenStorage?`,
`onUnauthorized?`, `headers?`, `withCredentials=true`, `xsrf=false`.

**`createTokenStorage(opts)`** → `{ getToken, setToken }`. Opts: `cookieName`,
`cookieDomain`, `storageKey`, `maxAge`.

**`createPasskeyApi(api)`** → `{ loginMetPasskey, registreerPasskey,
haalPasskeysOp, verwijderPasskey, isPasskeySupported }`.
