// Generador del bracket completo de la fase eliminatoria del Mundial 2026.
//
// La idea general:
//   1) A partir de los marcadores predichos de fase de grupos, calculamos las
//      tablas de los 12 grupos y respetamos los desempates manuales del
//      usuario donde haga falta.
//   2) Rankeamos los 12 terceros lugares para saber cuales 8 clasifican.
//   3) Consultamos el Annex C de FIFA para saber, dado el conjunto de los 8
//      grupos cuyos terceros clasificaron, que tercero le toca a cada
//      ganador de grupo.
//   4) Armamos la Ronda de 32 con el cuadro oficial 12.6 y propagamos los
//      ganadores ronda por ronda hasta la Final (12.11) y el partido por el
//      tercer lugar (12.10, opcional).
//
// La funcion NUNCA inventa. Si algo no se puede resolver (empate sin
// desempate, marcador faltante, etc.) ese partido queda con status
// "pending"/"awaiting-score"/"tied-needs-pens" y se agrega un mensaje al
// arreglo "issues" para que la interfaz sepa que pedirle al usuario.

import { calculateGroupTable } from './groupTable.js'
import { rankThirdPlacedTeams } from './thirdPlace.js'
import { assignThirdPlaceToBracket } from './annexC.js'

// ---------- Cuadros oficiales como datos -----------------------------------

// Notacion para los slots de la Ronda de 32:
//   ['g', LETRA, RANK] -> el equipo en la posicion RANK del grupo LETRA
//                        (RANK = 1, 2, 3 o 4)
//   ['t', LETRA]       -> el tercero asignado al GANADOR del grupo LETRA via
//                        el Annex C
//
// Cuadro 12.6 (Ronda de 32): home = primer slot, away = segundo slot.
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

// Notacion para slots de rondas posteriores:
//   ['w', MATCH_ID] -> ganador del partido MATCH_ID
//   ['l', MATCH_ID] -> perdedor del partido MATCH_ID  (solo se usa en M103)

// Cuadro 12.7 (Octavos / Ronda de 16).
const R16_SPEC = [
  { id: 'M89', home: ['w', 'M74'], away: ['w', 'M77'] },
  { id: 'M90', home: ['w', 'M73'], away: ['w', 'M75'] },
  { id: 'M91', home: ['w', 'M76'], away: ['w', 'M78'] },
  { id: 'M92', home: ['w', 'M79'], away: ['w', 'M80'] },
  { id: 'M93', home: ['w', 'M83'], away: ['w', 'M84'] },
  { id: 'M94', home: ['w', 'M81'], away: ['w', 'M82'] },
  { id: 'M95', home: ['w', 'M86'], away: ['w', 'M88'] },
  { id: 'M96', home: ['w', 'M85'], away: ['w', 'M87'] },
]

// Cuadro 12.8 (Cuartos).
const QF_SPEC = [
  { id: 'M97',  home: ['w', 'M89'], away: ['w', 'M90'] },
  { id: 'M98',  home: ['w', 'M93'], away: ['w', 'M94'] },
  { id: 'M99',  home: ['w', 'M91'], away: ['w', 'M92'] },
  { id: 'M100', home: ['w', 'M95'], away: ['w', 'M96'] },
]

// Cuadro 12.9 (Semifinales).
const SF_SPEC = [
  { id: 'M101', home: ['w', 'M97'], away: ['w', 'M98'] },
  { id: 'M102', home: ['w', 'M99'], away: ['w', 'M100'] },
]

// Cuadro 12.10 (Tercer lugar, opcional). Usa los PERDEDORES de las semis.
const THIRD_SPEC = [
  { id: 'M103', home: ['l', 'M101'], away: ['l', 'M102'] },
]

// Cuadro 12.11 (Final).
const FINAL_SPEC = [
  { id: 'M104', home: ['w', 'M101'], away: ['w', 'M102'] },
]

// ---------- Helpers internos -----------------------------------------------

// Estados posibles de un partido eliminatorio:
//   'pending'           -> aun no se conocen los dos equipos
//   'awaiting-score'    -> se conocen los equipos pero falta el marcador
//   'tied-needs-pens'   -> el marcador es empate y faltan/son invalidos los penales
//   'decided'           -> hay ganador (por tiempo regular o por penales)

