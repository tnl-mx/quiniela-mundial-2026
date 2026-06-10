// Relleno al azar de marcadores de partidos.
//
// Filosofia:
//   - Funciones PURAS para que sean testeables y deterministas si se les
//     pasa un random custom.
//   - NUNCA sobrescribimos un marcador ya capturado. Lo que esta, se respeta.
//   - El sorteo de goles esta sesgado a POCOS goles (futbol real: 1-0, 2-1
//     y 0-0 son los marcadores mas tipicos; 7-x es casi inexistente).
//
// Cuando un grupo termina de rellenarse y queda con empate exacto en
// posiciones 1-3, el llamador puede usar `autoResolveTieIfNeeded` para
// guardar el orden provisional por ranking FIFA en groupTiebreaks. Asi
// la quiniela queda totalmente consistente sin pedir intervencion.

import { calculateGroupTable } from './groupTable.js'
import { buildBracket } from './bracket.js'

// Pesos relativos del numero de goles que mete UN equipo en UN partido.
// indice = numero de goles (0..7). Los pesos no necesitan estar normalizados;
// pickWeighted hace la division.
//
// Probabilidades resultantes (sumando = 100):
//   0:28%  1:30%  2:22%  3:12%  4:5%  5:2%  6:0.8%  7:0.2%
// Media esperada de goles por equipo: ~1.46
// Resultados tipicos: 1-0, 2-1, 0-0, 1-1. Raros: 5-3. Casi imposibles: 7-x.
export const SCORE_WEIGHTS = [28, 30, 22, 12, 5, 2, 0.8, 0.2]

// Sortea un indice (0..n-1) segun pesos relativos. random() debe devolver
// un numero en [0, 1). Por defecto usa Math.random pero las pruebas pueden
// pasar un generador determinista.
export function pickWeighted(weights, random = Math.random) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = random() * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]
    if (r < 0) return i
  }
  // Fallback por errores de redondeo: devolvemos el ultimo indice.
  return weights.length - 1
}

// Devuelve un marcador aleatorio { hs, as }. Los dos equipos se sortean
// de forma INDEPENDIENTE con los mismos pesos.
export function randomScore(random = Math.random) {
  return {
    hs: pickWeighted(SCORE_WEIGHTS, random),
    as: pickWeighted(SCORE_WEIGHTS, random),
  }
}

// True si un marcador del esquema { hs, as } esta validamente capturado.
function isCaptured(score) {
  return (
    score != null &&
    Number.isFinite(score.hs) &&
    Number.isFinite(score.as)
  )
}

// Calcula los marcadores que el random-fill agregaria a UN grupo:
// devuelve un objeto { matchId: { hs, as } } SOLO de los partidos que aun
// no estan capturados. Si el grupo esta completo, devuelve {}.
export function fillGroupAtRandom({ groupCode, tournament, predictions, random = Math.random }) {
  const matches = tournament.groupMatches.filter((m) => m.group === groupCode)
  const updates = {}
  for (const m of matches) {
    if (isCaptured(predictions.groupMatches?.[m.id])) continue
    updates[m.id] = randomScore(random)
  }
  return updates
}

// Igual que fillGroupAtRandom pero recorre TODOS los grupos del torneo.
// Devuelve { matchId: { hs, as } } solo de los partidos no-capturados.
export function fillAllRemainingAtRandom({ tournament, predictions, random = Math.random }) {
  const updates = {}
  for (const m of tournament.groupMatches) {
    if (isCaptured(predictions.groupMatches?.[m.id])) continue
    updates[m.id] = randomScore(random)
  }
  return updates
}

// ============ Penales aleatorios ============
//
// Para llaves de eliminatoria que quedan empatadas, generamos una tanda de
// penales realista. Reglas:
//   - Ganador: 3, 4 o 5 goles (4 es lo mas comun).
//   - Diferencia 1 o 2 dominante; 3+ raro.
//   - JAMAS empate en penales.
// Marcadores tipicos: 4-3, 5-4, 5-3, 4-2, 3-1.

// Pesos del numero de goles del GANADOR (indice = goles, 0-2 = peso 0).
export const PEN_WINNER_WEIGHTS = [0, 0, 0, 30, 50, 20]
// Pesos de la DIFERENCIA dado el ganador (indice = diferencia, 0 = peso 0).
export const PEN_DIFF_WEIGHTS = [0, 50, 30, 12, 6, 2]

// Devuelve { hs, as } de la tanda de penales, ganador random entre los dos
// lados (50/50). Determinista si se pasa random custom.
export function randomPenalties(random = Math.random) {
  const winnerGoals = pickWeighted(PEN_WINNER_WEIGHTS, random)
  // La diferencia maxima posible es winnerGoals (loser >= 0).
  const maxDiff = Math.min(PEN_DIFF_WEIGHTS.length - 1, winnerGoals)
  const diffWeights = PEN_DIFF_WEIGHTS.slice(0, maxDiff + 1)
  const diff = pickWeighted(diffWeights, random)
  const loserGoals = winnerGoals - diff

  // 50/50 quien gana la tanda (independiente de quien era home).
  const homeWins = random() < 0.5
  return homeWins
    ? { hs: winnerGoals, as: loserGoals }
    : { hs: loserGoals, as: winnerGoals }
}

