import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scorePrediction } from './scoring.js'
import { buildBracket } from './bracket.js'
import { parseAnnexCcsv } from './annexC.js'

// ---------- Fixtures: datos reales del proyecto ----------------------------
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

// Atajo: corre el motor con los fixtures fijos.
function score(prediction, realResults) {
  return scorePrediction({ prediction, realResults, tournament, teams, annexCOptions, scoring })
}

// ---------- Helpers de fase de grupos --------------------------------------
// Esquema "limpio" identico al de bracket.test.js: en cada grupo el equipo de
// menor indice gana, y el partido 3o-vs-4o usa un marcador amplio que varia
// por grupo para que los 12 terceros tengan stats distintos (bracket resuelve
// sin empates). Asi obtenemos un torneo COMPLETO y determinista.
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function scoreForGroupMatch(homeIdx, awayIdx, groupIdx) {
  if (homeIdx === 2 && awayIdx === 3) return { hs: 12 - groupIdx, as: 0 }
  if (homeIdx === 3 && awayIdx === 2) return { hs: 0, as: 12 - groupIdx }
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

// KO donde el local siempre gana 1-0 (cubre M73..M104).
function homeAlwaysWinsKnockout() {
  const ko = {}
  for (let n = 73; n <= 104; n++) ko[`M${n}`] = { hs: 1, as: 0 }
  return ko
}

// Genera los 6 marcadores de UN grupo para forzar un orden de llegada exacto.
// `order` = [1o, 2o, 3o, 4o]; el equipo mejor clasificado del par gana 1-0.
// Da puntos 9/6/3/0 -> orden estricto sin empates.
function groupMatchesForOrder(groupCode, order) {
  const out = {}
  for (const m of tournament.groupMatches.filter((x) => x.group === groupCode)) {
    const hi = order.indexOf(m.home)
    const ai = order.indexOf(m.away)
    out[m.id] = hi < ai ? { hs: 1, as: 0 } : { hs: 0, as: 1 }
  }
  return out
}

// Predicción/realidad de torneo COMPLETO y limpio (con overrides opcionales).
function fullClean(extra = {}) {
  return {
    groupMatches: makeCleanGroupPredictions(),
    knockout: homeAlwaysWinsKnockout(),
    champion: null,
    ...extra,
  }
}

// ===========================================================================
// CASO 1 — Partido de grupo: exacto=3, solo resultado=1, fallo=0
// ===========================================================================
describe('A) partidos de fase de grupos', () => {
  it('exacto da 3, solo resultado da 1, fallo da 0', () => {
    const real = {
      groupMatches: {
        A1: { hs: 2, as: 1 }, // gana home 2-1
        A2: { hs: 2, as: 0 }, // gana home
        A3: { hs: 0, as: 2 }, // gana away
      },
    }
    const prediction = {
      groupMatches: {
        A1: { hs: 2, as: 1 }, // exacto -> 3
        A2: { hs: 3, as: 1 }, // mismo resultado (gana home) -> 1
        A3: { hs: 1, as: 0 }, // resultado contrario -> 0
      },
    }
    const res = score(prediction, real)

    expect(res.breakdown.groupMatches).toBe(4) // 3 + 1 + 0
    expect(res.total).toBe(4)

    const a1 = res.items.find((i) => i.matchId === 'A1')
    const a2 = res.items.find((i) => i.matchId === 'A2')
    const a3 = res.items.find((i) => i.matchId === 'A3')
    expect(a1).toMatchObject({ points: 3, detail: 'Marcador exacto' })
    expect(a2).toMatchObject({ points: 1, detail: 'Resultado acertado' })
    expect(a3).toMatchObject({ points: 0, detail: 'Marcador fallado' })
  })

  it('un partido sin resultado real todavia no suma nada', () => {
    const real = { groupMatches: { A1: { hs: 1, as: 0 } } }
    const prediction = {
      groupMatches: { A1: { hs: 1, as: 0 }, A2: { hs: 5, as: 0 } },
    }
    const res = score(prediction, real)
    // Solo A1 (jugado) cuenta; A2 no esta en real -> no aparece.
    expect(res.breakdown.groupMatches).toBe(3)
    expect(res.items.find((i) => i.matchId === 'A2')).toBeUndefined()
  })
})

// ===========================================================================
// CASO 2 — Tabla de grupo: clasifica=2, posicion exacta=3
// ===========================================================================
describe('B) tabla de grupo (clasifica + posicion exacta)', () => {
  it('credita 2 por clasificado correcto y 3 por posicion exacta', () => {
    const gA = tournament.groups['A'] // [t0, t1, t2, t3]
    // Real: orden natural t0 > t1 > t2 > t3.
    const realOrder = [gA[0], gA[1], gA[2], gA[3]]
    // Predicho: t0 1o (acierta pos y clasifica), t2 2o (no clasifica de verdad),
    //           t1 3o, t3 4o (acierta pos).
    const predOrder = [gA[0], gA[2], gA[1], gA[3]]

    const real = { groupMatches: groupMatchesForOrder('A', realOrder) }
    const prediction = { groupMatches: groupMatchesForOrder('A', predOrder) }
    const res = score(prediction, real)

    // advances: solo t0 esta en ambos top-2 -> 2.
    // exactPosition: pos1 (t0) y pos4 (t3) coinciden -> 3 + 3 = 6.
    expect(res.breakdown.groupTable).toBe(2 + 6)

    const labels = res.items
      .filter((i) => i.category === 'groupTable')
      .map((i) => i.detail)
    expect(labels.filter((d) => d === 'Clasifica (1o/2o)').length).toBe(1)
    expect(labels.filter((d) => d.startsWith('Posicion exacta')).length).toBe(2)
  })
})

// ===========================================================================
// CASO 3 — Avance eliminatoria escalado r16=1, qf=2, sf=3, final=4
// ===========================================================================
describe('C) avance eliminatoria (escala por ronda destino)', () => {
  it('prediccion perfecta acredita avance en cada ronda con su escala', () => {
    const real = fullClean()
    const prediction = fullClean()
    const res = score(prediction, real)

    // 16 ganadores R32 -> r16 (1 c/u) = 16
    // 8 ganadores R16 -> qf (2)        = 16
    // 4 ganadores QF  -> sf (3)        = 12
    // 2 ganadores SF  -> final (4)     = 8
    expect(res.breakdown.knockoutAdvance).toBe(16 + 16 + 12 + 8) // 52

    const adv = res.items.filter((i) => i.category === 'knockoutAdvance')
    expect(adv.some((i) => i.points === 1)).toBe(true) // r16
    expect(adv.some((i) => i.points === 2)).toBe(true) // qf
    expect(adv.some((i) => i.points === 3)).toBe(true) // sf
    expect(adv.some((i) => i.points === 4)).toBe(true) // final
  })
})

// ===========================================================================
// CASO 4 — Avance SIN cruce: el equipo avanzo de verdad (punto de avance SI),
//          pero su rival predicho no coincide con el real (marcador NO).
// ===========================================================================
describe('C/D) avance sin cruce', () => {
  it('da el punto de avance pero NO el de marcador', () => {
    const gA = tournament.groups['A']
    const gB = tournament.groups['B']

    // Grupos A y B completos. A natural en ambos. B: el 2o difiere.
    const realGroups = {
      ...groupMatchesForOrder('A', [gA[0], gA[1], gA[2], gA[3]]),
      ...groupMatchesForOrder('B', [gB[0], gB[1], gB[2], gB[3]]), // 2B real = gB[1]
    }
    const predGroups = {
      ...groupMatchesForOrder('A', [gA[0], gA[1], gA[2], gA[3]]),
      ...groupMatchesForOrder('B', [gB[0], gB[2], gB[1], gB[3]]), // 2B pred = gB[2]
    }
    // M73 = 2A vs 2B. Home (2A = gA[1]) gana 1-0 en ambos -> gA[1] avanza.
    const real = { groupMatches: realGroups, knockout: { M73: { hs: 1, as: 0 } } }
    const prediction = { groupMatches: predGroups, knockout: { M73: { hs: 1, as: 0 } } }
    const res = score(prediction, real)

    // gA[1] gano su llave R32 en pred y en real -> punto de avance (r16 = 1).
    expect(res.breakdown.knockoutAdvance).toBe(scoring.knockoutAdvance.r16)
    // El par predicho {gA1, gB2} no jugo en la realidad ({gA1, gB1}) -> 0 marcador.
    expect(res.breakdown.knockoutMatch).toBe(0)
  })
})

// ===========================================================================
// CASO 5 — Cruce invertido: predicho P vs Q, real Q vs P (misma ronda, otra
//          llave). El cruce cuenta y el marcador se evalua por EQUIPO.
// ===========================================================================
describe('D) cruce invertido local/visitante', () => {
  it('reconoce el cruce y evalua el marcador por equipo (no por posicion)', () => {
    const F = tournament.groups['F']
    const C = tournament.groups['C']
    const P = F[0]
    const Q = C[0]

    // Predicho: P = 1F, Q = 2C -> se cruzan en M75 (1F vs 2C) = P(home) vs Q(away).
    const prediction = {
      groupMatches: {
        ...groupMatchesForOrder('F', [F[0], F[1], F[2], F[3]]), // P = 1F
        ...groupMatchesForOrder('C', [C[1], C[0], C[2], C[3]]), // Q = 2C
      },
      knockout: { M75: { hs: 2, as: 1 } }, // P 2 - Q 1
    }
    // Real: P = 2F, Q = 1C -> se cruzan en M76 (1C vs 2F) = Q(home) vs P(away).
    const real = {
      groupMatches: {
        ...groupMatchesForOrder('F', [F[1], F[0], F[2], F[3]]), // P = 2F
        ...groupMatchesForOrder('C', [C[0], C[1], C[2], C[3]]), // Q = 1C
      },
      knockout: { M76: { hs: 1, as: 2 } }, // Q 1 - P 2
    }

    const res = score(prediction, real)

    // Por EQUIPO: P=2 y Q=1 en ambos -> marcador exacto (3), aunque el "home"
    // tenga goles distintos entre pred (P:2) y real (Q:1).
    expect(res.breakdown.knockoutMatch).toBe(scoring.knockoutMatch.exactScore)
    const item = res.items.find(
      (i) => i.category === 'knockoutMatch' && i.label === `${P} vs ${Q}`,
    )
    expect(item).toBeDefined()
    expect(item.points).toBe(3)
  })
})

// ===========================================================================
// CASO 6 — Multiplicador: partido real a penales.
// ===========================================================================
describe('E) multiplicador x2 en partido a penales', () => {
  // Real: torneo limpio + M73 empata y se va a penales (gana el home por pens).
  const realPens = fullClean({
    knockout: {
      ...homeAlwaysWinsKnockout(),
      M73: { hs: 1, as: 1, pens: { went: true, hs: 4, as: 2 } },
    },
  })

  it('acertar TODO duplica los puntos del partido (avance + marcador + pens)', () => {
    const prediction = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M73: { hs: 1, as: 1, pens: { went: true, hs: 4, as: 2 } },
      },
    })
    const res = score(prediction, realPens)

    // Base del partido M73: avance r16 (1) + marcador exacto (3) + pens (1+2=3) = 7.
    // Bonus por x2 = 7 (la copia extra). Es el unico partido a penales.
    expect(res.breakdown.multiplierBonus).toBe(7)
    const bonus = res.items.find(
      (i) => i.category === 'multiplierBonus' && i.matchId === 'M73',
    )
    expect(bonus).toBeDefined()
    expect(bonus.points).toBe(7)
  })

  it('acertar casi todo menos el marcador de penales NO duplica', () => {
    const prediction = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        // Regular exacto y predijo penales, pero marcador de pens equivocado.
        M73: { hs: 1, as: 1, pens: { went: true, hs: 5, as: 0 } },
      },
    })
    const res = score(prediction, realPens)

    expect(res.breakdown.multiplierBonus).toBe(0)
    // Aun gana el punto por acertar que iba a penales (sin el exacto).
    const pens = res.items.find(
      (i) => i.category === 'penalties' && i.matchId === 'M73',
    )
    expect(pens.points).toBe(scoring.penalties.wentToPens) // 1
  })
})

