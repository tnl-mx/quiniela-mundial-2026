import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CHRONO_IDS,
  TOTAL_MATCHES,
  matchNumber,
  cropRealResults,
  maxPlayedMatch,
  blockEndpoints,
  latestPlayedMatchId,
} from './matchOrder.js'
import { scorePrediction } from './scoring.js'
import { buildBracket } from './bracket.js'
import { parseAnnexCcsv } from './annexC.js'

// Fixtures reales
const tournament = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'tournament.json'), 'utf-8'))
const teams = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'teams.json'), 'utf-8'))
const annexCOptions = parseAnnexCcsv(readFileSync(join(process.cwd(), 'public', 'data', 'annex_C_combinations.csv'), 'utf-8'))
const scoring = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'scoring.json'), 'utf-8'))

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
function scoreForGroupMatch(homeIdx, awayIdx, groupIdx) {
  if (homeIdx === 2 && awayIdx === 3) return { hs: 12 - groupIdx, as: 0 }
  if (homeIdx === 3 && awayIdx === 2) return { hs: 0, as: 12 - groupIdx }
  if (homeIdx < awayIdx) return { hs: 1, as: 0 }
  return { hs: 0, as: 1 }
}
function cleanGroupMatches() {
  const out = {}
  for (const m of tournament.groupMatches) {
    const g = tournament.groups[m.group]
    out[m.id] = scoreForGroupMatch(g.indexOf(m.home), g.indexOf(m.away), GROUP_LETTERS.indexOf(m.group))
  }
  return out
}

describe('CHRONO_IDS / matchNumber', () => {
  it('tiene 104 ids en el orden cronologico correcto', () => {
    expect(CHRONO_IDS).toHaveLength(104)
    expect(TOTAL_MATCHES).toBe(104)
    // Jornada 1: A1,A2,B1,B2,...
    expect(CHRONO_IDS[0]).toBe('A1')
    expect(CHRONO_IDS[1]).toBe('A2')
    expect(CHRONO_IDS[2]).toBe('B1')
    expect(CHRONO_IDS[3]).toBe('B2')
    expect(CHRONO_IDS[23]).toBe('L2') // fin de jornada 1 (match 24)
    // Jornada 2 arranca en match 25
    expect(CHRONO_IDS[24]).toBe('A3')
    // Jornada 3 arranca en match 49
    expect(CHRONO_IDS[48]).toBe('A5')
    // Eliminatoria
    expect(CHRONO_IDS[72]).toBe('M73')
    expect(CHRONO_IDS[103]).toBe('M104')
  })

  it('matchNumber mapea los puntos de control', () => {
    expect(matchNumber('A1')).toBe(1)
    expect(matchNumber('A2')).toBe(2)
    expect(matchNumber('B1')).toBe(3)
    expect(matchNumber('L2')).toBe(24)
    expect(matchNumber('A3')).toBe(25)
    expect(matchNumber('A5')).toBe(49)
    expect(matchNumber('M73')).toBe(73)
    expect(matchNumber('M104')).toBe(104)
    expect(matchNumber('ZZ9')).toBeNull()
  })
})

describe('blockEndpoints', () => {
  it('bloques de 4 solo hasta lo jugado', () => {
    expect(blockEndpoints(12)).toEqual([4, 8, 12])
    expect(blockEndpoints(10)).toEqual([4, 8, 10])
    expect(blockEndpoints(2)).toEqual([2])
    expect(blockEndpoints(0)).toEqual([])
  })
})

describe('cropRealResults + monotonia', () => {
  const full = { groupMatches: cleanGroupMatches(), knockout: {}, champion: null, awards: {} }
  const prediction = { groupMatches: cleanGroupMatches(), knockout: {}, champion: null }

  function totalAt(n) {
    const cropped = cropRealResults(full, n)
    return scorePrediction({ prediction, realResults: cropped, tournament, teams, annexCOptions, scoring }).total
  }

  it('recorta por matchNumber', () => {
    const c4 = cropRealResults(full, 4)
    expect(Object.keys(c4.groupMatches).sort()).toEqual(['A1', 'A2', 'B1', 'B2'])
    const c24 = cropRealResults(full, 24)
    expect(Object.keys(c24.groupMatches)).toHaveLength(24)
  })

  it('el total es monotono no decreciente al avanzar el recorte', () => {
    const t4 = totalAt(4)
    const t24 = totalAt(24)
    const t48 = totalAt(48)
    const t72 = totalAt(72)
    expect(t4).toBeLessThanOrEqual(t24)
    expect(t24).toBeLessThanOrEqual(t48)
    expect(t48).toBeLessThanOrEqual(t72)
    // Con prediccion = realidad, los 4 primeros partidos dan exacto (4 * 3).
    expect(t4).toBe(4 * scoring.groupMatch.exactScore)
  })

  it('maxPlayedMatch detecta el match jugado mas alto', () => {
    expect(maxPlayedMatch(full)).toBe(72) // todos los grupos
    const partial = { groupMatches: { A1: { hs: 1, as: 0 }, B1: { hs: 0, as: 0 } }, knockout: {} }
    expect(maxPlayedMatch(partial)).toBe(3) // B1 = match 3
  })
})

describe('latestPlayedMatchId (ultimo capturado, no el de mayor numero)', () => {
  it('devuelve el ultimo grupo agregado aunque tenga numero de match menor', () => {
    // Capturados en este orden: A1, A2, B1, D1 (match 7), B2 (match 4).
    const rr = {
      groupMatches: {
        A1: { hs: 2, as: 0 },
        A2: { hs: 2, as: 1 },
        B1: { hs: 1, as: 1 },
        D1: { hs: 4, as: 1 },
        B2: { hs: 1, as: 1 },
      },
      knockout: {},
    }
    // El ultimo agregado es B2, aunque D1 tenga numero de match mas alto.
    expect(latestPlayedMatchId(rr)).toBe('B2')
  })

  it('la eliminatoria tiene prioridad sobre grupos', () => {
    const rr = {
      groupMatches: { A1: { hs: 1, as: 0 } },
      knockout: { M73: { home: 'MEX', away: 'KOR', hs: 1, as: 0 } },
    }
    expect(latestPlayedMatchId(rr)).toBe('M73')
  })

  it('null si no hay nada jugado', () => {
    expect(latestPlayedMatchId({ groupMatches: {}, knockout: {} })).toBeNull()
  })

  it('respeta lastMatchId cuando viene (las claves se guardan ordenadas)', () => {
    // Las claves quedan ordenadas (M73, M74, M76) aunque M74 se metio al final.
    const rr = {
      groupMatches: {},
      knockout: {
        M73: { home: 'RSA', away: 'CAN', hs: 0, as: 1 },
        M74: { home: 'GER', away: 'PAR', hs: 1, as: 1, pens: { went: true, hs: 3, as: 4 } },
        M76: { home: 'BRA', away: 'JPN', hs: 2, as: 1 },
      },
      lastMatchId: 'M74',
    }
    // Sin la marca devolveria M76 (ultima clave); con ella, M74.
    expect(latestPlayedMatchId(rr)).toBe('M74')
  })

  it('ignora lastMatchId si apunta a un partido sin marcador valido (fallback)', () => {
    const rr = {
      groupMatches: {},
      knockout: { M73: { home: 'RSA', away: 'CAN', hs: 0, as: 1 } },
      lastMatchId: 'M99', // no existe / sin marcador
    }
    expect(latestPlayedMatchId(rr)).toBe('M73')
  })
})
