import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  randomScore,
  pickWeighted,
  fillGroupAtRandom,
  fillAllRemainingAtRandom,
  autoResolveTieIfNeeded,
  randomPenalties,
  fillBracketAtRandom,
  fillKnockoutRoundAtRandom,
  fillUpToPhase,
  SCORE_WEIGHTS,
} from './randomFill.js'
import { buildBracket } from './bracket.js'
import { parseAnnexCcsv } from './annexC.js'

// ============ Distribucion de goles ============
//
// El usuario quiso pesos sesgados a pocos goles. Verificamos sobre 10000
// muestras que la TENDENCIA sea la esperada (sin chequear valores exactos
// porque hay aleatoriedad real).
const SAMPLES = 10000

describe('randomScore', () => {
  it('promedio de goles claramente < 2 sobre muchas muestras (sesgo a pocos goles)', () => {
    let totalGoals = 0
    let totalSides = 0
    for (let i = 0; i < SAMPLES; i++) {
      const s = randomScore()
      totalGoals += s.hs + s.as
      totalSides += 2
    }
    const avgPerSide = totalGoals / totalSides
    // Esperado teorico ~1.46. Damos margen para variacion aleatoria.
    expect(avgPerSide).toBeLessThan(2)
    expect(avgPerSide).toBeGreaterThan(0.5)
  })

  it('la mayoria de marcadores son 0, 1 o 2 goles por equipo (>70%)', () => {
    let lowCount = 0
    let totalSides = 0
    for (let i = 0; i < SAMPLES; i++) {
      const s = randomScore()
      if (s.hs <= 2) lowCount++
      if (s.as <= 2) lowCount++
      totalSides += 2
    }
    // Esperado teorico: 80% (28+30+22). Margen seguro: > 70%.
    expect(lowCount / totalSides).toBeGreaterThan(0.7)
  })

  it('7 goles es raro (< 1% de las muestras)', () => {
    let extremeCount = 0
    let totalSides = 0
    for (let i = 0; i < SAMPLES; i++) {
      const s = randomScore()
      if (s.hs === 7) extremeCount++
      if (s.as === 7) extremeCount++
      totalSides += 2
    }
    // Esperado teorico: 0.2%. Margen: < 1%.
    expect(extremeCount / totalSides).toBeLessThan(0.01)
  })

  it('respeta el rango 0..7 (nunca devuelve goles fuera)', () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomScore()
      expect(s.hs).toBeGreaterThanOrEqual(0)
      expect(s.hs).toBeLessThanOrEqual(7)
      expect(s.as).toBeGreaterThanOrEqual(0)
      expect(s.as).toBeLessThanOrEqual(7)
    }
  })
})

// ============ pickWeighted determinismo con random custom ============
describe('pickWeighted', () => {
  it('con random fijo cerca de 0 elige el primer indice', () => {
    expect(pickWeighted(SCORE_WEIGHTS, () => 0)).toBe(0)
    expect(pickWeighted(SCORE_WEIGHTS, () => 0.0001)).toBe(0)
  })

  it('con random cerca de 1 elige uno de los ultimos indices', () => {
    // Sumamos pesos: 28+30+22+12+5+2+0.8+0.2 = 100
    // 0.999 * 100 = 99.9 -> queda en peso de 7 (0.2 disponible: 99.8..100)
    expect(pickWeighted(SCORE_WEIGHTS, () => 0.999)).toBe(7)
  })
})

// ============ Helpers de fill ============
const tournament = {
  groups: { A: ['T1', 'T2', 'T3', 'T4'] },
  groupMatches: [
    { id: 'A1', group: 'A', home: 'T1', away: 'T2' },
    { id: 'A2', group: 'A', home: 'T3', away: 'T4' },
    { id: 'A3', group: 'A', home: 'T1', away: 'T3' },
    { id: 'A4', group: 'A', home: 'T4', away: 'T2' },
    { id: 'A5', group: 'A', home: 'T4', away: 'T1' },
    { id: 'A6', group: 'A', home: 'T2', away: 'T3' },
  ],
}