// Decide el estado de un partido eliminatorio a partir de sus campos brutos.
// NUNCA inventa: si falta informacion devuelve un estado que la interfaz
// puede usar para pedirle al usuario lo que haga falta.
function decideMatch(m) {
  const base = { ...m, winner: null, loser: null }

  if (!m.home || !m.away) {
    return { ...base, status: 'pending' }
  }

  if (!Number.isFinite(m.hs) || !Number.isFinite(m.as)) {
    return { ...base, status: 'awaiting-score' }
  }

  if (m.hs > m.as) {
    return { ...base, winner: m.home, loser: m.away, status: 'decided' }
  }
  if (m.hs < m.as) {
    return { ...base, winner: m.away, loser: m.home, status: 'decided' }
  }

  // Empate en tiempo regular: deben venir penales con ganador.
  if (!m.pens || !m.pens.went) {
    return { ...base, status: 'tied-needs-pens' }
  }
  const phs = m.pens.hs
  const pas = m.pens.as
  if (!Number.isFinite(phs) || !Number.isFinite(pas) || phs === pas) {
    return { ...base, status: 'tied-needs-pens' }
  }
  if (phs > pas) {
    return { ...base, winner: m.home, loser: m.away, status: 'decided' }
  }
  return { ...base, winner: m.away, loser: m.home, status: 'decided' }
}

// Resuelve un slot de la Ronda de 32 a un codigo de equipo, o null si todavia
// no hay datos suficientes para decidirlo.
function resolveR32Slot(slot, ctx) {
  const kind = slot[0]
  if (kind === 'g') {
    const [, group, rank] = slot
    const r = ctx.groupResults[group]
    if (!r) return null
    return r[['first', 'second', 'third', 'fourth'][rank - 1]] ?? null
  }
  if (kind === 't') {
    const [, winnerGroup] = slot
    const pairing = ctx.annexCPairings?.[winnerGroup]
    if (!pairing) return null
    // pairing es "3X"; nos quedamos con la letra del grupo X.
    const thirdGroup = pairing.replace(/^3/, '')
    return ctx.groupResults[thirdGroup]?.third ?? null
  }
  return null
}

// Resuelve un slot de las rondas posteriores (ganador/perdedor de un partido
// ya decidido). Devuelve null si el partido fuente todavia no esta decidido.
function resolveKnockoutSlot(slot, decided) {
  const [kind, matchId] = slot
  const m = decided[matchId]
  if (!m || m.status !== 'decided') return null
  return kind === 'w' ? m.winner : m.loser
}

// Construye una ronda completa: toma su spec, resuelve los slots, aplica las
// predicciones del usuario y decide el estado de cada partido. Va guardando
// los partidos decididos en `decided` para que la ronda siguiente los use.
function buildRound(spec, round, resolveSlotFn, decided, predictions) {
  return spec.map((s) => {
    const home = resolveSlotFn(s.home)
    const away = resolveSlotFn(s.away)
    const koPred = predictions.knockout?.[s.id] ?? {}
    const m = decideMatch({
      id: s.id,
      round,
      home,
      away,
      hs: koPred.hs,
      as: koPred.as,
      pens: koPred.pens,
    })
    decided[s.id] = m
    return m
  })
}

// Calcula, para cada grupo: 1ero, 2do, 3ero y 4to lugar, respetando los
// desempates manuales del usuario si la tabla los marca como no resueltos.
function calcGroupResults(tournament, teams, predictions, issues) {
  const groupResults = {}
  const syntheticGroupTables = {}

  for (const groupCode of Object.keys(tournament.groups)) {
    const table = calculateGroupTable({
      groupCode,
      predictions: predictions.groupMatches ?? {},
      tournament,
      teams,
    })

    // Empate "que importa": en cualquiera del top 3 (afecta clasificados y/o
    // tercer lugar). El empate del 4o entre si no afecta el bracket.
    const hasTopThreeTie = table.slice(0, 3).some((r) => r.tied)
    const userOrder = predictions.groupTiebreaks?.[groupCode]

    let resolved = table
    if (hasTopThreeTie) {
      if (Array.isArray(userOrder) && userOrder.length === 4) {
        const mapped = userOrder.map((code) =>
          table.find((r) => r.code === code),
        )
        if (mapped.every(Boolean)) {
          resolved = mapped
        } else {
          issues.push(
            `groupTiebreaks["${groupCode}"] contiene equipos que no pertenecen al grupo.`,
          )
        }
      } else {
        issues.push(
          `Empate no resuelto en grupo ${groupCode}: define predictions.groupTiebreaks["${groupCode}"] con el orden manual de los 4 equipos.`,
        )
      }
    }

    groupResults[groupCode] = {
      first: resolved[0]?.code ?? null,
      second: resolved[1]?.code ?? null,
      third: resolved[2]?.code ?? null,
      fourth: resolved[3]?.code ?? null,
    }

    // Para rankThirdPlacedTeams armamos una "tabla minima" cuya unica fila
    // tiene posicion 3 y refleja al tercero resuelto (con sus stats reales).
    const thirdCode = groupResults[groupCode].third
    const thirdRow = thirdCode ? table.find((r) => r.code === thirdCode) : null
    if (thirdRow) {
      syntheticGroupTables[groupCode] = [{ ...thirdRow, position: 3 }]
    }
  }

  return { groupResults, syntheticGroupTables }
}