// ===========================================================================
// CASO 7 — Campeon: 5 puntos, y NUNCA se multiplica (final a penales).
// ===========================================================================
describe('F) campeon', () => {
  it('acertar el campeon da 5 y no entra al multiplicador aunque la final vaya a pens', () => {
    const real = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M104: { hs: 1, as: 1, pens: { went: true, hs: 3, as: 1 } }, // final a pens
      },
    })
    // Calculamos quien es el campeon real para fijarlo en ambos lados.
    const realBracket = buildBracket({ tournament, teams, annexCOptions, predictions: real })
    real.champion = realBracket.champion

    const prediction = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M104: { hs: 1, as: 1, pens: { went: true, hs: 3, as: 1 } },
      },
      champion: realBracket.champion,
    })

    const res = score(prediction, real)

    expect(res.breakdown.champion).toBe(5)
    // La final (FINAL) no da punto de avance: bonus = (0 + 3 marcador + 3 pens) = 6.
    // El campeon (5) queda APARTE, nunca se duplica.
    expect(res.breakdown.multiplierBonus).toBe(6)
  })

  it('fallar el campeon da 0', () => {
    const real = fullClean()
    const realBracket = buildBracket({ tournament, teams, annexCOptions, predictions: real })
    real.champion = realBracket.champion
    const prediction = fullClean({ champion: '___NO_EXISTE___' })
    const res = score(prediction, real)
    expect(res.breakdown.champion).toBe(0)
  })
})

