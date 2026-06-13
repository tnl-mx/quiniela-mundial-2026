// Memoria de scroll con expiracion: recuerda por un rato donde te quedaste,
// tanto en el leaderboard como dentro de cada quiniela. Funciones puras (sin
// React). Todo va envuelto en try/catch porque localStorage puede fallar
// (modo privado en algunos navegadores).

// Cuanto dura la memoria. Ajusta este valor para mas/menos tiempo.
const TTL_MS = 12 * 60 * 60 * 1000 // 12 horas

function storageKey(key) {
  return `q26:scroll:${key}`
}

// Guarda la posicion vertical (y) bajo una clave, con marca de tiempo.
export function saveScroll(key, y) {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify({ y, at: Date.now() }))
  } catch {
    /* localStorage no disponible: ignoramos en silencio */
  }
}

// Lee la posicion guardada. Devuelve null si no existe o si ya vencio (y de
// paso borra la entrada vencida).
export function readScroll(key) {
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (
      typeof data?.y !== 'number' ||
      typeof data?.at !== 'number' ||
      Date.now() - data.at > TTL_MS
    ) {
      try {
        window.localStorage.removeItem(storageKey(key))
      } catch {
        /* noop */
      }
      return null
    }
    return data.y
  } catch {
    return null
  }
}
