import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Prueba de INTEGRIDAD de los emparejamientos de la fase de grupos sobre los
// datos REALES de public/data/tournament.json. Su objetivo es que un error
// como el del Grupo C (un partido repetido y otro faltante) FALLE aqui en vez
// de llegar a producción.
const tournament = JSON.parse(
  readFileSync(
    join(process.cwd(), 'public', 'data', 'tournament.json'),
    'utf-8',
  ),
)

// Clave canonica de un enfrentamiento, independiente de quien sea home/away:
// "BRA-MAR" === "MAR-BRA". Permite detectar duplicados y faltantes.
function pairKey(a, b) {
  return [a, b].sort().join('-')
}

// Las 6 combinaciones unicas de 2 equipos entre los 4 de un grupo.
function expectedPairs(teams) {
  const pairs = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push(pairKey(teams[i], teams[j]))
    }
  }
  return pairs
}

const groupLetters = Object.keys(tournament.groups)

describe('Integridad de los partidos de grupos (tournament.json)', () => {
  it('hay 12 grupos de 4 equipos cada uno', () => {
    expect(groupLetters).toHaveLength(12)
    for (const g of groupLetters) {
      expect(tournament.groups[g]).toHaveLength(4)
    }
  })

  // Un bloque de aserciones por grupo, para que el mensaje de fallo diga
  // EXACTAMENTE en que grupo esta el problema.
  for (const g of groupLetters) {
    describe(`Grupo ${g}`, () => {
      const teams = tournament.groups[g]
      const matches = tournament.groupMatches.filter((m) => m.group === g)

      it('tiene exactamente 6 partidos', () => {
        expect(matches).toHaveLength(6)
      })

      it('home y away pertenecen al grupo', () => {
        for (const m of matches) {
          expect(teams).toContain(m.home)
          expect(teams).toContain(m.away)
          // Un equipo no juega contra si mismo.
          expect(m.home).not.toBe(m.away)
        }
      })

      it('cubre los 6 pares unicos, sin repetir ni faltar ninguno', () => {
        const got = matches.map((m) => pairKey(m.home, m.away)).sort()
        const want = expectedPairs(teams).sort()
        // Si hay un duplicado y un faltante (como pasaba en el Grupo C),
        // estas listas no coinciden y el test falla.
        expect(got).toEqual(want)
        // Y de forma explicita: 6 enfrentamientos distintos.
        expect(new Set(got).size).toBe(6)
      })

      it('cada equipo juega exactamente 3 partidos', () => {
        const counts = Object.fromEntries(teams.map((t) => [t, 0]))
        for (const m of matches) {
          counts[m.home] += 1
          counts[m.away] += 1
        }
        for (const t of teams) {
          expect(counts[t]).toBe(3)
        }
      })
    })
  }
})
