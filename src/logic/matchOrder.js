// Orden CRONOLOGICO oficial de los 104 partidos del Mundial.
//
// Los partidos de grupos se juegan POR JORNADA (no grupo por grupo): primero la
// jornada 1 de los 12 grupos, luego la jornada 2 de todos, luego la jornada 3.
// El id ya codifica la jornada dentro del grupo:
//   *1 y *2 = jornada 1 · *3 y *4 = jornada 2 · *5 y *6 = jornada 3
//
//   1) J1 grupos: A1,A2,B1,B2,...,L1,L2   (matches 1-24)
//   2) J2 grupos: A3,A4,B3,B4,...,L3,L4   (matches 25-48)
//   3) J3 grupos: A5,A6,B5,B6,...,L5,L6   (matches 49-72)
//   4) Eliminatoria: M73..M104            (matches 73-104)
//
// Centralizamos AQUI el orden para poder migrarlo despues al calendario exacto
// dia-por-dia sin tocar el resto (la grafica y las flechas consumen matchNumber
// y cropRealResults, no el orden literal).

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Construye la lista de los 104 ids en orden cronologico.
function buildChronoIds() {
  const ids = []
  // Grupos por jornada: J1 = juegos 1,2 · J2 = 3,4 · J3 = 5,6
  for (const games of [[1, 2], [3, 4], [5, 6]]) {
    for (const g of GROUP_LETTERS) {
      for (const n of games) ids.push(`${g}${n}`)
    }
  }
  // Eliminatoria: M73..M104 ya son los numeros de match oficiales 73-104.
  for (let m = 73; m <= 104; m++) ids.push(`M${m}`)
  return ids
}

export const CHRONO_IDS = buildChronoIds()

// Mapa id -> numero de match (1..104).
const NUMBER_BY_ID = new Map(CHRONO_IDS.map((id, i) => [id, i + 1]))

export const TOTAL_MATCHES = CHRONO_IDS.length // 104

// Numero de match oficial (1..104) de un id. null si no se reconoce.
export function matchNumber(id) {
  return NUMBER_BY_ID.get(id) ?? null
}

function isValidScore(s) {
  return s != null && Number.isFinite(s.hs) && Number.isFinite(s.as)
}

// Recorta un real-results a "solo los partidos con matchNumber <= N".
// Devuelve un objeto con la MISMA forma (lo consume scorePrediction tal cual).
// El campeon solo cuenta si la final (match 104) entra en el recorte.
export function cropRealResults(realResults, n) {
  const groupMatches = {}
  for (const [id, s] of Object.entries(realResults.groupMatches ?? {})) {
    const num = matchNumber(id)
    if (num != null && num <= n) groupMatches[id] = s
  }
  const knockout = {}
  for (const [id, e] of Object.entries(realResults.knockout ?? {})) {
    const num = matchNumber(id)
    if (num != null && num <= n) knockout[id] = e
  }
  return {
    groupMatches,
    knockout,
    groupTiebreaks: realResults.groupTiebreaks ?? {},
    thirdPlaceTiebreaks: realResults.thirdPlaceTiebreaks ?? [],
    champion: n >= TOTAL_MATCHES ? realResults.champion ?? null : null,
    awards: realResults.awards ?? {},
  }
}

// Numero de match mas alto que YA se jugo (tiene resultado valido). 0 si nada.
export function maxPlayedMatch(realResults) {
  let max = 0
  for (const [id, s] of Object.entries(realResults.groupMatches ?? {})) {
    const num = matchNumber(id)
    if (num != null && isValidScore(s)) max = Math.max(max, num)
  }
  for (const [id, e] of Object.entries(realResults.knockout ?? {})) {
    const num = matchNumber(id)
    if (num != null && isValidScore(e)) max = Math.max(max, num)
  }
  return max
}

// Id del partido jugado mas RECIENTE por orden de captura (el ultimo agregado
// al real-results), NO por numero de match. Asi resaltamos lo que se acaba de
// subir, aunque se haya capturado fuera del orden cronologico. La eliminatoria
// va despues de grupos en el tiempo, asi que tiene prioridad. null si nada.
export function latestPlayedMatchId(realResults) {
  // Si el archivo trae marca explicita de la ultima llave capturada (la pone el
  // panel de admin), esa manda: el JSON guarda las claves ORDENADAS, asi que
  // "la ultima clave" no es necesariamente la ultima que se metio.
  const lm = realResults.lastMatchId
  if (lm) {
    if (isValidScore(realResults.knockout?.[lm])) return lm
    if (isValidScore(realResults.groupMatches?.[lm])) return lm
  }
  // Fallback (archivos sin la marca): la ultima clave presente, eliminatoria
  // antes que grupos.
  const ko = Object.keys(realResults.knockout ?? {}).filter((id) =>
    isValidScore(realResults.knockout[id]),
  )
  if (ko.length) return ko[ko.length - 1]
  const g = Object.keys(realResults.groupMatches ?? {}).filter((id) =>
    isValidScore(realResults.groupMatches[id]),
  )
  if (g.length) return g[g.length - 1]
  return null
}

// Puntos de corte (eje X) en bloques de `size` partidos, SOLO hasta el ultimo
// jugado. Incluye el ultimo jugado como punto final aunque no caiga en multiplo.
//   maxPlayed=12 -> [4,8,12] · maxPlayed=10 -> [4,8,10] · maxPlayed=2 -> [2]
export function blockEndpoints(maxPlayed, size = 4) {
  if (maxPlayed <= 0) return []
  const ends = []
  for (let n = size; n <= maxPlayed; n += size) ends.push(n)
  if (ends.length === 0 || ends[ends.length - 1] !== maxPlayed) ends.push(maxPlayed)
  return ends
}
