import { describe, it, expect } from 'vitest'
import { clavoElUltimo } from './quirkStats.js'

const teams = { RSA: { flag: '🇿🇦' }, CAN: { flag: '🇨🇦' } }
const tournament = { groupMatches: [] }
// Ultimo capturado: una llave de eliminatoria RSA 0-1 CAN.
const realResults = {
  groupMatches: {},
  knockout: { M73: { home: 'RSA', away: 'CAN', hs: 0, as: 1 } },
}

describe('clavoElUltimo (eliminatoria)', () => {
  it('solo cuenta a quien acerto el CRUCE exacto y su marcador, no por coincidir el marcador con otros equipos', () => {
    const rows = [
      // Acerto el cruce RSA-CAN y el marcador: el motor le da un item exact.
      { name: 'Ana', prediction: {}, items: [{ category: 'knockoutMatch', realMatchId: 'M73', status: 'exact' }] },
      // Puso 0-1 en su llave M73 pero con OTROS equipos: no hay item exact -> NO cuenta.
      { name: 'Beto', prediction: { knockout: { M73: { hs: 0, as: 1 } } }, items: [] },
      // Acerto el cruce pero fallo el marcador (outcome): NO cuenta como clavado.
      { name: 'Caro', prediction: {}, items: [{ category: 'knockoutMatch', realMatchId: 'M73', status: 'outcome' }] },
    ]
    const s = clavoElUltimo({ rows, realResults, tournament, teams })
    expect(s.titulo).toBe('Clavó el último')
    expect(s.detalle).toBe('Ana')
    expect(s.detalle).not.toContain('Beto')
    expect(s.detalle).not.toContain('Caro')
  })

  it('si nadie clava el cruce exacto, lo dice', () => {
    const rows = [
      { name: 'Beto', prediction: { knockout: { M73: { hs: 0, as: 1 } } }, items: [] },
    ]
    const s = clavoElUltimo({ rows, realResults, tournament, teams })
    expect(s.detalle).toBe('Nadie lo clavó')
  })
})
