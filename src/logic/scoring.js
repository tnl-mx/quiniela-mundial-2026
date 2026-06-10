// Motor de puntuacion de la quiniela.
//
// Compara la PREDICCION de una persona contra los RESULTADOS REALES y calcula
// sus puntos, desglosados por categoria. Es logica PURA: no toca red ni DOM.
//
// Idea central de reutilizacion:
//   `real-results.json` tiene EXACTAMENTE la misma forma que una prediccion
//   (groupMatches, knockout, champion). Por eso podemos construir el "bracket
//   real" llamando a buildBracket sobre los resultados reales, igual que
//   construimos el bracket de la persona sobre su prediccion. Asi no
//   reimplementamos la estructura del torneo en ningun lado.
//
// Reglas completas: ver docs/REGLAS-PUNTUACION-quiniela.md (capas A-F).
//
// Principio: SOLO cuenta lo que YA tiene resultado real. Los partidos/grupos
// ausentes en real-results valen 0 (todavia no se juegan), y la funcion nunca
// truena por datos incompletos: si falta algo, esa parte simplemente no suma.

import { buildBracket } from './bracket.js'
import { calculateGroupTable } from './groupTable.js'

// ---------- Helpers de marcador --------------------------------------------

// Un marcador es valido solo si trae dos numeros no negativos.
function isValidScore(score) {
  return (
    score != null &&
    Number.isFinite(score.hs) && score.hs >= 0 &&
    Number.isFinite(score.as) && score.as >= 0
  )
}

// Signo del resultado de un marcador: 1 si gana home, -1 si gana away, 0 empate.
function outcomeSign(hs, as) {
  return Math.sign(hs - as)
}

// Mapa { codigoEquipo: golesEnTiempoRegular } de un partido del bracket.
function goalsByTeam(match) {
  return { [match.home]: match.hs, [match.away]: match.as }
}

// Mapa { codigoEquipo: golesEnPenales } de un partido del bracket.
function pensByTeam(match) {
  return { [match.home]: match.pens?.hs, [match.away]: match.pens?.as }
}

// Equipo ganador en tiempo regular (por codigo), o null si fue empate.
function regularWinnerTeam(match) {
  if (match.hs > match.as) return match.home
  if (match.hs < match.as) return match.away
  return null
}

// Un partido eliminatorio "se jugo" si conocemos ambos equipos y su marcador.
function isPlayedKnockout(match) {
  return (
    !!match.home && !!match.away &&
    Number.isFinite(match.hs) && Number.isFinite(match.as)
  )
}

// Un partido "se fue a penales" (de verdad): empate en tiempo regular + penales
// con marcador valido y distinto. Sirve tanto para el real como para juzgar lo
// que predijo la persona.
function wentToPens(match) {
  return (
    isPlayedKnockout(match) &&
    match.hs === match.as &&
    match.pens?.went === true &&
    Number.isFinite(match.pens?.hs) &&
    Number.isFinite(match.pens?.as) &&
    match.pens.hs !== match.pens.as
  )
}

// Dos partidos enfrentan al MISMO par de equipos, sin importar quien es local
// y quien visitante (comparamos como conjunto de 2).
function samePair(a, b) {
  return (
    (a.home === b.home && a.away === b.away) ||
    (a.home === b.away && a.away === b.home)
  )
}

// ---------- Helpers de fase de grupos --------------------------------------

// Devuelve el orden resuelto [1o, 2o, 3o, 4o] (codigos de equipo) de un grupo
// segun un conjunto de resultados. Reproduce el mismo criterio que usa
// buildBracket: tabla por puntos/dif/GF y, si hay empate no resuelto en el
// top 3, aplica el orden manual de groupTiebreaks si viene.
export function resolveStandings(results, groupCode, tournament, teams) {
  const table = calculateGroupTable({
    groupCode,
    predictions: results.groupMatches ?? {},
    tournament,
    teams,
  })

  const hasTopThreeTie = table.slice(0, 3).some((r) => r.tied)
  const userOrder = results.groupTiebreaks?.[groupCode]

  let resolved = table
  if (
    hasTopThreeTie &&
    Array.isArray(userOrder) &&
    userOrder.length === 4
  ) {
    const mapped = userOrder.map((code) => table.find((r) => r.code === code))
    if (mapped.every(Boolean)) resolved = mapped
  }

  return resolved.map((r) => r.code)
}