// ============ Relleno aleatorio del bracket ============
//
// Recorre las rondas en orden y rellena marcadores faltantes usando
// buildBracket como fuente de verdad. Para cada ronda:
//   - Si el match esta 'awaiting-score', generamos score con randomScore.
//     Si quedo empatado, generamos pens con randomPenalties.
//   - Si el match esta 'tied-needs-pens' (el usuario capturo score
//     empatado pero faltan pens), CONSERVAMOS su score y solo generamos
//     pens.
//   - Si el match esta 'decided', no lo tocamos.
//   - Si esta 'pending' (la ronda previa no esta resuelta) lo saltamos
//     defensivamente; al cerrar la ronda anterior, deberia ya tener equipos.
//
// Devuelve { knockoutUpdates, champion } listos para aplicar via
// applyRandomFill en usePrediction.

const KNOCKOUT_ROUNDS = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

function generateKnockoutResult(match, random) {
  if (match.status === 'awaiting-score') {
    const score = randomScore(random)
    const result = { hs: score.hs, as: score.as }
    if (score.hs === score.as) {
      const pens = randomPenalties(random)
      result.pens = { went: true, hs: pens.hs, as: pens.as }
    }
    return result
  }
  if (match.status === 'tied-needs-pens') {
    // Conservamos el score que el usuario habia puesto; solo agregamos pens.
    const pens = randomPenalties(random)
    return {
      hs: match.hs,
      as: match.as,
      pens: { went: true, hs: pens.hs, as: pens.as },
    }
  }
  return null
}

export function fillBracketAtRandom({
  tournament,
  teams,
  annexCOptions,
  predictions,
  random = Math.random,
}) {
  const knockoutUpdates = {}
  let working = predictions

  for (const round of KNOCKOUT_ROUNDS) {
    const bracket = buildBracket({
      tournament,
      teams,
      annexCOptions,
      predictions: working,
    })
    const matches = bracket[round] ?? []

    for (const match of matches) {
      if (match.status === 'decided') continue
      if (match.status === 'pending') continue

      const update = generateKnockoutResult(match, random)
      if (!update) continue

      // Persistimos tambien home/away ("fotografia") para que el export y la
      // deteccion de stale en la UI funcionen correctamente.
      knockoutUpdates[match.id] = {
        home: match.home,
        away: match.away,
        hs: update.hs,
        as: update.as,
        ...(update.pens ? { pens: update.pens } : {}),
      }

      // Actualizamos "working" para que la proxima iteracion de buildBracket
      // ya considere este resultado en la propagacion.
      working = {
        ...working,
        knockout: {
          ...working.knockout,
          [match.id]: knockoutUpdates[match.id],
        },
      }
    }
  }

  // Calculamos el campeon final tras toda la propagacion.
  const finalBracket = buildBracket({
    tournament,
    teams,
    annexCOptions,
    predictions: working,
  })

  return {
    knockoutUpdates,
    champion: finalBracket.champion,
  }
}

// ============ Relleno aleatorio de UNA sola ronda ============
//
// Rellena al azar SOLO la ronda indicada (r32 | r16 | qf | sf | third |
// final), respetando la dependencia: una ronda solo puede llenarse si su
// ronda previa ya esta resuelta (sus equipos definidos). Si la ronda no esta
// lista (alguna llave 'pending'), esas llaves se saltan defensivamente.
//
// Reutiliza exactamente la misma logica de generacion (randomScore /
// randomPenalties via generateKnockoutResult) que fillBracketAtRandom; NO se
// duplica nada. Respeta lo ya capturado (no toca llaves 'decided').
//
// Devuelve { knockoutUpdates, champion } listos para applyRandomFill. El
// champion se recalcula tras aplicar (sera null salvo que se haya rellenado
// la final).
export function fillKnockoutRoundAtRandom({
  tournament,
  teams,
  annexCOptions,
  predictions,
  round,
  random = Math.random,
}) {
  const knockoutUpdates = {}
  let working = predictions

  const bracket = buildBracket({
    tournament,
    teams,
    annexCOptions,
    predictions: working,
  })
  const matches = bracket[round] ?? []

  for (const match of matches) {
    if (match.status === 'decided') continue
    if (match.status === 'pending') continue // dependencia no lista: saltar.

    const update = generateKnockoutResult(match, random)
    if (!update) continue

    knockoutUpdates[match.id] = {
      home: match.home,
      away: match.away,
      hs: update.hs,
      as: update.as,
      ...(update.pens ? { pens: update.pens } : {}),
    }
    working = {
      ...working,
      knockout: {
        ...working.knockout,
        [match.id]: knockoutUpdates[match.id],
      },
    }
  }

  // Recalculamos el campeon con el estado ya actualizado (solo cambia si se
  // relleno la final).
  const finalBracket = buildBracket({
    tournament,
    teams,
    annexCOptions,
    predictions: working,
  })

  return { knockoutUpdates, champion: finalBracket.champion }
}