describe('fillGroupAtRandom', () => {
  it('rellena solo los partidos no capturados del grupo', () => {
    const predictions = {
      groupMatches: {
        A1: { hs: 2, as: 1 }, // ya capturado
        A3: { hs: 0, as: 0 }, // ya capturado (0-0 cuenta)
      },
    }
    const updates = fillGroupAtRandom({
      groupCode: 'A',
      tournament,
      predictions,
    })
    expect(Object.keys(updates).sort()).toEqual(['A2', 'A4', 'A5', 'A6'])
    // No incluye los ya capturados.
    expect(updates).not.toHaveProperty('A1')
    expect(updates).not.toHaveProperty('A3')
  })

  it('si el grupo esta completo, no rellena nada', () => {
    const predictions = {
      groupMatches: {
        A1: { hs: 1, as: 0 }, A2: { hs: 0, as: 0 },
        A3: { hs: 2, as: 1 }, A4: { hs: 1, as: 1 },
        A5: { hs: 0, as: 2 }, A6: { hs: 3, as: 0 },
      },
    }
    const updates = fillGroupAtRandom({
      groupCode: 'A',
      tournament,
      predictions,
    })
    expect(updates).toEqual({})
  })
})

describe('fillAllRemainingAtRandom', () => {
  it('rellena todos los no capturados de todos los grupos del torneo', () => {
    const predictions = {
      groupMatches: {
        A1: { hs: 1, as: 0 }, // unico capturado
      },
    }
    const updates = fillAllRemainingAtRandom({ tournament, predictions })
    expect(Object.keys(updates).sort()).toEqual(['A2', 'A3', 'A4', 'A5', 'A6'])
  })
})

// ============ autoResolveTieIfNeeded ============
describe('autoResolveTieIfNeeded', () => {
  const teams = {
    T1: { fifaRank: 10 },
    T2: { fifaRank: 20 },
    T3: { fifaRank: 30 },
    T4: { fifaRank: 40 },
  }

  it('devuelve null cuando NO hay empate en top 3', () => {
    // Resultados claros: T1 gana todo, T2 segundo, T3 tercero, T4 ultimo.
    const predictions = {
      groupMatches: {
        A1: { hs: 1, as: 0 }, // T1 vence T2
        A2: { hs: 1, as: 0 }, // T3 vence T4
        A3: { hs: 1, as: 0 }, // T1 vence T3
        A4: { hs: 0, as: 1 }, // T2 vence T4
        A5: { hs: 0, as: 1 }, // T1 vence T4
        A6: { hs: 1, as: 0 }, // T2 vence T3
      },
    }
    expect(
      autoResolveTieIfNeeded({ groupCode: 'A', tournament, teams, predictions }),
    ).toBeNull()
  })

  it('devuelve el orden provisional FIFA cuando hay empate exacto en top 3', () => {
    // Construimos un empate exacto entre T2 y T3 en posiciones 2-3.
    // T1 gana todo (9 pts). T2 y T3 quedan iguales en pts/GD/GF. T4 pierde todo.
    // Diseno:
    //   A1 T1-T2: 2-0 (T1 W)
    //   A2 T3-T4: 1-0 (T3 W)
    //   A3 T1-T3: 2-0 (T1 W)
    //   A4 T4-T2: 0-1 (T2 W)
    //   A5 T4-T1: 0-2 (T1 W)
    //   A6 T2-T3: 1-1 (D)
    // Stats:
    //   T1: 3W, GF 6, GC 0, GD +6, 9 pts (1ro)
    //   T2: A1 L (0-2), A4 W (1-0), A6 D (1-1) -> 1W 1D 1L, GF 2, GC 3, GD -1, 4 pts
    //   T3: A2 W (1-0), A3 L (0-2), A6 D (1-1) -> 1W 1D 1L, GF 2, GC 3, GD -1, 4 pts
    //   T4: A2 L (0-1), A4 L (0-1), A5 L (0-2) -> 3L, GF 0, GC 4, GD -4, 0 pts
    // T2 vs T3 EXACTAMENTE empatados. FIFA: T2=20 mejor que T3=30 -> T2 primero.
    const predictions = {
      groupMatches: {
        A1: { hs: 2, as: 0 },
        A2: { hs: 1, as: 0 },
        A3: { hs: 2, as: 0 },
        A4: { hs: 0, as: 1 },
        A5: { hs: 0, as: 2 },
        A6: { hs: 1, as: 1 },
      },
    }
    const order = autoResolveTieIfNeeded({
      groupCode: 'A', tournament, teams, predictions,
    })
    expect(order).not.toBeNull()
    expect(order).toEqual(['T1', 'T2', 'T3', 'T4'])
  })
})

