import { describe, it, expect } from 'vitest'
import { emptyMeta, emptyPrediction } from './usePrediction.js'

// Probamos los helpers PUROS del estado. No necesitan React ni localStorage.

describe('emptyMeta', () => {
  it('es la identidad vacia, sin numero de quiniela', () => {
    const m = emptyMeta()
    expect(m).toEqual({ firstName: '', lastName: '', email: '' })
    // Una persona = una sola quiniela: ya no existe "entry".
    expect(m).not.toHaveProperty('entry')
  })
})

describe('emptyPrediction (base del "borrar todo")', () => {
  it('no tiene identidad: nombre/apellido/correo vacios', () => {
    const p = emptyPrediction()
    expect(p.meta.firstName).toBe('')
    expect(p.meta.lastName).toBe('')
    expect(p.meta.email).toBe('')
  })

  it('arranca sin predicciones', () => {
    const p = emptyPrediction()
    expect(p.groupMatches).toEqual({})
    expect(p.groupTiebreaks).toEqual({})
    expect(p.thirdPlaceTiebreaks).toEqual([])
    expect(p.knockout).toEqual({})
    expect(p.champion).toBeNull()
  })
})