// Un grupo esta "completo" si sus 6 partidos ya tienen marcador real valido.
export function isGroupComplete(results, groupCode, tournament) {
  const matches = tournament.groupMatches.filter((m) => m.group === groupCode)
  return (
    matches.length > 0 &&
    matches.every((m) => isValidScore(results.groupMatches?.[m.id]))
  )
}

// Conjunto de equipos que participan en la Ronda de 32 de un bracket.
function r32Teams(bracket) {
  const set = new Set()
  for (const m of bracket.r32) {
    if (m.home) set.add(m.home)
    if (m.away) set.add(m.away)
  }
  return set
}

// Conjunto de equipos que clasificaron como MEJORES TERCEROS segun un bracket
// y sus resultados: el tercero de cada grupo que ademas aparece en la R32.
// (La R32 contiene exactamente los 8 mejores terceros entre los 12.)
function qualifiedThirds(results, bracket, tournament, teams) {
  const inR32 = r32Teams(bracket)
  const thirds = new Set()
  for (const groupCode of Object.keys(tournament.groups)) {
    const standings = resolveStandings(results, groupCode, tournament, teams)
    const third = standings[2]
    if (third && inR32.has(third)) thirds.add(third)
  }
  return thirds
}

// ---------- Helpers de fase eliminatoria -----------------------------------

// Conjunto de equipos que GANARON su llave (status 'decided') en una ronda.
function roundWinners(roundMatches) {
  const set = new Set()
  for (const m of roundMatches) {
    if (m.status === 'decided' && m.winner) set.add(m.winner)
  }
  return set
}

// Metadatos de cada ronda eliminatoria. `advanceTo` es la clave de
// knockoutAdvance que se gana al avanzar DESDE esa ronda (la ronda destino).
// El 3er lugar (THIRD) y la final (FINAL) no otorgan punto de avance: ganar la
// final es "campeon", que se cuenta aparte y nunca se multiplica.
const KO_ROUNDS = [
  { key: 'r32', label: 'R32', advanceTo: 'r16' },
  { key: 'r16', label: 'Octavos', advanceTo: 'qf' },
  { key: 'qf', label: 'Cuartos', advanceTo: 'sf' },
  { key: 'sf', label: 'Semis', advanceTo: 'final' },
  { key: 'third', label: 'Tercer lugar', advanceTo: null },
  { key: 'final', label: 'Final', advanceTo: null },
]

// ---------- API publica -----------------------------------------------------

