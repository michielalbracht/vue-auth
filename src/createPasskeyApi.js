import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

/**
 * Passkey-helpers gebonden aan een API-client. De endpoints komen overeen met
 * de routes van de albrachtsystems/laravel-auth backend-module.
 *
 * @param {import('axios').AxiosInstance} api
 */
export function createPasskeyApi(api) {
  async function loginMetPasskey() {
    const { data: optionsResp } = await api.get('/passkeys/login/options')
    const credential = await startAuthentication({ optionsJSON: optionsResp.options })
    const { data } = await api.post('/passkeys/login', { credential })
    return data // { token, user }
  }

  async function registreerPasskey(naam) {
    const { data: optionsResp } = await api.get('/user/passkeys/options')
    const credential = await startRegistration({ optionsJSON: optionsResp.options })
    const { data } = await api.post('/user/passkeys', { name: naam, credential })
    return data // { id, name, created_at }
  }

  async function haalPasskeysOp() {
    const { data } = await api.get('/user/passkeys')
    return data
  }

  async function verwijderPasskey(id) {
    await api.delete(`/user/passkeys/${id}`)
  }

  function isPasskeySupported() {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential
  }

  return { loginMetPasskey, registreerPasskey, haalPasskeysOp, verwijderPasskey, isPasskeySupported }
}
