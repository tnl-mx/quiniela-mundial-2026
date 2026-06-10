import { useCallback, useEffect, useState } from 'react'

// Hook centralizado del estado de prediccion del usuario.
//
// La forma del estado mapea 1-a-1 al schema oficial v1 documentado en
// docs/ESQUEMA-prediccion-v1.md (sin el bloque "meta", que se genera al
// exportar con nombre, fecha, etc.). Esto permite que la serializacion al
// JSON de export sea casi un JSON.stringify directo en el futuro.
//
// Persistencia: cada cambio se guarda en localStorage de forma automatica.
// Si el navegador bloquea localStorage (modo privado en algunos browsers),
// la app sigue funcionando en memoria pero sin persistir.

const STORAGE_KEY = 'quiniela-mundial-2026:v1'

export function emptyMeta() {
  // Datos del participante. Una persona = una sola quiniela (no hay numero de
  // quiniela). schemaVersion/exportedAt/tournament NO viven aqui: se generan
  // al exportar (ver src/logic/predictionIO.js).
  return { firstName: '', lastName: '', email: '' }
}

// Estado totalmente vacio, SIN datos del participante. Usado por el "borrar
// todo" (Empezar de nuevo): al quedar firstName vacio, el gate de App.jsx
// vuelve a mostrar la bienvenida.
export function emptyPrediction() {
  return {
    meta: emptyMeta(),
    groupMatches: {},
    groupTiebreaks: {},
    thirdPlaceTiebreaks: [],
    knockout: {},
    champion: null,
    awards: {
      goldenBall: null,
      goldenBoot: null,
      goldenGlove: null,
      youngPlayer: null,
      fairPlay: null,
    },
    wildcards: {},
  }
}

function loadFromStorage() {
  if (typeof window === 'undefined') return emptyPrediction()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPrediction()
    const parsed = JSON.parse(raw)
    // Merge defensivo: si el storage tenia un objeto antiguo o parcial,
    // completamos con los campos default. Asi la app no truena por una
    // version vieja del esquema. meta se mezcla a su vez campo por campo
    // (un estado viejo sin meta recibe el default completo).
    const base = emptyPrediction()
    return {
      ...base,
      ...parsed,
      meta: { ...base.meta, ...(parsed.meta ?? {}) },
    }
  } catch {
    return emptyPrediction()
  }
}

function saveToStorage(prediction) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prediction))
  } catch (e) {
    // Modo privado u otro motivo: avisamos en consola pero no rompemos UI.
    console.warn('No se pudo guardar en localStorage:', e)
  }
}

// ---- Mapa de IDs de la fase eliminatoria, ronda por ronda ----------------
// El orden del array refleja el avance del torneo: cada ronda alimenta a la
// siguiente. Esto nos deja calcular "desde esta ronda hacia adelante".
const KNOCKOUT_ROUND_IDS = {
  r32: ['M73','M74','M75','M76','M77','M78','M79','M80',
        'M81','M82','M83','M84','M85','M86','M87','M88'],
  r16: ['M89','M90','M91','M92','M93','M94','M95','M96'],
  qf:  ['M97','M98','M99','M100'],
  sf:  ['M101','M102'],
  third: ['M103'], // tercer lugar (no alimenta a nadie)
  final: ['M104'], // final (define al campeon)
}

// Orden de cascada. third va antes de final, como en el calendario real,
// pero ojo: third NO es prerequisito de final (son independientes). El orden
// aqui solo sirve para "desde X hacia adelante".
const KNOCKOUT_CASCADE = ['r32', 'r16', 'qf', 'sf', 'third', 'final']

// Dada una fase eliminatoria, devuelve { ids, clearChampion } con las llaves
// a borrar. Devuelve null si la fase no se reconoce.
function knockoutResetPlan(phase) {
  // Toda la eliminatoria de un golpe.
  if (phase === 'knockout') {
    const ids = KNOCKOUT_CASCADE.flatMap((r) => KNOCKOUT_ROUND_IDS[r])
    return { ids, clearChampion: true }
  }
  // Casos especiales que NO arrastran cascada.
  if (phase === 'third') {
    return { ids: [...KNOCKOUT_ROUND_IDS.third], clearChampion: false }
  }
  if (phase === 'final') {
    return { ids: [...KNOCKOUT_ROUND_IDS.final], clearChampion: true }
  }
  // Rondas con cascada: desde la ronda elegida hasta la final (incluye
  // tercer lugar y final, por eso siempre limpia champion).
  const startIdx = KNOCKOUT_CASCADE.indexOf(phase)
  if (startIdx === -1) return null
  const ids = KNOCKOUT_CASCADE
    .slice(startIdx)
    .flatMap((r) => KNOCKOUT_ROUND_IDS[r])
  return { ids, clearChampion: true }
}

