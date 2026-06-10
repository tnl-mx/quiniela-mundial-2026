// Utilidades PURAS de entrada/salida de la prediccion (export e import).
//
// Aqui NO hay React ni acceso a disco/portapapeles: solo transformaciones de
// datos y validacion. La UI (ExportPanel/ImportPanel) usa estas funciones y
// se encarga de descargar, copiar o leer archivos.
//
// El formato sigue el schema v1 documentado en docs/ESQUEMA-prediccion-v1.md.
// Si algun dia cambia el formato, se sube SCHEMA_VERSION y se migra.

export const SCHEMA_VERSION = 1
export const TOURNAMENT_NAME = 'FIFA World Cup 2026'

// IDs oficiales de la fase eliminatoria (cuadro FIFA): M73..M104.
const KNOCKOUT_IDS = (() => {
  const ids = []
  for (let n = 73; n <= 104; n++) ids.push(`M${n}`)
  return new Set(ids)
})()

// ---------- Helpers internos -----------------------------------------------

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

// Normaliza un texto para usarlo en un nombre de archivo: sin acentos, sin
// espacios ni simbolos, en minusculas. "Ana Lopez" -> "ana-lopez".
function slug(text) {
  return (text ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, '-') // todo lo demas -> guion
    .replace(/^-+|-+$/g, '') // sin guiones al borde
    .toLowerCase()
}

// ---------- Serializacion (export) -----------------------------------------

// Construye el objeto JSON completo del schema v1 a partir del estado interno.
// exportedAt se recibe desde fuera (la UI pasa new Date().toISOString()) para
// que esta funcion sea pura y facil de testear.
export function serializePrediction(prediction, { exportedAt = null } = {}) {
  const meta = prediction?.meta ?? {}
  return {
    meta: {
      firstName: meta.firstName ?? '',
      lastName: meta.lastName ?? '',
      email: meta.email ?? '',
      schemaVersion: SCHEMA_VERSION,
      exportedAt,
      tournament: TOURNAMENT_NAME,
    },
    groupMatches: prediction?.groupMatches ?? {},
    groupTiebreaks: prediction?.groupTiebreaks ?? {},
    thirdPlaceTiebreaks: prediction?.thirdPlaceTiebreaks ?? [],
    // knockout se guarda tal cual: incluye la "fotografia" home/away de cada
    // llave + hs/as + pens. Asi al reimportar se reconstruye identico sin
    // recalcular nada.
    knockout: prediction?.knockout ?? {},
    champion: prediction?.champion ?? null,
    awards: prediction?.awards ?? {
      goldenBall: null,
      goldenBoot: null,
      goldenGlove: null,
      youngPlayer: null,
      fairPlay: null,
    },
    wildcards: prediction?.wildcards ?? {},
  }
}

// Devuelve el JSON como texto bonito (indentado), listo para descargar o
// pegar en WhatsApp.
export function predictionToJsonString(prediction, opts) {
  return JSON.stringify(serializePrediction(prediction, opts), null, 2)
}

// Nombre de archivo sugerido: quiniela-{nombre}-{apellido}.json
// (nombres repetidos no son problema: el organizador los desambigua).
export function suggestedFileName(meta = {}) {
  const first = slug(meta.firstName) || 'sin-nombre'
  const last = slug(meta.lastName)
  const who = last ? `${first}-${last}` : first
  return `quiniela-${who}.json`
}

// ---------- Validacion + parseo (import) -----------------------------------

// Convierte un objeto JSON validado a la forma interna del estado (meta
// recortada a los 4 campos editables; el resto del esquema completo).
function toInternalPrediction(json) {
  const meta = json.meta ?? {}
  return {
    meta: {
      firstName: typeof meta.firstName === 'string' ? meta.firstName : '',
      lastName: typeof meta.lastName === 'string' ? meta.lastName : '',
      email: typeof meta.email === 'string' ? meta.email : '',
    },
    groupMatches: isPlainObject(json.groupMatches) ? json.groupMatches : {},
    groupTiebreaks: isPlainObject(json.groupTiebreaks) ? json.groupTiebreaks : {},
    thirdPlaceTiebreaks: Array.isArray(json.thirdPlaceTiebreaks)
      ? json.thirdPlaceTiebreaks
      : [],
    knockout: isPlainObject(json.knockout) ? json.knockout : {},
    champion: typeof json.champion === 'string' ? json.champion : null,
    awards: isPlainObject(json.awards)
      ? json.awards
      : {
          goldenBall: null,
          goldenBoot: null,
          goldenGlove: null,
          youngPlayer: null,
          fairPlay: null,
        },
    wildcards: isPlainObject(json.wildcards) ? json.wildcards : {},
  }
}

