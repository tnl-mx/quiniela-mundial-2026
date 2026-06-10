import { describe, it, expect } from 'vitest'
import { calculateGroupTable } from './groupTable.js'

// Mini-torneo que reusan todos los tests: solo el grupo A con sus 6 partidos.
const tournament = {
  groups: {
    A: ['MEX', 'RSA', 'KOR', 'CZE'],
  },
  groupMatches: [
    { id: 'A1', group: 'A', home: 'MEX', away: 'RSA' },
    { id: 'A2', group: 'A', home: 'KOR', away: 'CZE' },
    { id: 'A3', group: 'A', home: 'MEX', away: 'KOR' },
    { id: 'A4', group: 'A', home: 'CZE', away: 'RSA' },
    { id: 'A5', group: 'A', home: 'CZE', away: 'MEX' },
    { id: 'A6', group: 'A', home: 'RSA', away: 'KOR' },
  ],
}

// Ranking FIFA real de tu teams.json (los que importan aqui).
const teams = {
  MEX: { fifaRank: 15 },
  RSA: { fifaRank: 61 },
  KOR: { fifaRank: 22 },
  CZE: { fifaRank: 44 },
}

describe('calculateGroupTable', () => {
  it('a) ordena por puntos cuando hay resultados claros', () => {
    // MEX gana los 3, KOR gana 2 (pierde con MEX), CZE gana 1, RSA pierde todos.
    const predictions = {
      A1: { hs: 2, as: 0 }, // MEX 2-0 RSA
      A2: { hs: 1, as: 0 }, // KOR 1-0 CZE
      A3: { hs: 1, as: 0 }, // MEX 1-0 KOR
      A4: { hs: 2, as: 1 }, // CZE 2-1 RSA
      A5: { hs: 0, as: 3 }, // CZE 0-3 MEX
      A6: { hs: 0, as: 1 }, // RSA 0-1 KOR
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    expect(table.map((r) => r.code)).toEqual(['MEX', 'KOR', 'CZE', 'RSA'])

    expect(table[0]).toMatchObject({
      code: 'MEX',
      position: 1,
      played: 3, wins: 3, draws: 0, losses: 0,
      goalsFor: 6, goalsAgainst: 0, goalDifference: 6,
      points: 9,
      tied: false,
      tiedWith: [],
    })
    expect(table[1]).toMatchObject({
      code: 'KOR',
      position: 2,
      played: 3, wins: 2, draws: 0, losses: 1,
      goalsFor: 2, goalsAgainst: 1, goalDifference: 1,
      points: 6,
      tied: false,
    })
    expect(table[2]).toMatchObject({
      code: 'CZE',
      position: 3,
      points: 3,
      tied: false,
    })
    expect(table[3]).toMatchObject({
      code: 'RSA',
      position: 4,
      points: 0,
      tied: false,
    })
  })

  it('b) separa por diferencia de goles cuando dos equipos empatan en puntos', () => {
    // MEX y KOR terminan con 6 pts cada uno, pero KOR con mejor GD.
    const predictions = {
      A1: { hs: 1, as: 0 }, // MEX 1-0 RSA  (MEX W)
      A2: { hs: 3, as: 1 }, // KOR 3-1 CZE  (KOR W)
      A3: { hs: 2, as: 1 }, // MEX 2-1 KOR  (MEX W)
      A4: { hs: 1, as: 1 }, // CZE 1-1 RSA  (empate)
      A5: { hs: 2, as: 1 }, // CZE 2-1 MEX  (MEX L)
      A6: { hs: 0, as: 2 }, // RSA 0-2 KOR  (KOR W)
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    // KOR: GF 6, GC 3, GD +3, 6 pts
    // MEX: GF 4, GC 3, GD +1, 6 pts
    expect(table[0]).toMatchObject({
      code: 'KOR',
      position: 1,
      points: 6,
      goalDifference: 3,
      tied: false,
      tiedWith: [],
    })
    expect(table[1]).toMatchObject({
      code: 'MEX',
      position: 2,
      points: 6,
      goalDifference: 1,
      tied: false,
      tiedWith: [],
    })
  })

  it('c) marca empate no resuelto cuando puntos, GD y GF coinciden exactamente, y los ordena provisionalmente por ranking FIFA', () => {
    // MEX y KOR quedan EXACTAMENTE iguales: 6 pts, GD +1, GF 2.
    // FIFA: MEX 15 vs KOR 22 -> MEX debe ir primero pero AMBOS quedan
    // marcados como empate no resuelto.
    const predictions = {
      A1: { hs: 1, as: 0 }, // MEX 1-0 RSA  (MEX W)
      A2: { hs: 1, as: 0 }, // KOR 1-0 CZE  (KOR W)
      A3: { hs: 0, as: 1 }, // MEX 0-1 KOR  (KOR W)
      A4: { hs: 1, as: 1 }, // CZE 1-1 RSA  (empate)
      A5: { hs: 0, as: 1 }, // CZE 0-1 MEX  (MEX W de visita)
      A6: { hs: 1, as: 0 }, // RSA 1-0 KOR  (KOR L)
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    // Primer lugar: MEX, marcado como empatado con KOR.
    expect(table[0]).toMatchObject({
      code: 'MEX',
      position: 1,
      points: 6,
      goalDifference: 1,
      goalsFor: 2,
      tied: true,
      tiedWith: ['KOR'],
    })
    // Segundo lugar: KOR, marcado como empatado con MEX.
    expect(table[1]).toMatchObject({
      code: 'KOR',
      position: 2,
      points: 6,
      goalDifference: 1,
      goalsFor: 2,
      tied: true,
      tiedWith: ['MEX'],
    })

    // Los otros dos NO estan en el mismo empate (puntos/GD/GF distintos).
    expect(table[2].tied).toBe(false)
    expect(table[3].tied).toBe(false)

    // Sanity: verificamos que el orden provisional respeta el ranking FIFA
    // (MEX=15 antes que KOR=22) y NO al reves.
    const firstTwo = table.slice(0, 2).map((r) => r.code)
    expect(firstTwo).toEqual(['MEX', 'KOR'])
  })

  it('d) maneja marcadores incompletos sin truenar', () => {
    // Solo un partido capturado de los 6.
    const predictions = {
      A1: { hs: 1, as: 0 }, // MEX 1-0 RSA
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    // Devuelve siempre las 4 filas del grupo.
    expect(table).toHaveLength(4)

    // MEX gano su unico partido.
    const mex = table.find((r) => r.code === 'MEX')
    expect(mex).toMatchObject({
      played: 1, wins: 1, losses: 0,
      goalsFor: 1, goalsAgainst: 0, goalDifference: 1,
      points: 3,
    })

    // RSA perdio su unico partido.
    const rsa = table.find((r) => r.code === 'RSA')
    expect(rsa).toMatchObject({
      played: 1, wins: 0, losses: 1,
      goalsFor: 0, goalsAgainst: 1, goalDifference: -1,
      points: 0,
    })

    // KOR y CZE no jugaron: todo en cero.
    const kor = table.find((r) => r.code === 'KOR')
    expect(kor).toMatchObject({ played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 })
    const cze = table.find((r) => r.code === 'CZE')
    expect(cze).toMatchObject({ played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 })
  })
})