export function usePrediction() {
  const [prediction, setPrediction] = useState(loadFromStorage)

  // Auto-guardado en cada cambio.
  useEffect(() => {
    saveToStorage(prediction)
  }, [prediction])

  // ---- Datos del participante (meta) -----------------------------------

  // Mezcla campos de meta (firstName, lastName, email). Lo usa tanto la
  // pantalla de bienvenida como el modal de "editar mis datos".
  const setMeta = useCallback((partial) => {
    setPrediction((p) => ({
      ...p,
      meta: { ...p.meta, ...partial },
    }))
  }, [])

  // Reemplaza TODO el estado de prediccion. Lo usa el import tras validar el
  // JSON. Mezcla con emptyPrediction para garantizar que no falte ningun
  // campo del esquema aunque el JSON viniera incompleto.
  const replacePrediction = useCallback((incoming) => {
    const base = emptyPrediction()
    setPrediction({
      ...base,
      ...incoming,
      meta: { ...base.meta, ...(incoming?.meta ?? {}) },
    })
  }, [])

  // ---- setters ---------------------------------------------------------

  // Guarda el marcador de un partido de grupos. Si el grupo tenia un
  // groupTiebreak guardado, lo LIMPIAMOS (porque la nueva tabla podria
  // resolver el empate o cambiar quienes estan empatados). Si todavia
  // queda empate al cerrar el grupo, se lo pediremos al usuario otra vez.
  const setMatchScore = useCallback((matchId, hs, as) => {
    setPrediction((p) => {
      const groupCode = matchId[0] // "A1" -> "A"
      const next = {
        ...p,
        groupMatches: { ...p.groupMatches, [matchId]: { hs, as } },
      }
      if (p.groupTiebreaks[groupCode]) {
        const { [groupCode]: _, ...rest } = p.groupTiebreaks
        next.groupTiebreaks = rest
      }
      return next
    })
  }, [])

  // Guarda el orden manual de los 4 equipos del grupo (orden final).
  const setGroupTiebreak = useCallback((groupCode, orderOfFour) => {
    setPrediction((p) => ({
      ...p,
      groupTiebreaks: { ...p.groupTiebreaks, [groupCode]: orderOfFour },
    }))
  }, [])

  // Borra el tiebreak de un grupo (util si la UI quiere hacerlo manual).
  const clearGroupTiebreak = useCallback((groupCode) => {
    setPrediction((p) => {
      if (!p.groupTiebreaks[groupCode]) return p
      const { [groupCode]: _, ...rest } = p.groupTiebreaks
      return { ...p, groupTiebreaks: rest }
    })
  }, [])

  // ---- Knockout (fase eliminatoria) -----------------------------------

  // Guarda el marcador de una llave eliminatoria, incluyendo home/away
  // ("fotografia" del bracket en ese momento). Persistir home/away en el
  // estado es importante porque el schema v1 los guarda y porque la UI
  // detecta "stale" comparando stored.home/away vs el bracket actual.
  // Si el score deja de ser empate, limpia pens (ya no son relevantes).
  const setKnockoutScore = useCallback(
    (matchId, hs, as, home, away) => {
      setPrediction((p) => {
        const existing = p.knockout[matchId] ?? {}
        const next = { ...existing, home, away, hs, as }
        if (hs !== as && next.pens) {
          delete next.pens
        }
        return {
          ...p,
          knockout: { ...p.knockout, [matchId]: next },
        }
      })
    },
    [],
  )

  // Guarda la tanda de penales. El motor exige pens.went = true para
  // considerarla resuelta; siempre lo dejamos en true cuando guardamos.
  const setKnockoutPens = useCallback((matchId, pHs, pAs) => {
    setPrediction((p) => {
      const existing = p.knockout[matchId] ?? {}
      return {
        ...p,
        knockout: {
          ...p.knockout,
          [matchId]: {
            ...existing,
            pens: { went: true, hs: pHs, as: pAs },
          },
        },
      }
    })
  }, [])

  // Setter del campeon. La UI lo sincroniza con el resultado de
  // buildBracket via useEffect en el Wizard; aqui solo persistimos.
  const setChampion = useCallback((code) => {
    setPrediction((p) => {
      if (p.champion === code) return p
      return { ...p, champion: code }
    })
  }, [])

  // Aplica en una sola operacion atomica varios marcadores nuevos y, si
  // hace falta, varios tiebreaks Y varios resultados de bracket. Se usa
  // cuando el usuario rellena al azar (un grupo, todo lo que falta, o el
  // bracket completo). Para que el estado quede consistente, todo se
  // escribe en un solo setPrediction.
  //
  // matchUpdates: { matchId: { hs, as } }
  // tiebreakUpdates: { groupCode: [code1, code2, code3, code4] }
  // knockoutUpdates: { matchId: { home, away, hs, as, pens? } }
  // champion: string | null   (codigo del campeon despues del relleno)
  const applyRandomFill = useCallback(
    ({ matchUpdates, tiebreakUpdates, knockoutUpdates, champion }) => {
      setPrediction((p) => {
        const next = {
          ...p,
          groupMatches: { ...p.groupMatches, ...(matchUpdates ?? {}) },
          groupTiebreaks: { ...p.groupTiebreaks, ...(tiebreakUpdates ?? {}) },
          knockout: { ...p.knockout, ...(knockoutUpdates ?? {}) },
        }
        if (champion !== undefined) {
          next.champion = champion
        }
        return next
      })
    },
    [],
  )

  // Reseteo por fase. La regla acordada es "limpiar desde esta fase hacia
  // adelante", porque las fases dependen unas de otras: resetear una ronda
  // obliga a borrar TODO lo posterior para no dejar huecos en medio.
  //
  // Fases aceptadas:
  //   'groups'   -> borra grupos + desempates + todo el bracket (grupos
  //                 definen lo demas, asi que arrastra todo).
  //   'knockout' -> borra toda la fase eliminatoria (R32..Final + tercer
  //                 lugar + champion). Deja grupos intactos.
  //   'r32'/'r16'/'qf'/'sf' -> borran esa ronda y todo lo que viene despues
  //                 (incluido tercer lugar y final + champion). Dejan grupos
  //                 y las rondas anteriores intactas.
  //   'final'    -> caso especial: borra SOLO la final (M104) + champion.
  //   'third'    -> caso especial: borra SOLO el tercer lugar (M103). Como
  //                 M103 no alimenta a nadie, no toca la final ni champion.
  const resetFromPhase = useCallback((phase) => {
    setPrediction((p) => {
      if (phase === 'groups') {
        return {
          ...p,
          groupMatches: {},
          groupTiebreaks: {},
          thirdPlaceTiebreaks: [],
          knockout: {},
          champion: null,
        }
      }

      const plan = knockoutResetPlan(phase)
      if (!plan) return p // fase desconocida: no tocamos nada.

      const knockout = { ...p.knockout }
      for (const id of plan.ids) {
        delete knockout[id]
      }
      const next = { ...p, knockout }
      if (plan.clearChampion) next.champion = null
      return next
    })
  }, [])

  // "Mi quiniela en blanco" — borra TODAS las predicciones pero conserva la
  // identidad (nombre/apellido/correo). Sigues siendo tu; NO vuelve a la
  // bienvenida (firstName sigue presente).
  const resetAll = useCallback(() => {
    setPrediction((p) => ({ ...emptyPrediction(), meta: p.meta }))
  }, [])

  // "Borrar todo" — limpia el almacenamiento de la app y deja el estado vacio
  // TOTAL (sin meta). Al quedar firstName vacio, el gate de App.jsx vuelve a
  // mostrar la bienvenida; y como borramos la clave de localStorage, tambien
  // reaparece tras refrescar.
  const wipeEverything = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch (e) {
        console.warn('No se pudo limpiar localStorage:', e)
      }
    }
    setPrediction(emptyPrediction())
  }, [])

  return {
    prediction,
    setMeta,
    replacePrediction,
    setMatchScore,
    setGroupTiebreak,
    clearGroupTiebreak,
    setKnockoutScore,
    setKnockoutPens,
    setChampion,
    applyRandomFill,
    resetFromPhase,
    resetAll,
    wipeEverything,
  }
}