// ===========================================================================
// CASO 8 — Resultados incompletos: solo lo jugado suma.
// ===========================================================================
describe('resultados incompletos', () => {
  it('con solo un partido jugado, solo ese suma y nada truena', () => {
    const real = { groupMatches: { A1: { hs: 1, as: 0 } } }
    const prediction = fullClean() // prediccion completa
    const res = score(prediction, real)

    expect(res.breakdown.groupTable).toBe(0) // ningun grupo completo
    expect(res.breakdown.knockoutAdvance).toBe(0) // no hay KO real decidido
    expect(res.breakdown.knockoutMatch).toBe(0)
    expect(res.breakdown.penalties).toBe(0)
    expect(res.breakdown.multiplierBonus).toBe(0)
    expect(res.breakdown.champion).toBe(0)
    // groupMatches: solo A1. Limpio: A1 = MEX(t0) vs RSA(t1) -> t0 gana 1-0.
    expect(res.breakdown.groupMatches).toBe(res.total)
    expect(res.total).toBeGreaterThan(0)
  })
})

// ===========================================================================
// CASOS EXTRA — Terceros: se activan SOLO al cerrar toda la fase de grupos.
// ===========================================================================
describe('B.3) clasificacion de mejores terceros', () => {
  it('con la fase de grupos INCOMPLETA, los puntos de terceros valen 0', () => {
    const gA = tournament.groups['A']
    // Solo el grupo A esta completo; faltan los otros 11.
    const real = { groupMatches: groupMatchesForOrder('A', [gA[0], gA[1], gA[2], gA[3]]) }
    const prediction = fullClean()
    const res = score(prediction, real)

    const terceros = res.items.filter((i) => i.matchId === 'terceros')
    expect(terceros.length).toBe(0)
  })

  it('con la fase de grupos COMPLETA, un tercero bien predicho da sus 2 pts', () => {
    const real = fullClean()
    const prediction = fullClean() // identica -> mismos 8 terceros clasificados
    const res = score(prediction, real)

    const terceros = res.items.filter((i) => i.matchId === 'terceros')
    expect(terceros.length).toBe(8) // los 8 mejores terceros coinciden
    for (const t of terceros) expect(t.points).toBe(scoring.groupTable.advances) // 2
  })
})

