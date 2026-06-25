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

  it('b) FIFA 2026: el ENFRENTAMIENTO DIRECTO manda aunque tenga peor diferencia general', () => {
    // MEX y KOR terminan con 6 pts cada uno. KOR tiene MEJOR diferencia general
    // (+3 vs +1), pero MEX le gano a KOR en el partido directo (A3 2-1).
    // FIFA 2026: el head-to-head va primero -> MEX 1o, KOR 2o.
    const predictions = {
      A1: { hs: 1, as: 0 }, // MEX 1-0 RSA  (MEX W)
      A2: { hs: 3, as: 1 }, // KOR 3-1 CZE  (KOR W)
      A3: { hs: 2, as: 1 }, // MEX 2-1 KOR  (MEX gana el directo)
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

    // MEX 1o por head-to-head, pese a peor diferencia general.
    expect(table[0]).toMatchObject({
      code: 'MEX',
      position: 1,
      points: 6,
      goalDifference: 1,
      tied: false,
      tiedWith: [],
    })
    // KOR 2o (mejor diferencia general, pero perdio el directo).
    expect(table[1]).toMatchObject({
      code: 'KOR',
      position: 2,
      points: 6,
      goalDifference: 3,
      tied: false,
      tiedWith: [],
    })
  })

  it('c) marca empate no resuelto solo cuando ni head-to-head ni lo general separan, y ordena por ranking FIFA', () => {
    // MEX y KOR quedan iguales: 7 pts, GD +4, GF 5, y EMPATARON su partido
    // directo (A3 1-1) -> el head-to-head tampoco separa. Empate real: se
    // marcan tied y se ordenan por ranking FIFA (MEX 15 < KOR 22).
    const predictions = {
      A1: { hs: 2, as: 0 }, // MEX 2-0 RSA  (MEX W)
      A2: { hs: 2, as: 0 }, // KOR 2-0 CZE  (KOR W)
      A3: { hs: 1, as: 1 }, // MEX 1-1 KOR  (directo EMPATADO)
      A4: { hs: 1, as: 0 }, // CZE 1-0 RSA  (CZE W)
      A5: { hs: 0, as: 2 }, // CZE 0-2 MEX  (MEX W de visita)
      A6: { hs: 0, as: 2 }, // RSA 0-2 KOR  (KOR W de visita)
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    // MEX y KOR: ambos 7 pts, GD +4, GF 5; directo empatado -> empate real.
    expect(table[0]).toMatchObject({
      code: 'MEX',
      position: 1,
      points: 7,
      goalDifference: 4,
      goalsFor: 5,
      tied: true,
      tiedWith: ['KOR'],
    })
    expect(table[1]).toMatchObject({
      code: 'KOR',
      position: 2,
      points: 7,
      goalDifference: 4,
      goalsFor: 5,
      tied: true,
      tiedWith: ['MEX'],
    })

    // Los otros dos NO estan en ese empate.
    expect(table[2].tied).toBe(false)
    expect(table[3].tied).toBe(false)

    // Orden provisional por ranking FIFA: MEX=15 antes que KOR=22.
    expect(table.slice(0, 2).map((r) => r.code)).toEqual(['MEX', 'KOR'])
  })

  it('e) triple empate: se resuelve por GOLES del head-to-head y se re-aplica al subconjunto', () => {
    // MEX, KOR y CZE terminan con 5 pts y empataron sus 3 partidos entre si,
    // con distintos goles en esos enfrentamientos directos:
    //   directos: MEX 0-0 KOR, KOR 2-2 CZE, CZE 1-1 MEX
    //   goles head-to-head: CZE 3, KOR 2, MEX 1  -> CZE > KOR > MEX
    // Aunque MEX tiene mejor diferencia GENERAL (golea a RSA), el head-to-head
    // manda: CZE 1o, KOR 2o, MEX 3o.
    const predictions = {
      A1: { hs: 5, as: 0 }, // MEX 5-0 RSA  (MEX golea: mejor GD general)
      A2: { hs: 2, as: 2 }, // KOR 2-2 CZE  (directo)
      A3: { hs: 0, as: 0 }, // MEX 0-0 KOR  (directo)
      A4: { hs: 1, as: 0 }, // CZE 1-0 RSA  (CZE W)
      A5: { hs: 1, as: 1 }, // CZE 1-1 MEX  (directo)
      A6: { hs: 0, as: 1 }, // RSA 0-1 KOR  (KOR W)
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    expect(table.map((r) => r.code)).toEqual(['CZE', 'KOR', 'MEX', 'RSA'])
    // Todos quedaron resueltos por head-to-head: nadie marcado como empate.
    expect(table.every((r) => r.tied === false)).toBe(true)
    expect(table[2]).toMatchObject({ code: 'MEX', position: 3, points: 5 })
  })

  it('f) si el head-to-head no separa (empate directo), cae a la diferencia general', () => {
    // MEX y KOR con 5 pts; empataron su directo (A3 1-1) pero MEX tiene mejor
    // diferencia general (+3 vs +1). Se resuelve por lo general, sin marcar empate.
    const predictions = {
      A1: { hs: 3, as: 0 }, // MEX 3-0 RSA  (MEX W)
      A2: { hs: 1, as: 0 }, // KOR 1-0 CZE  (KOR W)
      A3: { hs: 1, as: 1 }, // MEX 1-1 KOR  (directo EMPATADO)
      A4: { hs: 2, as: 2 }, // CZE 2-2 RSA  (empate)
      A5: { hs: 1, as: 1 }, // CZE 1-1 MEX  (empate)
      A6: { hs: 1, as: 1 }, // RSA 1-1 KOR  (empate)
    }

    const table = calculateGroupTable({
      groupCode: 'A',
      predictions,
      tournament,
      teams,
    })

    expect(table[0]).toMatchObject({
      code: 'MEX',
      position: 1,
      points: 5,
      goalDifference: 3,
      tied: false,
    })
    expect(table[1]).toMatchObject({
      code: 'KOR',
      position: 2,
      points: 5,
      goalDifference: 1,
      tied: false,
    })
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