// Rankea los terceros y elige los 8 clasificados, respetando desempate
// manual del usuario si la frontera 8-vs-9 esta exactamente empatada.
function calcQualifiedThirds(
  syntheticGroupTables,
  teams,
  predictions,
  issues,
) {
  const ranking = rankThirdPlacedTeams({
    groupTables: syntheticGroupTables,
    teams,
  })

  // Si por algun grupo sin resolver hay menos de 12 terceros, ya hay un
  // issue acumulado mas arriba; no inventamos.
  if (ranking.length < 9) {
    return null
  }

  // Solo el empate que cruza la frontera 8/9 cambia QUE grupos clasifican.
  // Empates dentro del top 8 o dentro del bottom 4 no afectan la asignacion.
  const eighth = ranking[7]
  const ninth = ranking[8]
  const boundaryTie =
    eighth.points === ninth.points &&
    eighth.goalDifference === ninth.goalDifference &&
    eighth.goalsFor === ninth.goalsFor

  const userOrder = predictions.thirdPlaceTiebreaks

  if (boundaryTie) {
    if (Array.isArray(userOrder) && userOrder.length === ranking.length) {
      const mapped = userOrder.map((code) =>
        ranking.find((r) => r.code === code),
      )
      if (mapped.every(Boolean)) {
        return mapped.slice(0, 8)
      }
      issues.push(
        'thirdPlaceTiebreaks contiene equipos que no estan en el ranking de terceros.',
      )
    } else {
      issues.push(
        'Empate no resuelto en la frontera 8-vs-9 de terceros: define predictions.thirdPlaceTiebreaks con el orden manual de los 12 terceros.',
      )
    }
  }

  return ranking.slice(0, 8)
}

// ---------- API publica -----------------------------------------------------

// buildBracket toma todo el estado de la quiniela y devuelve el bracket
// completo. Cada partido tiene un "status" que indica si esta listo o que
// falta para resolverlo. Los problemas se reportan en "issues".
export function buildBracket({
  tournament,
  teams,
  annexCOptions,
  predictions = {},
}) {
  const issues = []

  // 1) Resultados de grupos (con desempates manuales del usuario si aplica).
  const { groupResults, syntheticGroupTables } = calcGroupResults(
    tournament,
    teams,
    predictions,
    issues,
  )

  // 2) Ranking de terceros y eleccion de los 8 que clasifican.
  const qualifiedThirds = calcQualifiedThirds(
    syntheticGroupTables,
    teams,
    predictions,
    issues,
  )

  // 3) Consulta al Annex C: que tercero le toca a cada ganador.
  let annexCPairings = null
  if (qualifiedThirds && qualifiedThirds.length === 8) {
    const qualifiedGroups = qualifiedThirds.map((t) => t.groupCode)
    try {
      const result = assignThirdPlaceToBracket(
        qualifiedGroups,
        annexCOptions,
      )
      annexCPairings = result.pairings
    } catch (e) {
      issues.push(`Annex C no encontro coincidencia: ${e.message}`)
    }
  }

  // 4) Armamos la Ronda de 32 con el cuadro 12.6.
  const ctx = { groupResults, annexCPairings }
  const decided = {}

  const r32 = R32_SPEC.map((s) => {
    const home = resolveR32Slot(s.home, ctx)
    const away = resolveR32Slot(s.away, ctx)
    const koPred = predictions.knockout?.[s.id] ?? {}
    const m = decideMatch({
      id: s.id,
      round: 'R32',
      home,
      away,
      hs: koPred.hs,
      as: koPred.as,
      pens: koPred.pens,
    })
    decided[s.id] = m
    return m
  })

  // 5) Propagacion ronda por ronda hasta la final y el tercer lugar.
  const resolveKO = (slot) => resolveKnockoutSlot(slot, decided)
  const r16 = buildRound(R16_SPEC, 'R16', resolveKO, decided, predictions)
  const qf = buildRound(QF_SPEC, 'QF', resolveKO, decided, predictions)
  const sf = buildRound(SF_SPEC, 'SF', resolveKO, decided, predictions)
  const third = buildRound(
    THIRD_SPEC,
    'THIRD',
    resolveKO,
    decided,
    predictions,
  )
  const final = buildRound(
    FINAL_SPEC,
    'FINAL',
    resolveKO,
    decided,
    predictions,
  )

  const champion = final[0].winner ?? null

  return {
    r32,
    r16,
    qf,
    sf,
    third,
    final,
    champion,
    issues,
  }
}
