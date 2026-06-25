// Bracket REAL de la eliminatoria a partir de los resultados oficiales.
//
// Para cada llave de la Ronda de 32 resuelve sus dos slots a:
//   - un equipo concreto, si su grupo ya cerro O si su posicion ya esta
//     AMARRADA matematicamente aunque falten partidos (p. ej. Mexico 1o de su
//     grupo por haberle ganado a Corea: el head-to-head le asegura el 1o pase lo
//     que pase en la ultima jornada), o
//   - una sigla (1A, 2B, 3o) si todavia no se sabe.
//
// El "amarre" se calcula por SIMULACION exhaustiva: probamos todos los marcadores
// posibles (empates y margenes chicos/grandes) de los partidos que faltan en el
// grupo, usando el MISMO motor de tabla (calculateGroupTable, con desempate FIFA
// 2026). Si en TODOS los escenarios el equipo termina en la misma posicion, esa
// posicion esta amarrada. Es conservador: nunca afirma un amarre que no exista.

import { calculateGroupTable } from './groupTable.js'
import { buildBracket } from './bracket.js'

// Cuadro oficial 12.6 (Ronda de 32). Mismo que bracket.js.
//   ['g', LETRA, RANK] -> equipo en posicion RANK del grupo LETRA
//   ['t', LETRA]       -> tercero asignado al GANADOR del grupo LETRA (Annex C)
const R32_SPEC = [
  { id: 'M73', home: ['g', 'A', 2], away: ['g', 'B', 2] },
  { id: 'M74', home: ['g', 'E', 1], away: ['t', 'E'] },
  { id: 'M75', home: ['g', 'F', 1], away: ['g', 'C', 2] },
  { id: 'M76', home: ['g', 'C', 1], away: ['g', 'F', 2] },
  { id: 'M77', home: ['g', 'I', 1], away: ['t', 'I'] },
  { id: 'M78', home: ['g', 'E', 2], away: ['g', 'I', 2] },
  { id: 'M79', home: ['g', 'A', 1], away: ['t', 'A'] },
  { id: 'M80', home: ['g', 'L', 1], away: ['t', 'L'] },
  { id: 'M81', home: ['g', 'D', 1], away: ['t', 'D'] },
  { id: 'M82', home: ['g', 'G', 1], away: ['t', 'G'] },
  { id: 'M83', home: ['g', 'K', 2], away: ['g', 'L', 2] },
  { id: 'M84', home: ['g', 'H', 1], away: ['g', 'J', 2] },
  { id: 'M85', home: ['g', 'B', 1], away: ['t', 'B'] },
  { id: 'M86', home: ['g', 'J', 1], away: ['g', 'H', 2] },
  { id: 'M87', home: ['g', 'K', 1], away: ['t', 'K'] },
  { id: 'M88', home: ['g', 'D', 2], away: ['g', 'G', 2] },
]

// Marcadores candidatos por partido faltante: cubren empates y margenes chicos y
// grandes, suficiente para detectar amarres en grupos de 4 con desempates por
// diferencia/goles.
const CANDIDATES = [
  [0, 0], [1, 1], [2, 2], [3, 3],
  [1, 0], [2, 0], [3, 0], [9, 0],
  [0, 1], [0, 2], [0, 3], [0, 9],
]

function isValidScore(s) {
  return s != null && Number.isFinite(s.hs) && Number.isFinite(s.as)
}

// Tope de partidos faltantes para simular el amarre. La simulacion es
// exponencial (CANDIDATES^faltantes); con mas de esto el grupo esta tan abierto
// que no hay nada amarrado igual, asi que no vale la pena (y seria lento):
// devolvemos "todas las posiciones posibles" (sin amarre -> siglas).
const MAX_REMAINING_FOR_CLINCH = 3