// ============ randomPenalties ============
describe('randomPenalties', () => {
  const SAMPLES = 5000

  it('NUNCA empata', () => {
    for (let i = 0; i < SAMPLES; i++) {
      const p = randomPenalties()
      expect(p.hs).not.toBe(p.as)
    }
  })

  it('ganador entre 3 y 5 goles', () => {
    for (let i = 0; i < SAMPLES; i++) {
      const p = randomPenalties()
      const winner = Math.max(p.hs, p.as)
      expect(winner).toBeGreaterThanOrEqual(3)
      expect(winner).toBeLessThanOrEqual(5)
    }
  })

  it('perdedor entre 0 y (ganador - 1)', () => {
    for (let i = 0; i < SAMPLES; i++) {
      const p = randomPenalties()
      const winner = Math.max(p.hs, p.as)
      const loser = Math.min(p.hs, p.as)
      expect(loser).toBeGreaterThanOrEqual(0)
      expect(loser).toBeLessThan(winner)
    }
  })

  it('diferencias 1 o 2 son mayoria (>70%)', () => {
    let smallDiff = 0
    for (let i = 0; i < SAMPLES; i++) {
      const p = randomPenalties()
      const diff = Math.abs(p.hs - p.as)
      if (diff <= 2) smallDiff++
    }
    // Teorico: ~80% (diff 1: 50% + diff 2: 30%). Margen seguro: > 70%.
    expect(smallDiff / SAMPLES).toBeGreaterThan(0.7)
  })

  it('mas o menos balanceado entre home y away (no siempre gana home)', () => {
    let homeWins = 0
    for (let i = 0; i < SAMPLES; i++) {
      const p = randomPenalties()
      if (p.hs > p.as) homeWins++
    }
    const ratio = homeWins / SAMPLES
    // Esperado ~50%. Margen amplio.
    expect(ratio).toBeGreaterThan(0.4)
    expect(ratio).toBeLessThan(0.6)
  })
})