// ============ Relleno "hasta una fase" (encadenado) ============
//
// Rellena al azar TODO lo pendiente desde donde va el usuario HASTA completar
// la fase objetivo, inclusive. Respeta dependencias porque encadena fase por
// fase en orden (cada ronda usa el resultado de la anterior) y respeta lo ya
// capturado (no sobrescribe). NO duplica logica: reutiliza
// fillAllRemainingAtRandom (grupos), autoResolveTieIfNeeded (empates) y
// fillKnockoutRoundAtRandom (cada ronda).
//
// target ∈ 'groups' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
//   - 'groups' -> solo la fase de grupos.
//   - 'r32'..'sf' -> grupos + rondas hasta esa, inclusive.
//   - 'third' -> grupos + R32..SF + tercer lugar (sin final).
//   - 'final' -> TODO (incluye tercer lugar y la final/campeon).
//
// Devuelve { matchUpdates, tiebreakUpdates, knockoutUpdates, champion } listo
// para applyRandomFill.
const FILL_PHASE_ORDER = ['groups', 'r32', 'r16', 'qf', 'sf', 'third', 'final']

export function fillUpToPhase({
  tournament,
  teams,
  annexCOptions,
  predictions,
  target,
  random = Math.random,
}) {
  const targetIdx = FILL_PHASE_ORDER.indexOf(target)
  if (targetIdx === -1) {
    return {
      matchUpdates: {},
      tiebreakUpdates: {},
      knockoutUpdates: {},
      champion: predictions?.champion ?? null,
    }
  }

  let working = predictions

  // Paso 1: grupos (todo target los incluye, porque definen el bracket).
  const matchUpdates = fillAllRemainingAtRandom({
    tournament,
    predictions: working,
    random,
  })
  if (Object.keys(matchUpdates).length) {
    working = {
      ...working,
      groupMatches: { ...working.groupMatches, ...matchUpdates },
    }
  }

  // Resolver empates exactos en los grupos ya completos, para poder armar el
  // bracket en los pasos siguientes.
  const tiebreakUpdates = {}
  for (const groupCode of Object.keys(tournament.groups)) {
    const gm = tournament.groupMatches.filter((m) => m.group === groupCode)
    const allCaptured = gm.every((m) => isCaptured(working.groupMatches?.[m.id]))
    if (!allCaptured) continue
    const order = autoResolveTieIfNeeded({
      groupCode, tournament, teams, predictions: working,
    })
    if (order) {
      tiebreakUpdates[groupCode] = order
      working = {
        ...working,
        groupTiebreaks: { ...working.groupTiebreaks, [groupCode]: order },
      }
    }
  }

  // Paso 2: rondas de knockout, en orden, hasta el target.
  let knockoutUpdates = {}
  for (let i = 1; i <= targetIdx; i++) {
    const round = FILL_PHASE_ORDER[i]
    const { knockoutUpdates: ku } = fillKnockoutRoundAtRandom({
      tournament, teams, annexCOptions, predictions: working, round, random,
    })
    if (Object.keys(ku).length) {
      knockoutUpdates = { ...knockoutUpdates, ...ku }
      working = { ...working, knockout: { ...working.knockout, ...ku } }
    }
  }

  const finalBracket = buildBracket({
    tournament, teams, annexCOptions, predictions: working,
  })

  return {
    matchUpdates,
    tiebreakUpdates,
    knockoutUpdates,
    champion: finalBracket.champion,
  }
}

// ============ autoResolveTieIfNeeded ============
//
// Si la tabla del grupo queda con empate exacto en posiciones 1-3, devuelve
// el orden de los 4 equipos en el orden provisional FIFA que
// calculateGroupTable ya calcula como cuarto criterio. Si NO hay empate,
// devuelve null (no se necesita guardar nada en groupTiebreaks).
//
// El llamador usa esto despues de aplicar los matchUpdates al estado, para
// que la quiniela quede consistente sin pedirle al usuario que intervenga.
export function autoResolveTieIfNeeded({ groupCode, tournament, teams, predictions }) {
  const table = calculateGroupTable({
    groupCode,
    predictions: predictions.groupMatches,
    tournament,
    teams,
  })
  const hasTie = table.slice(0, 3).some((r) => r.tied)
  if (!hasTie) return null
  // calculateGroupTable ya ordeno provisionalmente por FIFA cuando hubo
  // empate exacto. Solo tomamos esa secuencia de 4 codigos.
  return table.map((r) => r.code)
}
