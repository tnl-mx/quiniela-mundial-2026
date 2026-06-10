import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBracket } from './bracket.js'
import { parseAnnexCcsv, assignThirdPlaceToBracket } from './annexC.js'

// ---------- Fixtures: leemos los datos reales del proyecto -----------------
const tournament = JSON.parse(
  readFileSync(
    join(process.cwd(), 'public', 'data', 'tournament.json'),
    'utf-8',
  ),
)
const teams = JSON.parse(
  readFileSync(
    join(process.cwd(), 'public', 'data', 'teams.json'),
    'utf-8',
  ),
)
const annexCOptions = parseAnnexCcsv(
  readFileSync(
    join(process.cwd(), 'public', 'data', 'annex_C_combinations.csv'),
    'utf-8',
  ),
)

// ---------- Helper: predicciones de grupos sin empates ---------------------
// Idea: en cada grupo [T1, T2, T3, T4] (los 4 equipos en el orden de
// tournament.groups), T1 gana todo, T2 le gana a T3 y T4, T3 le gana a T4,
// T4 pierde todo. Para que cada tercero tenga (GD, GF) distinto, hacemos
// que el partido T3 vs T4 termine con un marcador que varia por grupo:
// (12 - indice_de_grupo) - 0. Asi el tercero de A queda con GF 12, el de
// B con GF 11, ..., y el de L con GF 1. Ordenamiento limpio entre terceros.
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function scoreForGroupMatch(homeIdx, awayIdx, groupIdx) {
  // Caso especial: T3 vs T4 (o T4 vs T3) usa marcador "amplio" que varia
  // por grupo, para que los 12 terceros tengan stats distintos entre si.
  if (homeIdx === 2 && awayIdx === 3) {
    return { hs: 12 - groupIdx, as: 0 }
  }
  if (homeIdx === 3 && awayIdx === 2) {
    return { hs: 0, as: 12 - groupIdx }
  }
  // Caso general: gana el de menor indice, 1-0.
  if (homeIdx < awayIdx) return { hs: 1, as: 0 }
  return { hs: 0, as: 1 }
}

function makeCleanGroupPredictions() {
  const groupMatches = {}
  for (const match of tournament.groupMatches) {
    const teamsInGroup = tournament.groups[match.group]
    const homeIdx = teamsInGroup.indexOf(match.home)
    const awayIdx = teamsInGroup.indexOf(match.away)
    const groupIdx = GROUP_LETTERS.indexOf(match.group)
    groupMatches[match.id] = scoreForGroupMatch(homeIdx, awayIdx, groupIdx)
  }
  return groupMatches
}

// Helper: dado un codigo de equipo, devuelve la letra de su grupo.
function groupOf(teamCode) {
  for (const [g, codes] of Object.entries(tournament.groups)) {
    if (codes.includes(teamCode)) return g
  }
  return null
}

// Knockout que hace ganar siempre al home 1-0. Cubre TODOS los partidos
// eliminatorios (M73..M104, incluyendo M103 del tercer lugar).
function homeAlwaysWinsKnockout() {
  const ko = {}
  for (let n = 73; n <= 104; n++) {
    ko[`M${n}`] = { hs: 1, as: 0 }
  }
  return ko
}

// Helper: busca un partido por id en cualquier ronda del bracket.
function findMatch(bracket, id) {
  for (const round of [
    bracket.r32, bracket.r16, bracket.qf, bracket.sf, bracket.third, bracket.final,
  ]) {
    const m = round.find((x) => x.id === id)
    if (m) return m
  }
  return null
}

// ---------- Tests ----------------------------------------------------------