// ============ fillBracketAtRandom (test de integracion) ============
//
// Partiendo de una prediccion de grupos completa, llenamos el bracket al
// azar y verificamos que se llega a un campeon valido y a CERO llaves
// pendientes/empatadas sin pens.
describe('fillBracketAtRandom (integracion)', () => {
  const REAL_TOURNAMENT = JSON.parse(
    readFileSync(
      join(process.cwd(), 'public', 'data', 'tournament.json'),
      'utf-8',
    ),
  )
  const REAL_TEAMS = JSON.parse(
    readFileSync(
      join(process.cwd(), 'public', 'data', 'teams.json'),
      'utf-8',
    ),
  )
  const REAL_ANNEX_C = parseAnnexCcsv(
    readFileSync(
      join(process.cwd(), 'public', 'data', 'annex_C_combinations.csv'),
      'utf-8',
    ),
  )

  // Helper: marcador "claro" para cada partido de grupo (similar al de
  // bracket.test.js). T1 gana todo, T2 segundo, T3 tercero, T4 ultimo.
  // El tercero tiene un GD distintivo por grupo para que NO haya empates
  // entre terceros.
  const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']
  function scoreForGroupMatch(homeIdx, awayIdx, groupIdx) {
    if (homeIdx === 2 && awayIdx === 3) return { hs: 12 - groupIdx, as: 0 }
    if (homeIdx === 3 && awayIdx === 2) return { hs: 0, as: 12 - groupIdx }
    if (homeIdx < awayIdx) return { hs: 1, as: 0 }
    return { hs: 0, as: 1 }
  }
  function makeCompleteGroupsPrediction() {
    const groupMatches = {}
    for (const match of REAL_TOURNAMENT.groupMatches) {
      const teamsInGroup = REAL_TOURNAMENT.groups[match.group]
      const homeIdx = teamsInGroup.indexOf(match.home)
      const awayIdx = teamsInGroup.indexOf(match.away)
      const groupIdx = GROUP_LETTERS.indexOf(match.group)
      groupMatches[match.id] = scoreForGroupMatch(homeIdx, awayIdx, groupIdx)
    }
    return groupMatches
  }

  it('partiendo de grupos completos llena el bracket hasta el campeon', () => {
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {},
      champion: null,
    }

    const { knockoutUpdates, champion } = fillBracketAtRandom({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
    })

    // Aplicamos los updates a la prediccion.
    const finalPredictions = {
      ...predictions,
      knockout: knockoutUpdates,
      champion,
    }

    // Verificamos el resultado via buildBracket.
    const bracket = buildBracket({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions: finalPredictions,
    })

    // El campeon existe y es un equipo valido.
    expect(bracket.champion).toBeTruthy()
    expect(REAL_TEAMS[bracket.champion]).toBeDefined()
    expect(bracket.champion).toBe(champion)

    // Ningun partido eliminatorio queda en estado intermedio.
    for (const round of ['r32', 'r16', 'qf', 'sf', 'third', 'final']) {
      for (const m of bracket[round]) {
        expect(m.status).toBe('decided')
      }
    }

    // Las llaves que terminaron empatadas tienen pens con ganador.
    for (const round of ['r32', 'r16', 'qf', 'sf', 'third', 'final']) {
      for (const m of bracket[round]) {
        if (m.hs === m.as) {
          expect(m.pens).toBeDefined()
          expect(m.pens.went).toBe(true)
          expect(m.pens.hs).not.toBe(m.pens.as)
        }
      }
    }

    // Issues debe estar vacio.
    expect(bracket.issues).toEqual([])
  })

  it('respeta las llaves ya capturadas por el usuario (no las sobrescribe)', () => {
    // Capturamos manualmente M73 con un resultado especifico.
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {
        M73: { home: 'ZZZ', away: 'YYY', hs: 7, as: 0 },
        // home/away no importan para el motor; lo que cuenta es hs/as.
      },
      champion: null,
    }

    const { knockoutUpdates } = fillBracketAtRandom({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
    })

    // M73 NO debe aparecer en knockoutUpdates (ya estaba 'decided').
    expect(knockoutUpdates).not.toHaveProperty('M73')

    // El score original se mantiene en la prediccion final.
    expect(predictions.knockout.M73.hs).toBe(7)
    expect(predictions.knockout.M73.as).toBe(0)
  })

  // ---- Relleno por ronda especifica ----
  const R32_IDS = [
    'M73','M74','M75','M76','M77','M78','M79','M80',
    'M81','M82','M83','M84','M85','M86','M87','M88',
  ]

  it('fillKnockoutRoundAtRandom rellena SOLO la ronda pedida (R32)', () => {
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {},
      champion: null,
    }

    const { knockoutUpdates } = fillKnockoutRoundAtRandom({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      round: 'r32',
    })

    // Las 16 llaves de R32 y NINGUNA de rondas posteriores.
    expect(Object.keys(knockoutUpdates).sort()).toEqual([...R32_IDS].sort())
    for (const id of Object.keys(knockoutUpdates)) {
      expect(R32_IDS).toContain(id)
    }
    // Cada update guarda la fotografia home/away.
    for (const upd of Object.values(knockoutUpdates)) {
      expect(upd.home).toBeTruthy()
      expect(upd.away).toBeTruthy()
    }
  })

  it('NO rellena una ronda cuya ronda previa no esta resuelta (R16 sin R32)', () => {
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {}, // R32 sin capturar -> R16 esta 'pending'
      champion: null,
    }

    const { knockoutUpdates } = fillKnockoutRoundAtRandom({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      round: 'r16',
    })

    // No se puede saber quien juega: no rellena nada.
    expect(knockoutUpdates).toEqual({})
  })

  it('respeta las llaves ya capturadas de la ronda (no las sobrescribe)', () => {
    // Capturamos M73 a mano; al rellenar R32 no debe reaparecer.
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {
        M73: { home: 'ZZZ', away: 'YYY', hs: 3, as: 1 },
      },
      champion: null,
    }

    const { knockoutUpdates } = fillKnockoutRoundAtRandom({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      round: 'r32',
    })

    expect(knockoutUpdates).not.toHaveProperty('M73')
    // El resto de R32 (15 llaves) si se rellena.
    expect(Object.keys(knockoutUpdates)).toHaveLength(15)
  })

  // ---- fillUpToPhase (relleno encadenado "hasta X") ----
  it('fillUpToPhase "groups" rellena solo grupos (sin knockout)', () => {
    const predictions = {
      groupMatches: {}, // grupos vacios
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {},
      champion: null,
    }

    const { matchUpdates, knockoutUpdates, champion } = fillUpToPhase({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      target: 'groups',
    })

    // Rellena los 72 partidos de grupos y NADA de knockout.
    expect(Object.keys(matchUpdates)).toHaveLength(REAL_TOURNAMENT.groupMatches.length)
    expect(knockoutUpdates).toEqual({})
    expect(champion).toBeNull()
  })

  it('fillUpToPhase "qf" rellena grupos + R32 + Octavos + Cuartos, sin SF/final', () => {
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {},
      champion: null,
    }

    const { knockoutUpdates, champion } = fillUpToPhase({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      target: 'qf',
    })

    // R32 (16) + R16 (8) + QF (4) = 28 llaves. Nada de SF/third/final.
    expect(Object.keys(knockoutUpdates)).toHaveLength(28)
    for (const id of ['M101', 'M102', 'M103', 'M104']) {
      expect(knockoutUpdates).not.toHaveProperty(id)
    }
    // Sin final resuelta, no hay campeon todavia.
    expect(champion).toBeNull()
  })

  it('fillUpToPhase "final" completa TODO y corona campeon', () => {
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: {},
      champion: null,
    }

    const { knockoutUpdates, champion } = fillUpToPhase({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      target: 'final',
    })

    // 16+8+4+2+1(third)+1(final) = 32 llaves.
    expect(Object.keys(knockoutUpdates)).toHaveLength(32)
    expect(champion).toBeTruthy()
    expect(REAL_TEAMS[champion]).toBeDefined()
  })

  it('fillUpToPhase respeta lo ya capturado (no sobrescribe)', () => {
    const predictions = {
      groupMatches: makeCompleteGroupsPrediction(),
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
      knockout: { M73: { home: 'ZZZ', away: 'YYY', hs: 5, as: 0 } },
      champion: null,
    }

    const { knockoutUpdates } = fillUpToPhase({
      tournament: REAL_TOURNAMENT,
      teams: REAL_TEAMS,
      annexCOptions: REAL_ANNEX_C,
      predictions,
      target: 'r32',
    })

    // M73 ya estaba capturada: no reaparece. Las otras 15 de R32 si.
    expect(knockoutUpdates).not.toHaveProperty('M73')
    expect(Object.keys(knockoutUpdates)).toHaveLength(15)
  })
})
