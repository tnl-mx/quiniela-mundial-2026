import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildRealResultsJson } from './realResultsExport.js'
import { buildBracket } from './bracket.js'
import { scorePrediction } from './scoring.js'
import { parseAnnexCcsv } from './annexC.js'

// ---------- Fixtures reales del proyecto ----------
const tournament = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'tournament.json'), 'utf-8'),
)
const teams = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'teams.json'), 'utf-8'),
)
const annexCOptions = parseAnnexCcsv(
  readFileSync(join(process.cwd(), 'public', 'data', 'annex_C_combinations.csv'), 'utf-8'),
)
const scoring = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'data', 'scoring.json'), 'utf-8'),
)

// Grupos "limpios" (mismo esquema que bracket.test.js): el menor indice gana,
// y el 3o-vs-4o usa marcador amplio que varia por grupo para que los 12
// terceros queden con stats distintos -> el bracket resuelve sin empates.
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
    out[m.id] = scoreForGroupMatch(
      g.indexOf(m.home),
      g.indexOf(m.away),
      GROUP_LETTERS.indexOf(m.group),
    )
  }
  return out
}
function build(draft) {
  return buildBracket({ tournament, teams, annexCOptions, predictions: draft })
}

describe('buildRealResultsJson', () => {
  it('arma el formato exacto y el motor de scoring lo consume (round-trip)', () => {
    // Borrador: grupos completos + una llave R32 capturada con penales.
    const draft0 = {
      groupMatches: cleanGroupMatches(),
      knockout: {},
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
    }
    const m73 = build(draft0).r32.find((m) => m.id === 'M73')
    const draft = {
      ...draft0,
      knockout: {
        M73: { home: m73.home, away: m73.away, hs: 1, as: 1, pens: { went: true, hs: 4, as: 3 } },
      },
    }
    const bracket = build(draft)
    const json = buildRealResultsJson({ draft, bracket })

    // --- formato 1:1 con lo que espera el motor ---
    expect(Object.keys(json.groupMatches)).toHaveLength(72)
    expect(json.groupMatches.A1).toEqual({ hs: expect.any(Number), as: expect.any(Number) })
    expect(json.knockout.M73).toEqual({
      home: m73.home,
      away: m73.away,
      hs: 1,
      as: 1,
      pens: { went: true, hs: 4, as: 3 },
    })
    expect(json.champion).toBeNull() // final no capturada
    expect(json.awards).toEqual({})

    // --- round-trip: scoring consume el JSON sin error ---
    const prediction = { groupMatches: cleanGroupMatches(), knockout: {}, champion: null }
    const result = scorePrediction({
      prediction,
      realResults: json,
      tournament,
      teams,
      annexCOptions,
      scoring,
    })
    expect(typeof result.total).toBe('number')
    // La prediccion clava todos los marcadores de grupo -> 72 * exactScore.
    expect(result.breakdown.groupMatches).toBe(72 * scoring.groupMatch.exactScore)
  })

  it('EXCLUYE llaves stale (marcador aplicado a equipos que ya cambiaron)', () => {
    // Guardamos M73 con equipos FALSOS; el bracket vivo la resuelve a otros.
    const draft = {
      groupMatches: cleanGroupMatches(),
      knockout: { M73: { home: 'XXX', away: 'YYY', hs: 2, as: 0 } },
      groupTiebreaks: {},
      thirdPlaceTiebreaks: [],
    }
    const bracket = build(draft)
    const json = buildRealResultsJson({ draft, bracket })
    // No se exporta: el marcador no corresponde a los equipos reales de la llave.
    expect(json.knockout.M73).toBeUndefined()
  })

  it('no truena con borrador vacio', () => {
    const draft = { groupMatches: {}, knockout: {}, groupTiebreaks: {}, thirdPlaceTiebreaks: [] }
    const json = buildRealResultsJson({ draft, bracket: build(draft) })
    expect(json.groupMatches).toEqual({})
    expect(json.awards).toEqual({})
  })
})
