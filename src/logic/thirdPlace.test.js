import { describe, it, expect } from 'vitest'
import { rankThirdPlacedTeams } from './thirdPlace.js'

// Helper para construir una fila de tercer lugar minima.
// rankThirdPlacedTeams solo usa puntos, GD y GF para ordenar; el resto se
// copia tal cual. Por eso wins/draws/losses pueden no sumar; no nos importa
// en esta capa.
function thirdRow({ code, points, gd, gf }) {
  return {
    position: 3,
    code,
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: gf,
    goalsAgainst: gf - gd,
    goalDifference: gd,
    points,
    tied: false,
    tiedWith: [],
  }
}

// Helper que construye el objeto groupTables (12 grupos) a partir de un
// objeto simple: { A: { code, points, gd, gf }, B: {...}, ... }.
function makeGroupTables(thirds) {
  const tables = {}
  for (const [groupCode, t] of Object.entries(thirds)) {
    tables[groupCode] = [thirdRow(t)]
  }
  return tables
}

describe('rankThirdPlacedTeams', () => {
  it('b) con puntajes claros elige los 8 mejores y marca los 4 eliminados', () => {
    // 12 terceros con puntajes monotonamente descendentes => orden trivial,
    // sin empates exactos.
    const tables = makeGroupTables({
      A: { code: 'AAA', points: 7, gd: 5, gf: 6 },
      B: { code: 'BBB', points: 6, gd: 4, gf: 5 },
      C: { code: 'CCC', points: 5, gd: 3, gf: 4 },
      D: { code: 'DDD', points: 5, gd: 2, gf: 3 },
      E: { code: 'EEE', points: 4, gd: 1, gf: 3 },
      F: { code: 'FFF', points: 4, gd: 0, gf: 2 },
      G: { code: 'GGG', points: 3, gd: 0, gf: 2 },
      H: { code: 'HHH', points: 3, gd: -1, gf: 1 },
      I: { code: 'III', points: 2, gd: -1, gf: 1 },
      J: { code: 'JJJ', points: 2, gd: -2, gf: 0 },
      K: { code: 'KKK', points: 1, gd: -3, gf: 0 },
      L: { code: 'LLL', points: 0, gd: -5, gf: 0 },
    })

    const ranking = rankThirdPlacedTeams({ groupTables: tables })

    expect(ranking).toHaveLength(12)

    // El orden esperado, por codigo:
    expect(ranking.map((r) => r.code)).toEqual([
      'AAA','BBB','CCC','DDD','EEE','FFF','GGG','HHH','III','JJJ','KKK','LLL',
    ])

    // Posiciones 1..12 y banderas qualified correctas (top 8 si, resto no).
    for (let i = 0; i < 12; i++) {
      expect(ranking[i].position).toBe(i + 1)
      expect(ranking[i].qualified).toBe(i < 8)
    }

    // Sin empates exactos en este caso.
    for (const r of ranking) {
      expect(r.tied).toBe(false)
      expect(r.tiedWith).toEqual([])
    }
  })

  it('c) empate exacto en la frontera 8-vs-9: ambos marcados tied, FIFA solo decide el orden provisional', () => {
    // HHH y III quedan EXACTAMENTE iguales en pts/GD/GF.
    // FIFA: HHH=30 (mejor), III=50 (peor). Provisionalmente HHH va primero
    // y clasifica, III queda 9o sin clasificar... PERO ambos siguen tied.
    const tables = makeGroupTables({
      A: { code: 'AAA', points: 7, gd: 5, gf: 6 },
      B: { code: 'BBB', points: 6, gd: 4, gf: 5 },
      C: { code: 'CCC', points: 5, gd: 3, gf: 4 },
      D: { code: 'DDD', points: 5, gd: 2, gf: 3 },
      E: { code: 'EEE', points: 4, gd: 1, gf: 3 },
      F: { code: 'FFF', points: 4, gd: 0, gf: 2 },
      G: { code: 'GGG', points: 4, gd: 0, gf: 1 }, // 7mo
      H: { code: 'HHH', points: 3, gd: -2, gf: 1 }, // empata con III
      I: { code: 'III', points: 3, gd: -2, gf: 1 }, // empata con HHH
      J: { code: 'JJJ', points: 2, gd: -3, gf: 0 },
      K: { code: 'KKK', points: 1, gd: -4, gf: 0 },
      L: { code: 'LLL', points: 0, gd: -6, gf: 0 },
    })

    const teams = {
      HHH: { fifaRank: 30 },
      III: { fifaRank: 50 },
    }

    const ranking = rankThirdPlacedTeams({ groupTables: tables, teams })

    // HHH (mejor ranking FIFA) provisionalmente en posicion 8 y SI clasifica.
    const eighth = ranking[7]
    expect(eighth).toMatchObject({
      code: 'HHH',
      position: 8,
      qualified: true,
      tied: true,
      tiedWith: ['III'],
    })

    // III (peor ranking FIFA) cae a posicion 9 y NO clasifica, pero conserva
    // la marca de empate: la UI debe pedir al usuario el desempate final.
    const ninth = ranking[8]
    expect(ninth).toMatchObject({
      code: 'III',
      position: 9,
      qualified: false,
      tied: true,
      tiedWith: ['HHH'],
    })

    // El resto del ranking NO esta empatado (cada uno tiene su trio
    // pts/GD/GF distinto del vecino).
    expect(ranking[6].tied).toBe(false) // GGG, justo antes del empate
    expect(ranking[9].tied).toBe(false) // JJJ, justo despues del empate
    expect(ranking[0].tied).toBe(false)
    expect(ranking[11].tied).toBe(false)
  })
})
