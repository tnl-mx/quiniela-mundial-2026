import { describe, it, expect } from 'vitest'
import {
  serializePrediction,
  predictionToJsonString,
  suggestedFileName,
  parseAndValidate,
  SCHEMA_VERSION,
  TOURNAMENT_NAME,
} from './predictionIO.js'

// ---------- Fixture: un estado interno de prediccion representativo --------
// Incluye lo importante: meta, un par de partidos de grupo, un desempate
// manual, y una llave eliminatoria CON home/away/hs/as/pens (la "fotografia").
function makePrediction() {
  return {
    meta: { firstName: 'Ana', lastName: 'López', email: 'ana@ejemplo.com' },
    groupMatches: {
      A1: { hs: 2, as: 1 },
      A2: { hs: 0, as: 0 },
    },
    groupTiebreaks: {
      A: ['MEX', 'KOR', 'CZE', 'RSA'],
    },
    thirdPlaceTiebreaks: [],
    knockout: {
      M73: {
        home: 'MEX',
        away: 'KOR',
        hs: 1,
        as: 1,
        pens: { went: true, hs: 4, as: 3 },
      },
    },
    champion: 'MEX',
    awards: {
      goldenBall: null,
      goldenBoot: null,
      goldenGlove: null,
      youngPlayer: null,
      fairPlay: null,
    },
    wildcards: {},
  }
}

describe('serializePrediction', () => {
  it('produce la estructura del schema v1 con meta completa', () => {
    const json = serializePrediction(makePrediction(), {
      exportedAt: '2026-06-08T12:00:00Z',
    })

    // meta completa: datos del participante + campos generados al exportar.
    expect(json.meta).toEqual({
      firstName: 'Ana',
      lastName: 'López',
      email: 'ana@ejemplo.com',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: '2026-06-08T12:00:00Z',
      tournament: TOURNAMENT_NAME,
    })

    // Todos los bloques principales presentes.
    expect(json).toHaveProperty('groupMatches')
    expect(json).toHaveProperty('groupTiebreaks')
    expect(json).toHaveProperty('thirdPlaceTiebreaks')
    expect(json).toHaveProperty('knockout')
    expect(json).toHaveProperty('champion', 'MEX')
    expect(json).toHaveProperty('awards')
    expect(json).toHaveProperty('wildcards')
  })

  it('conserva la fotografia home/away de cada llave del bracket', () => {
    const json = serializePrediction(makePrediction(), {
      exportedAt: '2026-06-08T12:00:00Z',
    })
    expect(json.knockout.M73).toEqual({
      home: 'MEX',
      away: 'KOR',
      hs: 1,
      as: 1,
      pens: { went: true, hs: 4, as: 3 },
    })
  })
})

describe('round-trip export -> import', () => {
  it('exportar y volver a importar produce el mismo estado interno', () => {
    const original = makePrediction()
    const text = predictionToJsonString(original, {
      exportedAt: '2026-06-08T12:00:00Z',
    })

    const result = parseAndValidate(text)
    expect(result.ok).toBe(true)
    // El estado interno reconstruido es identico al original (meta incluida,
    // recortada a los campos editables: nombre, apellido, correo).
    expect(result.prediction).toEqual(original)
  })
})

describe('suggestedFileName', () => {
  it('normaliza acentos y espacios', () => {
    expect(
      suggestedFileName({ firstName: 'Ana María', lastName: 'López' }),
    ).toBe('quiniela-ana-maria-lopez.json')
  })

  it('tiene un fallback cuando no hay nombre', () => {
    expect(suggestedFileName({})).toBe('quiniela-sin-nombre.json')
  })
})

describe('parseAndValidate (validacion de import)', () => {
  it('rechaza texto que no es JSON', () => {
    const r = parseAndValidate('esto no es json {{{')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/no es un JSON válido/i)
  })

  it('rechaza un JSON con schemaVersion distinto de 1', () => {
    const bad = JSON.stringify({
      meta: { schemaVersion: 99 },
      groupMatches: {},
      knockout: {},
    })
    const r = parseAndValidate(bad)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/esquema no compatible/i)
  })

  it('rechaza un JSON sin el bloque meta', () => {
    const r = parseAndValidate(JSON.stringify({ groupMatches: {}, knockout: {} }))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/meta/i)
  })

  it('acepta un JSON valido', () => {
    const text = predictionToJsonString(makePrediction(), {
      exportedAt: '2026-06-08T12:00:00Z',
    })
    const r = parseAndValidate(text)
    expect(r.ok).toBe(true)
    expect(r.prediction.champion).toBe('MEX')
    expect(Array.isArray(r.warnings)).toBe(true)
  })
})