// Para un grupo: si ya cerro (orden final) o, si no, que posiciones tiene
// AMARRADA cada equipo. Devuelve { complete, order, posByCode }:
//   - complete: los 6 partidos tienen resultado
//   - order: [1o,2o,3o,4o] si complete; null si no
//   - posByCode: { code: Set(posiciones posibles) } (siempre)
export function groupClinch(groupCode, realResults, tournament, teams) {
  const codes = tournament.groups[groupCode] ?? []
  const matches = tournament.groupMatches.filter((m) => m.group === groupCode)
  const gm = realResults.groupMatches ?? {}
  const remaining = matches.filter((m) => !isValidScore(gm[m.id]))
  const complete = remaining.length === 0

  if (complete) {
    const order = calculateGroupTable({
      groupCode, predictions: gm, tournament, teams,
    }).map((r) => r.code)
    const posByCode = Object.fromEntries(order.map((c, i) => [c, new Set([i + 1])]))
    return { complete: true, order, posByCode }
  }

  // Demasiado abierto para simular: nadie tiene nada amarrado (todas las pos).
  if (remaining.length > MAX_REMAINING_FOR_CLINCH) {
    const posByCode = Object.fromEntries(
      codes.map((c) => [c, new Set([1, 2, 3, 4])]),
    )
    return { complete: false, order: null, posByCode }
  }

  const posByCode = Object.fromEntries(codes.map((c) => [c, new Set()]))
  // Producto cartesiano de los marcadores candidatos de los partidos faltantes.
  const rec = (i, acc) => {
    if (i === remaining.length) {
      const order = calculateGroupTable({
        groupCode, predictions: acc, tournament, teams,
      }).map((r) => r.code)
      order.forEach((c, idx) => posByCode[c].add(idx + 1))
      return
    }
    for (const [hs, as] of CANDIDATES) {
      rec(i + 1, { ...acc, [remaining[i].id]: { hs, as } })
    }
  }
  rec(0, { ...gm })

  return { complete: false, order: null, posByCode }
}

// Equipo que tiene AMARRADA la posicion `rank` en un grupo (su unica posicion
// posible es `rank`), o null si todavia no se sabe.
function lockedAt(clinch, rank) {
  for (const [code, set] of Object.entries(clinch.posByCode)) {
    if (set.size === 1 && set.has(rank)) return code
  }
  return null
}

// Resuelve los slots de la Ronda de 32 a equipo concreto (si ya se sabe) o sigla.
// Devuelve un Map matchId -> { home: slot, away: slot } donde cada slot es
//   { code: <codigo|null>, label: '1A' | '2B' | '3o', locked: bool }
// `code` no-null = equipo ya conocido (grupo cerrado o posicion amarrada).
export function realR32Slots({ realResults, tournament, teams, annexCOptions }) {
  const clinchByGroup = {}
  for (const g of Object.keys(tournament.groups)) {
    clinchByGroup[g] = groupClinch(g, realResults, tournament, teams)
  }
  const allComplete = Object.values(clinchByGroup).every((c) => c.complete)

  // Para los slots de tercero (Annex C) solo sabemos el equipo cuando TODA la
  // fase de grupos cerro: ahi el bracket real ya queda bien definido.
  let realBracket = null
  if (allComplete) {
    realBracket = buildBracket({ tournament, teams, annexCOptions, predictions: realResults })
  }
  const r32ById = realBracket
    ? Object.fromEntries(realBracket.r32.map((m) => [m.id, m]))
    : {}

  const resolveSlot = (slot, matchId, side) => {
    if (slot[0] === 'g') {
      const [, group, rank] = slot
      const c = clinchByGroup[group]
      const code = c.complete ? c.order[rank - 1] : lockedAt(c, rank)
      return { code: code ?? null, label: `${rank}${group}`, locked: !!code }
    }
    // slot de tercero: solo resuelto si toda la fase de grupos cerro.
    const code = realBracket ? r32ById[matchId]?.[side] ?? null : null
    return { code, label: '3o', locked: !!code }
  }

  const out = {}
  for (const spec of R32_SPEC) {
    out[spec.id] = {
      home: resolveSlot(spec.home, spec.id, 'home'),
      away: resolveSlot(spec.away, spec.id, 'away'),
    }
  }
  return out
}