// ===========================================================================
// CAMPOS DEL DETALLE — status machine-readable + prediction/actual.
// (Los usa la vista de detalle por persona; no deben depender del texto ES.)
// ===========================================================================
describe('items[] expone status + prediction/actual', () => {
  it('A) partidos de grupo: status exact/outcome/miss con prediction y actual', () => {
    const real = {
      groupMatches: { A1: { hs: 2, as: 1 }, A2: { hs: 2, as: 0 }, A3: { hs: 0, as: 2 } },
    }
    const prediction = {
      groupMatches: { A1: { hs: 2, as: 1 }, A2: { hs: 3, as: 1 }, A3: { hs: 1, as: 0 } },
    }
    const res = score(prediction, real)
    const a1 = res.items.find((i) => i.matchId === 'A1')
    const a2 = res.items.find((i) => i.matchId === 'A2')
    const a3 = res.items.find((i) => i.matchId === 'A3')

    expect(a1.status).toBe('exact')
    expect(a1.prediction).toEqual({ hs: 2, as: 1 })
    expect(a1.actual).toEqual({ hs: 2, as: 1 })
    expect(a1.home).toBe('MEX')
    expect(a1.away).toBe('RSA')

    expect(a2.status).toBe('outcome')
    expect(a3.status).toBe('miss')
    expect(a3.prediction).toEqual({ hs: 1, as: 0 })
    expect(a3.actual).toEqual({ hs: 0, as: 2 })
  })

  it('A) partido jugado sin prediccion: status no-prediction', () => {
    const real = { groupMatches: { A1: { hs: 1, as: 0 } } }
    const res = score({ groupMatches: {} }, real)
    const a1 = res.items.find((i) => i.matchId === 'A1')
    expect(a1.status).toBe('no-prediction')
    expect(a1.prediction).toBeNull()
    expect(a1.actual).toEqual({ hs: 1, as: 0 })
  })

  it('B) tabla de grupo: status advances y exact-position', () => {
    const gA = tournament.groups['A']
    const real = { groupMatches: groupMatchesForOrder('A', [gA[0], gA[1], gA[2], gA[3]]) }
    const prediction = { groupMatches: groupMatchesForOrder('A', [gA[0], gA[2], gA[1], gA[3]]) }
    const res = score(prediction, real)
    const gt = res.items.filter((i) => i.category === 'groupTable')
    expect(gt.some((i) => i.status === 'advances')).toBe(true)
    expect(gt.some((i) => i.status === 'exact-position')).toBe(true)
  })

  it('C) avance: status advance', () => {
    const res = score(fullClean(), fullClean())
    const adv = res.items.filter((i) => i.category === 'knockoutAdvance')
    expect(adv.length).toBeGreaterThan(0)
    for (const a of adv) expect(a.status).toBe('advance')
  })

  it('D) cruce INVERTIDO: actual queda mapeado por equipo, status exact', () => {
    const F = tournament.groups['F']
    const C = tournament.groups['C']
    const P = F[0]
    const Q = C[0]
    // Predicho: P 1F, Q 2C -> M75 = P(home) vs Q(away), P 2 - Q 1.
    const prediction = {
      groupMatches: {
        ...groupMatchesForOrder('F', [F[0], F[1], F[2], F[3]]),
        ...groupMatchesForOrder('C', [C[1], C[0], C[2], C[3]]),
      },
      knockout: { M75: { hs: 2, as: 1 } },
    }
    // Real: P 2F, Q 1C -> M76 = Q(home) vs P(away), Q 1 - P 2 (invertido).
    const real = {
      groupMatches: {
        ...groupMatchesForOrder('F', [F[1], F[0], F[2], F[3]]),
        ...groupMatchesForOrder('C', [C[0], C[1], C[2], C[3]]),
      },
      knockout: { M76: { hs: 1, as: 2 } },
    }
    const res = score(prediction, real)
    const item = res.items.find(
      (i) => i.category === 'knockoutMatch' && i.label === `${P} vs ${Q}`,
    )
    expect(item).toBeDefined()
    expect(item.status).toBe('exact')
    // Orientado a la persona (P home, Q away): prediccion 2-1.
    expect(item.prediction).toEqual({ hs: 2, as: 1 })
    // actual mapeado por EQUIPO: P metio 2, Q metio 1 -> 2-1 (aunque el real
    // venia como Q 1 - P 2). Una comparacion por POSICION habria dado 1-2.
    expect(item.actual).toEqual({ hs: 2, as: 1 })
    expect(item.home).toBe(P)
    expect(item.away).toBe(Q)
  })

  it('D) penales: prediction/actual mapeados y status (exact-pens / went)', () => {
    const realPens = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M73: { hs: 1, as: 1, pens: { went: true, hs: 4, as: 2 } },
      },
    })
    // Acierta pens exactos.
    const exactPred = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M73: { hs: 1, as: 1, pens: { went: true, hs: 4, as: 2 } },
      },
    })
    const r1 = score(exactPred, realPens)
    const p1 = r1.items.find((i) => i.category === 'penalties' && i.matchId === 'M73')
    expect(p1.status).toBe('exact-pens')
    expect(p1.prediction).toEqual({ hs: 4, as: 2 })
    expect(p1.actual).toEqual({ hs: 4, as: 2 })

    // Predijo pens pero marcador equivocado -> status went, actual sigue real.
    const wrongPred = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M73: { hs: 1, as: 1, pens: { went: true, hs: 5, as: 0 } },
      },
    })
    const r2 = score(wrongPred, realPens)
    const p2 = r2.items.find((i) => i.category === 'penalties' && i.matchId === 'M73')
    expect(p2.status).toBe('went')
    expect(p2.prediction).toEqual({ hs: 5, as: 0 })
    expect(p2.actual).toEqual({ hs: 4, as: 2 })
  })

  it('E) multiplicador: status x2', () => {
    const realPens = fullClean({
      knockout: {
        ...homeAlwaysWinsKnockout(),
        M73: { hs: 1, as: 1, pens: { went: true, hs: 4, as: 2 } },
      },
    })
    const res = score(realPens, realPens)
    const x2 = res.items.find((i) => i.category === 'multiplierBonus' && i.matchId === 'M73')
    expect(x2.status).toBe('x2')
    expect(x2.factor).toBe(scoring.penaltiesMultiplier)
  })

  it('F) campeon: status hit / miss / pending con prediction y actual', () => {
    // hit
    const hit = score({ champion: 'MEX' }, { champion: 'MEX' })
    const hitItem = hit.items.find((i) => i.category === 'champion')
    expect(hitItem.status).toBe('hit')
    expect(hitItem.prediction).toBe('MEX')
    expect(hitItem.actual).toBe('MEX')

    // miss
    const miss = score({ champion: 'MEX' }, { champion: 'BRA' })
    expect(miss.items.find((i) => i.category === 'champion').status).toBe('miss')

    // pending (aun no hay campeon real)
    const pending = score({ champion: 'MEX' }, {})
    const pendItem = pending.items.find((i) => i.category === 'champion')
    expect(pendItem.status).toBe('pending')
    expect(pendItem.actual).toBeNull()
  })
})
