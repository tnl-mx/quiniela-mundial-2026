import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseAnnexCcsv, assignThirdPlaceToBracket } from './annexC.js'

// Cargamos el CSV una sola vez para todas las pruebas (es chiquito).
// En el navegador esto se haria via loadAnnexCcsv (fetch); aqui leemos
// directo del filesystem.
const csvPath = join(
  process.cwd(),
  'public',
  'data',
  'annex_C_combinations.csv',
)
const csvText = readFileSync(csvPath, 'utf-8')
const options = parseAnnexCcsv(csvText)

// Helper: dada una fila parseada, devuelve el arreglo de letras de grupo
// que aporta un tercero (quitando el "3" del "3X").
function thirdsOf(row) {
  return Object.values(row.pairings).map((v) => v.replace(/^3/, ''))
}

describe('parseAnnexCcsv', () => {
  it('a) parsea exactamente 495 filas y cada fila tiene 8 pairings', () => {
    expect(options).toHaveLength(495)
    for (const row of options) {
      expect(Object.keys(row.pairings)).toHaveLength(8)
    }
  })

  it('robustez: la tabla completa es integra (sin esto, la busqueda por conjunto seria ambigua)', () => {
    // En CADA fila, los 8 terceros son grupos DISTINTOS entre si.
    for (const row of options) {
      const groupsInRow = thirdsOf(row)
      const uniqueGroups = new Set(groupsInRow)
      expect(uniqueGroups.size).toBe(8)
    }

    // GLOBALMENTE las 495 filas representan COMBINACIONES UNICAS.
    // Convertimos cada fila a una llave canonica (las 8 letras ordenadas)
    // y verificamos que no haya duplicados.
    // C(12,8) = 495 por construccion: debe haber exactamente 495 conjuntos.
    const seenCombinations = new Set()
    for (const row of options) {
      const key = thirdsOf(row).sort().join(',')
      seenCombinations.add(key)
    }
    expect(seenCombinations.size).toBe(495)

    // Cada uno de los 12 grupos A..L aparece como tercero en al menos una fila
    // (si faltara uno, ese grupo nunca podria aportar un tercero clasificado).
    const groupsSeen = new Set()
    for (const row of options) {
      for (const g of thirdsOf(row)) groupsSeen.add(g)
    }
    const expectedGroups = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
    ]
    for (const g of expectedGroups) {
      expect(groupsSeen.has(g)).toBe(true)
    }
  })
})

describe('assignThirdPlaceToBracket', () => {
  it('d) recupera la Option 1 a partir de su propio conjunto de 8 terceros', () => {
    const option1 = options.find((r) => r.option === 1)
    expect(option1).toBeDefined()

    const qualifiedGroups = thirdsOf(option1)
    const result = assignThirdPlaceToBracket(qualifiedGroups, options)

    expect(result.option).toBe(1)
    expect(result.pairings).toEqual(option1.pairings)
  })

  it('e) recupera otra option distinta (no esta hardcodeado en la 1)', () => {
    // Elegimos una option intermedia arbitraria.
    const target = options.find((r) => r.option === 250)
    expect(target).toBeDefined()

    const qualifiedGroups = thirdsOf(target)
    const result = assignThirdPlaceToBracket(qualifiedGroups, options)

    expect(result.option).toBe(250)
    expect(result.pairings).toEqual(target.pairings)
  })

  it('lanza error claro si el conjunto de 8 grupos no existe en la tabla', () => {
    // Pasamos 7 grupos en vez de 8 (combinacion imposible en el CSV).
    expect(() =>
      assignThirdPlaceToBracket(['A', 'B', 'C', 'D', 'E', 'F', 'G'], options),
    ).toThrow(/No se encontro/)
  })
})