// Calcula los puntos de una prediccion contra los resultados reales.
//
// Devuelve:
//   {
//     total,                      // suma de todo el breakdown
//     breakdown: {                // puntos por categoria
//       groupMatches, groupTable, knockoutAdvance,
//       knockoutMatch, penalties, multiplierBonus, champion,
//     },
//     items: [                    // detalle linea por linea (para la UI)
//       { category, matchId, label, points, detail },
//     ],
//   }
//
// `multiplierBonus` guarda solo la COPIA EXTRA de los puntos que se duplican
// (la base ya esta contada en sus categorias), para que `total` no haga doble
// conteo.
export function scorePrediction({
  prediction = {},
  realResults = {},
  tournament,
  teams = {},
  annexCOptions = [],
  scoring,
}) {
  const items = []
  const breakdown = {
    groupMatches: 0,
    groupTable: 0,
    knockoutAdvance: 0,
    knockoutMatch: 0,
    penalties: 0,
    multiplierBonus: 0,
    champion: 0,
  }

  // Construimos ambos brackets con la misma herramienta. El "real" sale de
  // tratar los resultados reales como si fueran una prediccion.
  const predBracket = buildBracket({
    tournament,
    teams,
    annexCOptions,
    predictions: prediction,
  })
  const realBracket = buildBracket({
    tournament,
    teams,
    annexCOptions,
    predictions: realResults,
  })

  // ===== A) FASE DE GRUPOS - cada partido con resultado real =====
  for (const match of tournament.groupMatches) {
    const real = realResults.groupMatches?.[match.id]
    if (!isValidScore(real)) continue // todavia no se juega: no suma

    const pred = prediction.groupMatches?.[match.id]
    const label = `${match.home} vs ${match.away}`

    if (!isValidScore(pred)) {
      items.push({
        category: 'groupMatches',
        matchId: match.id,
        label,
        points: 0,
        detail: 'Sin prediccion',
        status: 'no-prediction',
        home: match.home,
        away: match.away,
        prediction: null,
        actual: { hs: real.hs, as: real.as },
      })
      continue
    }

    let points = 0
    let detail = 'Marcador fallado'
    let status = 'miss'
    if (pred.hs === real.hs && pred.as === real.as) {
      // El marcador exacto YA incluye el resultado; no se suma outcome aparte.
      points = scoring.groupMatch.exactScore
      detail = 'Marcador exacto'
      status = 'exact'
    } else if (outcomeSign(pred.hs, pred.as) === outcomeSign(real.hs, real.as)) {
      points = scoring.groupMatch.outcome
      detail = 'Resultado acertado'
      status = 'outcome'
    }

    breakdown.groupMatches += points
    items.push({
      category: 'groupMatches',
      matchId: match.id,
      label,
      points,
      detail,
      status,
      home: match.home,
      away: match.away,
      prediction: { hs: pred.hs, as: pred.as },
      actual: { hs: real.hs, as: real.as },
    })
  }

  // ===== B) FASE DE GRUPOS - tabla de cada grupo =====
  // Solo evaluamos grupos cuyos 6 partidos ya tengan resultado real.
  for (const groupCode of Object.keys(tournament.groups)) {
    if (!isGroupComplete(realResults, groupCode, tournament)) continue

    const predStandings = resolveStandings(prediction, groupCode, tournament, teams)
    const realStandings = resolveStandings(realResults, groupCode, tournament, teams)

    // B.1) Clasifica (1o o 2o): por cada equipo que la persona puso en el top 2
    //      y que realmente quedo en el top 2 de ese grupo.
    const realTop2 = new Set(realStandings.slice(0, 2))
    for (const code of predStandings.slice(0, 2)) {
      if (code && realTop2.has(code)) {
        breakdown.groupTable += scoring.groupTable.advances
        items.push({
          category: 'groupTable',
          matchId: `grupo-${groupCode}`,
          label: `${code} clasifica (Grupo ${groupCode})`,
          points: scoring.groupTable.advances,
          detail: 'Clasifica (1o/2o)',
          status: 'advances',
          team: code,
          group: groupCode,
        })
      }
    }

    // B.2) Posicion exacta (1o/2o/3o/4o): por cada posicion cuyo equipo predicho
    //      coincide con el real.
    for (let i = 0; i < 4; i++) {
      const code = predStandings[i]
      if (code && code === realStandings[i]) {
        breakdown.groupTable += scoring.groupTable.exactPosition
        items.push({
          category: 'groupTable',
          matchId: `grupo-${groupCode}`,
          label: `${code} en posicion ${i + 1} (Grupo ${groupCode})`,
          points: scoring.groupTable.exactPosition,
          detail: `Posicion exacta (${i + 1}o)`,
          status: 'exact-position',
          team: code,
          group: groupCode,
          position: i + 1,
        })
      }
    }
  }

  // B.3) Clasifica como MEJOR TERCERO: solo se puede calcular cuando TODA la
  //      fase de grupos esta jugada (los 72 partidos), porque rankear los 12
  //      terceros entre si es cross-grupo. Si no, esta sub-parte vale 0.
  const allGroupsComplete = Object.keys(tournament.groups).every((g) =>
    isGroupComplete(realResults, g, tournament),
  )
  if (allGroupsComplete) {
    const predThirds = qualifiedThirds(prediction, predBracket, tournament, teams)
    const realThirds = qualifiedThirds(realResults, realBracket, tournament, teams)
    for (const code of predThirds) {
      if (realThirds.has(code)) {
        breakdown.groupTable += scoring.groupTable.advances
        items.push({
          category: 'groupTable',
          matchId: 'terceros',
          label: `${code} clasifica como mejor tercero`,
          points: scoring.groupTable.advances,
          detail: 'Tercero clasificado',
          status: 'third',
          team: code,
        })
      }
    }
  }

  // ===== C) ELIMINATORIA - AVANCE (capa por EQUIPO, no por llave) =====
  // Por cada ronda: equipos que la persona hizo ganar SU llave Y que en la
  // realidad ganaron su llave de esa ronda. Suma el punto de la ronda destino.
  for (const r of KO_ROUNDS) {
    if (!r.advanceTo) continue
    const predW = roundWinners(predBracket[r.key])
    const realW = roundWinners(realBracket[r.key])
    const points = scoring.knockoutAdvance[r.advanceTo]
    for (const team of predW) {
      if (realW.has(team)) {
        breakdown.knockoutAdvance += points
        items.push({
          category: 'knockoutAdvance',
          matchId: `avance-${r.advanceTo}`,
          label: `${team} avanza (${r.advanceTo})`,
          points,
          detail: `Avance a ${r.advanceTo}`,
          status: 'advance',
          team,
          round: r.advanceTo,
        })
      }
    }
  }

  // ===== D) ELIMINATORIA - MARCADOR + PENALES, y E) MULTIPLICADOR =====
  // Recorremos los partidos del bracket de la persona y buscamos su "cruce"
  // (mismo par de equipos) en alguna llave REAL de la MISMA ronda.
  for (const r of KO_ROUNDS) {
    const realPlayed = realBracket[r.key].filter(isPlayedKnockout)

    for (const pm of predBracket[r.key]) {
      // La persona debe haber predicho ambos equipos y un marcador.
      if (!pm.home || !pm.away) continue
      if (!Number.isFinite(pm.hs) || !Number.isFinite(pm.as)) continue

      // ¿El cruce existio en la realidad (mismo par, en cualquier llave)?
      const rm = realPlayed.find((x) => samePair(x, pm))
      if (!rm) continue // sin cruce: no hay puntos de marcador (el avance ya se evaluo aparte)

      // --- Marcador en tiempo regular (respetando inversion local/visitante) ---
      const pg = goalsByTeam(pm)
      const rg = goalsByTeam(rm)
      const exactRegular = pg[pm.home] === rg[pm.home] && pg[pm.away] === rg[pm.away]

      let regularPts = 0
      let regularDetail = 'Marcador fallado'
      let regularStatus = 'miss'
      if (exactRegular) {
        regularPts = scoring.knockoutMatch.exactScore // ya incluye resultado
        regularDetail = 'Marcador exacto'
        regularStatus = 'exact'
      } else if (regularWinnerTeam(pm) === regularWinnerTeam(rm)) {
        // Comparamos por EQUIPO (no por posicion): mismo ganador, o ambos empate.
        regularPts = scoring.knockoutMatch.outcome
        regularDetail = 'Resultado acertado'
        regularStatus = 'outcome'
      }
      breakdown.knockoutMatch += regularPts
      // prediction/actual van orientados a la perspectiva de la persona
      // (pm.home vs pm.away). `actual` mapea los goles REALES de ESOS equipos,
      // por si el cruce real venia con local/visitante invertidos.
      items.push({
        category: 'knockoutMatch',
        matchId: pm.id, // la llave de la persona (su perspectiva del bracket)
        realMatchId: rm.id, // la llave real donde se jugo ese cruce
        label: `${pm.home} vs ${pm.away}`,
        points: regularPts,
        detail: regularDetail,
        status: regularStatus,
        round: r.label,
        home: pm.home,
        away: pm.away,
        prediction: { hs: pm.hs, as: pm.as },
        actual: { hs: rg[pm.home], as: rg[pm.away] },
      })

      // --- Penales: solo si el partido REAL se fue a penales ---
      const realPens = wentToPens(rm)
      const predPens = wentToPens(pm)
      let exactPens = false
      let pensPts = 0
      if (realPens) {
        const rp = pensByTeam(rm) // penales reales por equipo
        if (predPens) {
          pensPts += scoring.penalties.wentToPens
          const pp = pensByTeam(pm)
          exactPens = pp[pm.home] === rp[pm.home] && pp[pm.away] === rp[pm.away]
          if (exactPens) pensPts += scoring.penalties.exactPens
        }
        breakdown.penalties += pensPts
        items.push({
          category: 'penalties',
          matchId: pm.id,
          realMatchId: rm.id,
          label: `Penales ${pm.home} vs ${pm.away}`,
          points: pensPts,
          detail: !predPens
            ? 'No predijo penales'
            : exactPens
              ? 'Acerto penales + marcador exacto de pens'
              : 'Acerto que iba a penales',
          status: !predPens ? 'no-pens' : exactPens ? 'exact-pens' : 'went',
          home: pm.home,
          away: pm.away,
          // prediccion de penales (orientada a pm.home/pm.away), o null si no predijo pens.
          prediction: predPens ? { hs: pm.pens.hs, as: pm.pens.as } : null,
          // penales reales mapeados a los equipos de la persona (respeta inversion).
          actual: { hs: rp[pm.home], as: rp[pm.away] },
        })
      }

      // --- E) MULTIPLICADOR x2: partido real a penales donde acerto TODO ---
      // (cruce existio + marcador regular exacto + predijo pens + pens exactos).
      // Se duplican TODOS los puntos de ese partido: avance del equipo que
      // gano + marcador regular + penales. El campeon nunca entra aqui.
      if (realPens && exactRegular && predPens && exactPens) {
        // El punto de avance de ESTE partido (si la ronda lo otorga): como
        // acerto todo, el ganador predicho == ganador real, asi que su avance
        // ya quedo acreditado en la capa C.
        const advancePts = r.advanceTo ? scoring.knockoutAdvance[r.advanceTo] : 0
        const base = advancePts + regularPts + pensPts
        const bonus = base * (scoring.penaltiesMultiplier - 1)
        breakdown.multiplierBonus += bonus
        items.push({
          category: 'multiplierBonus',
          matchId: pm.id,
          realMatchId: rm.id,
          label: `x${scoring.penaltiesMultiplier} ${pm.home} vs ${pm.away}`,
          points: bonus,
          detail: 'Acerto todo en partido a penales (puntos duplicados)',
          status: 'x2',
          factor: scoring.penaltiesMultiplier,
          home: pm.home,
          away: pm.away,
        })
      }
    }
  }

  // ===== F) CAMPEON (aparte, NUNCA se multiplica) =====
  const predChampion = prediction.champion ?? null
  const realChampion = realResults.champion ?? null
  let championStatus = 'pending' // la final aun no se juega / no hay campeon real
  let championPts = 0
  if (realChampion) {
    if (predChampion && predChampion === realChampion) {
      championStatus = 'hit'
      championPts = scoring.champion
    } else {
      championStatus = 'miss'
    }
  }
  breakdown.champion = championPts
  // Emitimos el item siempre que haya algo que mostrar (eleccion o campeon real),
  // para que el detalle pueda mostrar "elegiste X" aunque aun no se sepa o falle.
  if (predChampion || realChampion) {
    items.push({
      category: 'champion',
      matchId: 'champion',
      label: predChampion ? `Campeon ${predChampion}` : 'Campeon (sin eleccion)',
      points: championPts,
      detail:
        championStatus === 'hit'
          ? 'Campeon acertado'
          : championStatus === 'miss'
            ? 'Campeon fallado'
            : 'Por jugar',
      status: championStatus,
      prediction: predChampion,
      actual: realChampion,
    })
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return { total, breakdown, items }
}
