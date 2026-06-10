// Serializador del archivo OFICIAL de resultados reales (real-results.json).
//
// Toma el BORRADOR del panel de admin + el BRACKET ya resuelto por buildBracket
// (sobre ese mismo borrador) y arma el JSON EXACTO que consume el motor de
// scoring (scorePrediction lo lee como `realResults`):
//
//   {
//     "groupMatches": { "A1": { "hs": 2, "as": 1 }, ... },
//     "knockout":     { "M73": { "home": "MEX", "away": "KOR",
//                                "hs": 1, "as": 1,
//                                "pens": { "went": true, "hs": 4, "as": 3 } }, ... },
//     "champion": "ARG",
//     "awards": {}
//   }
//
// Decisiones clave:
//   - El home/away de cada llave eliminatoria se toma del BRACKET VIVO (los
//     equipos correctos segun los resultados reales), NO de lo guardado.
//   - Solo se incluye lo que YA se capturo (lo no jugado queda fuera -> "por
//     jugar" para el motor).
//   - Una llave "stale" (su marcador guardado pertenece a OTROS equipos porque
//     el cuadro se recalculo) se EXCLUYE: nunca mandamos un marcador aplicado a
//     equipos distintos al archivo oficial.

import { isStaleKnockout } from './knockoutStale.js'

function isValidScore(s) {
  return s != null && Number.isFinite(s.hs) && Number.isFinite(s.as)
}

// Todas las llaves del bracket en orden de ronda.
function allBracketMatches(bracket) {
  return [
    ...bracket.r32,
    ...bracket.r16,
    ...bracket.qf,
    ...bracket.sf,
    ...bracket.third,
    ...bracket.final,
  ]
}

export function buildRealResultsJson({ draft, bracket }) {
  // --- Fase de grupos: copiamos los marcadores capturados validos ---
  const groupMatches = {}
  for (const [id, s] of Object.entries(draft.groupMatches ?? {})) {
    if (isValidScore(s)) {
      groupMatches[id] = { hs: s.hs, as: s.as }
    }
  }

  // --- Eliminatoria: desde el bracket vivo, solo llaves capturadas y NO stale ---
  const knockout = {}
  for (const m of allBracketMatches(bracket)) {
    if (!m.home || !m.away) continue // llave aun sin equipos: no se incluye
    if (!isValidScore(m)) continue // sin marcador capturado: "por jugar"

    const stored = draft.knockout?.[m.id]
    // Si el marcador guardado pertenece a otros equipos (cuadro recalculado),
    // lo omitimos: el archivo oficial nunca lleva un marcador "revisar".
    if (isStaleKnockout(stored, m)) continue

    const entry = { home: m.home, away: m.away, hs: m.hs, as: m.as }
    if (m.pens && m.pens.went) {
      entry.pens = { went: true, hs: m.pens.hs, as: m.pens.as }
    }
    knockout[m.id] = entry
  }

  return {
    groupMatches,
    knockout,
    champion: bracket.champion ?? null,
    awards: {},
  }
}
