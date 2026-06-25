import { describe, it, expect } from 'vitest'
import { groupClinch } from './realBracket.js'

// Mini-torneo: solo el grupo A con sus 6 partidos (mismo que groupTable.test).
const tournament = {
  groups: { A: ['MEX', 'RSA', 'KOR', 'CZE'] },
  groupMatches: [
    { id: 'A1', group: 'A', home: 'MEX', away: 'RSA' },
    { id: 'A2', group: 'A', home: 'KOR', away: 'CZE' },
    { id: 'A3', group: 'A', home: 'MEX', away: 'KOR' },
    { id: 'A4', group: 'A', home: 'CZE', away: 'RSA' },
    { id: 'A5', group: 'A', home: 'CZE', away: 'MEX' },
    { id: 'A6', group: 'A', home: 'RSA', away: 'KOR' },
  ],
}
const teams = {
  MEX: { fifaRank: 15 }, RSA: { fifaRank: 61 },
  KOR: { fifaRank: 22 }, CZE: { fifaRank: 44 },
}

describe('groupClinch', () => {
  it('grupo completo: devuelve el orden final y posiciones unicas', () => {
    const realResults = {
      groupMatches: {
        A1: { hs: 2, as: 0 }, A2: { hs: 1, as: 0 }, A3: { hs: 1, as: 0 },
        A4: { hs: 2, as: 1 }, A5: { hs: 0, as: 3 }, A6: { hs: 0, as: 1 },
      },
    }
    const c = groupClinch('A', realResults, tournament, teams)
    expect(c.complete).toBe(true)
    expect(c.order).toEqual(['MEX', 'KOR', 'CZE', 'RSA'])
    expect([...c.posByCode.MEX]).toEqual([1])
    expect([...c.posByCode.RSA]).toEqual([4])
  })

  it('caso Mexico: amarra el 1o por head-to-head aunque falten 2 partidos', () => {
    // Datos reales del Mundial 2026 grupo A tras 2 jornadas:
    // MEX 2-0 RSA, KOR 2-1 CZE, MEX 1-0 KOR, CZE 1-1 RSA. Faltan A5 y A6.
    // MEX (6 pts) le gano a KOR; aunque KOR llegue a 6, el directo lo pone 2o.
    const realResults = {
      groupMatches: {
        A1: { hs: 2, as: 0 }, A2: { hs: 2, as: 1 },
        A3: { hs: 1, as: 0 }, A4: { hs: 1, as: 1 },
      },
    }
    const c = groupClinch('A', realResults, tournament, teams)
    expect(c.complete).toBe(false)
    // MEX tiene AMARRADO el 1o: su unica posicion posible es 1.
    expect([...c.posByCode.MEX]).toEqual([1])
    // Los demas todavia pueden quedar en varias posiciones (no amarrados).
    expect(c.posByCode.KOR.size).toBeGreaterThan(1)
  })

  it('grupo sin jugar: nadie tiene posicion amarrada', () => {
    const c = groupClinch('A', { groupMatches: {} }, tournament, teams)
    expect(c.complete).toBe(false)
    for (const code of ['MEX', 'RSA', 'KOR', 'CZE']) {
      expect(c.posByCode[code].size).toBeGreaterThan(1)
    }
  })
})
