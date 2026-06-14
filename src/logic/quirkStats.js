// Estadisticas "divertidas" para la tarjeta rotativa del leaderboard.
// Funciones PURAS: reciben lo que necesitan y devuelven
//   { emoji, titulo, headline, detalle }  o  null si todavia no aplica
// (para que la rotacion las salte). No tocan el motor de scoring; para
// reconstruir rankings en un punto del torneo reusan la MISMA logica que la
// grafica de evolucion: cropRealResults + scorePrediction + ordenar.

import { maxPlayedMatch, matchNumber, CHRONO_IDS, cropRealResults } from './matchOrder.js'
import { scorePrediction } from './scoring.js'

function isValidScore(s) {
  return s != null && Number.isFinite(s.hs) && Number.isFinite(s.as)
}

// Lista corta de nombres: hasta 3 y luego "+K".
function formatNames(names) {
  if (names.length <= 3) return names.join(', ')
  return names.slice(0, 3).join(', ') + ` +${names.length - 3}`
}

// Ids de partidos jugados (grupos + eliminatoria) con resultado valido.
function playedIds(realResults) {
  const g = Object.keys(realResults.groupMatches ?? {}).filter((id) =>
    isValidScore(realResults.groupMatches[id]),
  )
  const k = Object.keys(realResults.knockout ?? {}).filter((id) =>
    isValidScore(realResults.knockout[id]),
  )
  return [...g, ...k]
}

// Ranking (Map file -> posicion 1..n) en el punto del torneo hasta el match N.
// Misma reconstruccion que EvolutionChart: recorta y vuelve a puntuar.
function positionsAt(n, { rows, realResults, tournament, teams, annexCOptions, scoring }) {
  const cropped = cropRealResults(realResults, n)
  const scored = rows.map((r) => ({
    file: r.file,
    name: r.name,
    total: scorePrediction({
      prediction: r.prediction,
      realResults: cropped,
      tournament,
      teams,
      annexCOptions,
      scoring,
    }).total,
  }))
  scored.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const pos = new Map()
  scored.forEach((r, i) => pos.set(r.file, i + 1))
  return pos
}

// a) Quienes clavaron el marcador EXACTO del ultimo partido (mayor numero de
//    match jugado). Igualdad directa de hs y as.
export function clavoElUltimo({ rows, realResults, tournament, teams }) {
  const n = maxPlayedMatch(realResults)
  if (n === 0) return null
  const id = CHRONO_IDS[n - 1]
  const isKO = id.startsWith('M')
  const real = isKO ? realResults.knockout?.[id] : realResults.groupMatches?.[id]
  if (!isValidScore(real)) return null

  let home, away
  if (isKO) {
    home = real.home
    away = real.away
  } else {
    const m = tournament.groupMatches.find((x) => x.id === id)
    home = m?.home
    away = m?.away
  }
  const flag = (c) => teams[c]?.flag ?? '🏳'

  const clavaron = rows
    .filter((r) => {
      const p = isKO ? r.prediction?.knockout?.[id] : r.prediction?.groupMatches?.[id]
      return p && p.hs === real.hs && p.as === real.as
    })
    .map((r) => r.name)

  return {
    emoji: '🎯',
    titulo: 'Clavó el último',
    headline: `${home} ${flag(home)} ${real.hs}-${real.as} ${flag(away)} ${away}`,
    detalle: clavaron.length ? formatNames(clavaron) : 'Nadie lo clavó',
  }
}

// b) Quien sumo mas puntos en los ultimos min(4, n) partidos jugados.
export function enRacha({ rows, realResults }) {
  const n = maxPlayedMatch(realResults)
  if (n === 0) return null
  const ventana = playedIds(realResults)
    .map((id) => ({ id, num: matchNumber(id) }))
    .filter((x) => x.num != null)
    .sort((a, b) => b.num - a.num)
    .slice(0, Math.min(4, n))
  const N = ventana.length
  if (N === 0) return null
  const set = new Set(ventana.map((x) => x.id))

  const scored = rows.map((r) => ({
    name: r.name,
    pts: (r.items ?? [])
      .filter((it) => set.has(it.matchId))
      .reduce((s, it) => s + (it.points || 0), 0),
  }))
  const max = Math.max(0, ...scored.map((s) => s.pts))
  if (max <= 0) return null // nadie sumo en la ventana: la rotacion lo salta
  const leaders = scored.filter((s) => s.pts === max).map((s) => s.name)

  return {
    emoji: '🔥',
    titulo: 'En racha',
    headline: formatNames(leaders),
    detalle: `${max} pts en los últimos ${N}`,
  }
}

// c) Quien mas subio de posicion entre el match n-1 y el n.
export function escalador(ctx) {
  const { rows, realResults } = ctx
  const n = maxPlayedMatch(realResults)
  if (n < 2) return null
  const now = positionsAt(n, ctx)
  const prev = positionsAt(n - 1, ctx)

  let bestDelta = 0
  let leaders = []
  for (const r of rows) {
    const delta = (prev.get(r.file) ?? 0) - (now.get(r.file) ?? 0) // positivo = subio
    if (delta > bestDelta) {
      bestDelta = delta
      leaders = [r.name]
    } else if (delta === bestDelta && delta > 0) {
      leaders.push(r.name)
    }
  }
  if (bestDelta <= 0) return null // nadie subio

  return {
    emoji: '📈',
    titulo: 'Escalador de la jornada',
    headline: formatNames(leaders),
    detalle: `subió ${bestDelta} lugar${bestDelta > 1 ? 'es' : ''}`,
  }
}

// d) Quien tiene mas marcadores EXACTOS entre los partidos jugados.
export function francotirador({ rows }) {
  const scored = rows.map((r) => ({
    name: r.name,
    exact: (r.items ?? []).filter(
      (it) =>
        (it.category === 'groupMatches' || it.category === 'knockoutMatch') &&
        it.status === 'exact',
    ).length,
  }))
  const max = Math.max(0, ...scored.map((s) => s.exact))
  if (max <= 0) return null
  const leaders = scored.filter((s) => s.exact === max).map((s) => s.name)

  return {
    emoji: '🔫',
    titulo: 'Francotirador',
    headline: formatNames(leaders),
    detalle: `${max} marcador${max > 1 ? 'es' : ''} exacto${max > 1 ? 's' : ''}`,
  }
}

// Arma la lista de stats aplicables (descarta las que devuelven null).
export function buildQuirkStats(ctx) {
  return [clavoElUltimo(ctx), enRacha(ctx), escalador(ctx), francotirador(ctx)].filter(Boolean)
}
