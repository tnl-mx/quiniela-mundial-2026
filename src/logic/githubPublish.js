// Publica public/data/real-results.json directo a la rama main usando la API
// de GitHub (Contents API) con un token personal del usuario.
//
// api.github.com soporta CORS con token desde el navegador, asi que el fetch va
// directo desde el origen de Pages, sin proxy ni servidor intermedio.
//
// El token NUNCA se hardcodea ni se commitea: la UI lo captura en runtime y lo
// guarda solo en localStorage del dispositivo.

const OWNER = 'tnl-mx'
const REPO = 'quiniela-mundial-2026'
const PATH = 'public/data/real-results.json'
const BRANCH = 'main'

const ENDPOINT = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// base64 seguro para UTF-8 (btoa directo truena con caracteres no ASCII).
function toBase64Utf8(str) {
  return btoa(unescape(encodeURIComponent(str)))
}

// Traduce errores comunes de la API a mensajes utiles.
function friendlyError(status, apiMessage) {
  if (status === 401 || status === 403) {
    return 'Token invalido o sin permiso de escritura. Revisa que sea un fine-grained token con Contents: Read and write sobre este repo.'
  }
  if (status === 404) {
    return 'No se encontro el repo o el archivo. Revisa el token y los permisos.'
  }
  return `Error ${status}${apiMessage ? ': ' + apiMessage : ''}`
}

async function readApiMessage(res) {
  try {
    const body = await res.json()
    return body?.message || ''
  } catch {
    return ''
  }
}

// Obtiene el sha actual del archivo en la rama. Devuelve { ok, sha } o { ok:false, status, error }.
async function getSha(token) {
  const res = await fetch(`${ENDPOINT}?ref=${BRANCH}`, {
    headers: ghHeaders(token),
    cache: 'no-store',
  })
  if (!res.ok) {
    return { ok: false, status: res.status, error: friendlyError(res.status, await readApiMessage(res)) }
  }
  const data = await res.json()
  return { ok: true, sha: data.sha }
}

// Escribe el JSON oficial a main. Reintenta UNA vez si el sha cambio (409).
// Devuelve { ok:true, commitUrl } o { ok:false, status, error }.
export async function publishRealResults({ token, json }) {
  try {
    const content = toBase64Utf8(JSON.stringify(json, null, 2) + '\n')

    // 1) sha actual.
    const sha0 = await getSha(token)
    if (!sha0.ok) return sha0

    const putWith = (sha) =>
      fetch(ENDPOINT, {
        method: 'PUT',
        headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Resultados actualizados (admin)',
          content,
          sha,
          branch: BRANCH,
        }),
      })

    // 2) PUT; si choca por sha viejo (409), refresca el sha y reintenta una vez.
    let res = await putWith(sha0.sha)
    if (res.status === 409) {
      const sha1 = await getSha(token)
      if (!sha1.ok) return sha1
      res = await putWith(sha1.sha)
    }

    if (res.ok) {
      const data = await res.json()
      return { ok: true, commitUrl: data?.commit?.html_url }
    }
    return { ok: false, status: res.status, error: friendlyError(res.status, await readApiMessage(res)) }
  } catch (e) {
    return { ok: false, error: `Error de red: ${e.message}` }
  }
}