describe('buildBracket', () => {
  it('a) construye la R32 correctamente segun el cuadro 12.6 y la asignacion del Annex C', () => {
    const predictions = { groupMatches: makeCleanGroupPredictions() }
    const bracket = buildBracket({
      tournament, teams, annexCOptions, predictions,
    })

    // Sin predicciones de eliminatoria, cada partido R32 queda awaiting-score
    // pero con home/away ya resueltos.
    expect(bracket.r32).toHaveLength(16)
    expect(bracket.issues).toEqual([])

    // Resultados esperados por grupo: T1=primero, T2=segundo, T3=tercero.
    const expected = {}
    for (const g of GROUP_LETTERS) {
      const t = tournament.groups[g]
      expected[g] = { first: t[0], second: t[1], third: t[2] }
    }

    // Slots fijos (los que NO involucran terceros): los verificamos uno por uno.
    const fixedSlots = [
      ['M73', expected.A.second, expected.B.second],
      ['M75', expected.F.first,  expected.C.second],
      ['M76', expected.C.first,  expected.F.second],
      ['M78', expected.E.second, expected.I.second],
      ['M83', expected.K.second, expected.L.second],
      ['M84', expected.H.first,  expected.J.second],
      ['M86', expected.J.first,  expected.H.second],
      ['M88', expected.D.second, expected.G.second],
    ]
    for (const [id, home, away] of fixedSlots) {
      const m = bracket.r32.find((x) => x.id === id)
      expect(m).toBeDefined()
      expect(m.home).toBe(home)
      expect(m.away).toBe(away)
      expect(m.status).toBe('awaiting-score')
    }

    // Slots con tercero: con nuestro setup los 8 mejores son los de A..H, asi
    // que el Annex C deberia darnos una asignacion concreta. La recalculamos
    // aqui mismo para no depender de constantes del codigo de produccion.
    const qualifiedGroups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    const { pairings } = assignThirdPlaceToBracket(qualifiedGroups, annexCOptions)

    const thirdSlots = [
      { id: 'M74', winnerGroup: 'E' },
      { id: 'M77', winnerGroup: 'I' },
      { id: 'M79', winnerGroup: 'A' },
      { id: 'M80', winnerGroup: 'L' },
      { id: 'M81', winnerGroup: 'D' },
      { id: 'M82', winnerGroup: 'G' },
      { id: 'M85', winnerGroup: 'B' },
      { id: 'M87', winnerGroup: 'K' },
    ]
    for (const { id, winnerGroup } of thirdSlots) {
      const m = bracket.r32.find((x) => x.id === id)
      expect(m).toBeDefined()
      expect(m.home).toBe(expected[winnerGroup].first)
      const thirdGroupLetter = pairings[winnerGroup].replace(/^3/, '')
      expect(m.away).toBe(expected[thirdGroupLetter].third)
      expect(m.status).toBe('awaiting-score')
    }
  })

  it('b) ningun partido de R32 enfrenta a dos equipos del mismo grupo', () => {
    const predictions = { groupMatches: makeCleanGroupPredictions() }
    const bracket = buildBracket({
      tournament, teams, annexCOptions, predictions,
    })

    for (const m of bracket.r32) {
      const gh = groupOf(m.home)
      const ga = groupOf(m.away)
      expect(gh).not.toBeNull()
      expect(ga).not.toBeNull()
      expect(gh).not.toBe(ga)
    }
  })

  it('c) propaga los ganadores correctamente desde R32 hasta el campeon', () => {
    const predictions = {
      groupMatches: makeCleanGroupPredictions(),
      knockout: homeAlwaysWinsKnockout(),
    }
    const bracket = buildBracket({
      tournament, teams, annexCOptions, predictions,
    })

    expect(bracket.issues).toEqual([])

    // Como home siempre gana 1-0, cada partido queda decidido y winner=home.
    for (const round of [
      bracket.r32, bracket.r16, bracket.qf, bracket.sf, bracket.third, bracket.final,
    ]) {
      for (const m of round) {
        expect(m.status).toBe('decided')
        expect(m.winner).toBe(m.home)
        expect(m.loser).toBe(m.away)
      }
    }

    // El campeon es el home (=ganador) de la final.
    expect(bracket.champion).toBe(bracket.final[0].winner)
    expect(bracket.champion).not.toBeNull()
  })

  it('d) empate en eliminatoria sin penales: se senala como no resuelto y NO se inventa ganador', () => {
    const predictions = {
      groupMatches: makeCleanGroupPredictions(),
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M73: { hs: 1, as: 1 }, // empate sin pens
      },
    }
    const bracket = buildBracket({
      tournament, teams, annexCOptions, predictions,
    })

    const m73 = bracket.r32.find((x) => x.id === 'M73')
    expect(m73.status).toBe('tied-needs-pens')
    expect(m73.winner).toBeNull()
    expect(m73.loser).toBeNull()

    // M90 depende del ganador de M73: como no hay ganador, queda pending.
    const m90 = bracket.r16.find((x) => x.id === 'M90')
    expect(m90.home).toBeNull()
    expect(m90.status).toBe('pending')
  })

  it('e) empate en eliminatoria CON penales: el ganador por pens avanza', () => {
    const predictions = {
      groupMatches: makeCleanGroupPredictions(),
      knockout: {
        ...homeAlwaysWinsKnockout(),
        // M73 empata 1-1 en tiempo regular; home gana penales 5-4.
        M73: { hs: 1, as: 1, pens: { went: true, hs: 5, as: 4 } },
      },
    }
    const bracket = buildBracket({
      tournament, teams, annexCOptions, predictions,
    })

    const m73 = bracket.r32.find((x) => x.id === 'M73')
    expect(m73.status).toBe('decided')
    expect(m73.winner).toBe(m73.home)
    expect(m73.loser).toBe(m73.away)

    // M90 ahora si tiene home (= ganador de M73).
    const m90 = bracket.r16.find((x) => x.id === 'M90')
    expect(m90.home).toBe(m73.winner)
    expect(m90.status).toBe('decided') // homeAlwaysWinsKnockout asigna 1-0
  })

  it('f) integridad de la cadena completa: R32 -> Octavos -> Cuartos -> Semis -> Final + tercer lugar', () => {
    const predictions = {
      groupMatches: makeCleanGroupPredictions(),
      knockout: homeAlwaysWinsKnockout(),
    }
    const bracket = buildBracket({
      tournament, teams, annexCOptions, predictions,
    })

    expect(bracket.issues).toEqual([])

    const winnerOf = (id) => findMatch(bracket, id)?.winner
    const loserOf = (id) => findMatch(bracket, id)?.loser

    // Octavos: cada partido toma a los ganadores correctos de R32 (cuadro 12.7).
    const r16Spec = [
      ['M89', 'M74', 'M77'],
      ['M90', 'M73', 'M75'],
      ['M91', 'M76', 'M78'],
      ['M92', 'M79', 'M80'],
      ['M93', 'M83', 'M84'],
      ['M94', 'M81', 'M82'],
      ['M95', 'M86', 'M88'],
      ['M96', 'M85', 'M87'],
    ]
    for (const [id, srcH, srcA] of r16Spec) {
      const m = bracket.r16.find((x) => x.id === id)
      expect(m.home).toBe(winnerOf(srcH))
      expect(m.away).toBe(winnerOf(srcA))
    }

    // Cuartos (cuadro 12.8).
    const qfSpec = [
      ['M97',  'M89', 'M90'],
      ['M98',  'M93', 'M94'],
      ['M99',  'M91', 'M92'],
      ['M100', 'M95', 'M96'],
    ]
    for (const [id, srcH, srcA] of qfSpec) {
      const m = bracket.qf.find((x) => x.id === id)
      expect(m.home).toBe(winnerOf(srcH))
      expect(m.away).toBe(winnerOf(srcA))
    }

    // Semis (cuadro 12.9).
    expect(bracket.sf.find((x) => x.id === 'M101').home).toBe(winnerOf('M97'))
    expect(bracket.sf.find((x) => x.id === 'M101').away).toBe(winnerOf('M98'))
    expect(bracket.sf.find((x) => x.id === 'M102').home).toBe(winnerOf('M99'))
    expect(bracket.sf.find((x) => x.id === 'M102').away).toBe(winnerOf('M100'))

    // Tercer lugar (cuadro 12.10): perdedores de semis.
    const m103 = bracket.third[0]
    expect(m103.id).toBe('M103')
    expect(m103.home).toBe(loserOf('M101'))
    expect(m103.away).toBe(loserOf('M102'))
    expect(m103.status).toBe('decided')

    // Final (cuadro 12.11).
    const m104 = bracket.final[0]
    expect(m104.id).toBe('M104')
    expect(m104.home).toBe(winnerOf('M101'))
    expect(m104.away).toBe(winnerOf('M102'))
    expect(m104.status).toBe('decided')

    expect(bracket.champion).toBe(m104.winner)
  })
})
