import { useCallback, useEffect, useState } from 'react'

// Estado del BORRADOR de resultados reales del panel de admin.
//
// Tiene la MISMA forma que una prediccion / que real-results.json
// (groupMatches, knockout, groupTiebreaks, thirdPlaceTiebreaks), para poder
// pasarlo TAL CUAL a buildBracket y armar el cuadro real automaticamente.
//
// OJO: vive en una clave de localStorage PROPIA, totalmente separada de la
// quiniela del participante (usePrediction). Asi el panel del organizador no
// interfiere con lo que la gente esta llenando.
//
// Este es el borrador LOCAL del organizador; el archivo oficial sigue
// actualizandose por commit (el panel solo genera el JSON para descargar).

const STORAGE_KEY = 'quiniela-mundial-2026:admin-real-results:v1'

function emptyDraft() {
  return {
    groupMatches: {},
    knockout: {},
    groupTiebreaks: {},
    thirdPlaceTiebreaks: [],
  }
}

function loadFromStorage() {
  if (typeof window === 'undefined') return emptyDraft()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDraft()
    return { ...emptyDraft(), ...JSON.parse(raw) }
  } catch {
    return emptyDraft()
  }
}

function saveToStorage(draft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch (e) {
    console.warn('No se pudo guardar el borrador de admin:', e)
  }
}

export function useRealResultsDraft() {
  const [draft, setDraft] = useState(loadFromStorage)

  useEffect(() => {
    saveToStorage(draft)
  }, [draft])

  // --- Fase de grupos ---

  // Guarda el marcador real de un partido de grupo. Si el grupo tenia un
  // desempate manual, lo limpiamos (la tabla pudo cambiar).
  const setGroupScore = useCallback((matchId, hs, as) => {
    setDraft((d) => {
      const group = matchId[0]
      const next = {
        ...d,
        groupMatches: { ...d.groupMatches, [matchId]: { hs, as } },
      }
      if (d.groupTiebreaks[group]) {
        const { [group]: _omit, ...rest } = d.groupTiebreaks
        next.groupTiebreaks = rest
      }
      return next
    })
  }, [])

  // Borra el marcador de un partido de grupo (volver a "por capturar").
  const clearGroupScore = useCallback((matchId) => {
    setDraft((d) => {
      if (!d.groupMatches[matchId]) return d
      const { [matchId]: _omit, ...rest } = d.groupMatches
      return { ...d, groupMatches: rest }
    })
  }, [])

  // Orden manual de los 4 equipos de un grupo (desempate exacto que FIFA
  // resuelve por criterios extra; aqui lo fija el organizador).
  const setGroupTiebreak = useCallback((groupCode, orderOfFour) => {
    setDraft((d) => ({
      ...d,
      groupTiebreaks: { ...d.groupTiebreaks, [groupCode]: orderOfFour },
    }))
  }, [])

  // --- Fase eliminatoria ---

  // Guarda el marcador de una llave, con la "fotografia" de quien la juega
  // (home/away del bracket vivo). Esa foto sirve para detectar "stale" si el
  // cuadro se recalcula. Si deja de ser empate, se limpian los penales.
  const setKnockoutScore = useCallback((matchId, hs, as, home, away) => {
    setDraft((d) => {
      const existing = d.knockout[matchId] ?? {}
      const next = { ...existing, home, away, hs, as }
      if (hs !== as && next.pens) delete next.pens
      return { ...d, knockout: { ...d.knockout, [matchId]: next } }
    })
  }, [])

  // Penales de una llave empatada (went siempre true al guardar).
  const setKnockoutPens = useCallback((matchId, pHs, pAs) => {
    setDraft((d) => {
      const existing = d.knockout[matchId] ?? {}
      return {
        ...d,
        knockout: {
          ...d.knockout,
          [matchId]: { ...existing, pens: { went: true, hs: pHs, as: pAs } },
        },
      }
    })
  }, [])

  // Borra una llave eliminatoria capturada.
  const clearKnockout = useCallback((matchId) => {
    setDraft((d) => {
      if (!d.knockout[matchId]) return d
      const { [matchId]: _omit, ...rest } = d.knockout
      return { ...d, knockout: rest }
    })
  }, [])

  // Borra TODO el borrador (con confirmacion en la UI).
  const clearAll = useCallback(() => setDraft(emptyDraft()), [])

  // Reemplaza varios marcadores de grupo de un golpe (relleno de prueba).
  const applyGroupScores = useCallback((updates) => {
    setDraft((d) => ({
      ...d,
      groupMatches: { ...d.groupMatches, ...updates },
    }))
  }, [])

  return {
    draft,
    setGroupScore,
    clearGroupScore,
    setGroupTiebreak,
    setKnockoutScore,
    setKnockoutPens,
    clearKnockout,
    clearAll,
    applyGroupScores,
  }
}
