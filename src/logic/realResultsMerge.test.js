import { describe, it, expect } from 'vitest'
import { findConflicts, mergeRealResults } from './realResultsMerge.js'

const official = {
  groupMatches: { A1: { hs: 2, as: 1 }, A2: { hs: 0, as: 0 } },
  knockout: {
    M73: { home: 'MEX', away: 'KOR', hs: 1, as: 0 },
  },
  champion: null,
  awards: {},
}

describe('findConflicts', () => {
  it('detecta solo partidos presentes en ambos con marcador distinto', () => {
    const draft = {
      groupMatches: {
        A2: { hs: 0, as: 0 }, // igual al oficial -> no conflicto
        A3: { hs: 1, as: 1 }, // nuevo -> no conflicto
        A1: { hs: 3, as: 0 }, // difiere del oficial -> CONFLICTO
      },
      knockout: {
        M73: { home: 'MEX', away: 'KOR', hs: 2, as: 2, pens: { went: true, hs: 4, as: 3 } }, // difiere
      },
    }
    const ids = findConflicts(official, draft)
    expect(ids.has('A1')).toBe(true)
    expect(ids.has('M73')).toBe(true)
    expect(ids.has('A2')).toBe(false)
    expect(ids.has('A3')).toBe(false)
  })
})

describe('mergeRealResults', () => {
  const draft = {
    groupMatches: {
      A2: { hs: 0, as: 0 }, // igual
      A3: { hs: 1, as: 1 }, // local nuevo
      A1: { hs: 3, as: 0 }, // conflicto
    },
    knockout: {},
    groupTiebreaks: {},
    thirdPlaceTiebreaks: [],
  }
  const conflicts = findConflicts(official, draft)

  it('con conflicto SIN resolver: el efectivo usa el OFICIAL y lo marca', () => {
    const { effective, groupClass, counts } = mergeRealResults({ official, draft, conflicts })
    expect(groupClass.A1).toBe('conflict')
    expect(effective.groupMatches.A1).toEqual({ hs: 2, as: 1 }) // oficial, no se pisa
    expect(groupClass.A2).toBe('official')
    expect(groupClass.A3).toBe('local')
    expect(effective.groupMatches.A3).toEqual({ hs: 1, as: 1 })
    expect(counts).toEqual({ official: 2, local: 1, conflict: 1 }) // A2,M73 oficial; A3 local; A1 conflicto
  })

  it('conflicto resuelto a "conservar el mío": usa el local y deja de ser conflicto', () => {
    const keptLocal = new Set(['A1'])
    const { effective, groupClass, counts } = mergeRealResults({ official, draft, conflicts, keptLocal })
    expect(groupClass.A1).toBe('local')
    expect(effective.groupMatches.A1).toEqual({ hs: 3, as: 0 }) // mi cambio
    expect(counts.conflict).toBe(0)
    expect(counts.local).toBe(2) // A1 + A3
  })

  it('conflicto resuelto a "usar oficial" (quitar del borrador): queda oficial', () => {
    const draft2 = { ...draft, groupMatches: { A2: { hs: 0, as: 0 }, A3: { hs: 1, as: 1 } } }
    const conflicts2 = findConflicts(official, draft2)
    const { groupClass, counts } = mergeRealResults({ official, draft: draft2, conflicts: conflicts2 })
    expect(groupClass.A1).toBe('official')
    expect(counts.conflict).toBe(0)
  })

  it('el oficial es la base aunque el borrador esté vacío', () => {
    const empty = { groupMatches: {}, knockout: {}, groupTiebreaks: {}, thirdPlaceTiebreaks: [] }
    const { effective, koClass } = mergeRealResults({ official, draft: empty })
    expect(effective.groupMatches.A1).toEqual({ hs: 2, as: 1 })
    expect(effective.knockout.M73.home).toBe('MEX')
    expect(koClass.M73).toBe('official')
  })
})