// Validacion razonable (no exhaustiva) de coherencia con el torneo. Genera
// WARNINGS (no bloquean), porque puede que el JSON venga de una version con
// codigos ligeramente distintos y aun asi el usuario quiera cargarlo.
function collectWarnings(json, { tournament, teams }) {
  const warnings = []
  if (!tournament && !teams) return warnings // sin datos: no validamos codigos.

  const validGroupIds = tournament
    ? new Set(tournament.groupMatches.map((m) => m.id))
    : null
  const validTeamCodes = teams ? new Set(Object.keys(teams)) : null

  // IDs de partidos de grupo desconocidos.
  if (validGroupIds) {
    const unknown = Object.keys(json.groupMatches ?? {}).filter(
      (id) => !validGroupIds.has(id),
    )
    if (unknown.length) {
      warnings.push(
        `Hay ${unknown.length} id(s) de partido de grupo no reconocido(s): ${unknown
          .slice(0, 5)
          .join(', ')}${unknown.length > 5 ? '…' : ''}.`,
      )
    }
  }

  // IDs de llaves eliminatorias fuera del rango M73..M104.
  const unknownKo = Object.keys(json.knockout ?? {}).filter(
    (id) => !KNOCKOUT_IDS.has(id),
  )
  if (unknownKo.length) {
    warnings.push(
      `Hay ${unknownKo.length} id(s) de llave no reconocido(s): ${unknownKo
        .slice(0, 5)
        .join(', ')}${unknownKo.length > 5 ? '…' : ''}.`,
    )
  }

  // Codigos de equipo desconocidos en knockout (home/away) y champion.
  if (validTeamCodes) {
    const badCodes = new Set()
    for (const ko of Object.values(json.knockout ?? {})) {
      if (ko?.home && !validTeamCodes.has(ko.home)) badCodes.add(ko.home)
      if (ko?.away && !validTeamCodes.has(ko.away)) badCodes.add(ko.away)
    }
    if (json.champion && !validTeamCodes.has(json.champion)) {
      badCodes.add(json.champion)
    }
    if (badCodes.size) {
      warnings.push(
        `Hay ${badCodes.size} codigo(s) de equipo no reconocido(s): ${[...badCodes]
          .slice(0, 5)
          .join(', ')}${badCodes.size > 5 ? '…' : ''}.`,
      )
    }
  }

  return warnings
}

// Parsea y valida un texto de import. Devuelve:
//   { ok: true,  prediction, warnings }   -> listo para cargar (warnings no bloquean)
//   { ok: false, error }                  -> rechazado, con mensaje claro
//
// dataset es opcional: { tournament, teams }. Si no se pasa, se omite la
// validacion de codigos/ids (solo se valida la estructura del esquema).
export function parseAndValidate(text, { tournament, teams } = {}) {
  // 1) JSON valido.
  let json
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' }
  }

  // 2) Debe ser un objeto.
  if (!isPlainObject(json)) {
    return {
      ok: false,
      error: 'El JSON no tiene la forma esperada (se esperaba un objeto).',
    }
  }

  // 3) meta + schemaVersion.
  if (!isPlainObject(json.meta)) {
    return {
      ok: false,
      error: 'Falta el bloque "meta" del esquema. ¿Es una quiniela exportada?',
    }
  }
  if (json.meta.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Versión de esquema no compatible (se esperaba ${SCHEMA_VERSION}, llegó ${json.meta.schemaVersion ?? 'ninguna'}).`,
    }
  }

  // 4) Estructura principal minima.
  if (!isPlainObject(json.groupMatches) || !isPlainObject(json.knockout)) {
    return {
      ok: false,
      error: 'Faltan campos principales del esquema (groupMatches/knockout).',
    }
  }

  // 5) Validacion razonable de coherencia (no bloqueante).
  const warnings = collectWarnings(json, { tournament, teams })

  return { ok: true, prediction: toInternalPrediction(json), warnings }
}
