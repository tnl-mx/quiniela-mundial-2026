// Mezcla de resultados OFICIALES (real-results.json del repo) con el BORRADOR
// local del organizador (localStorage), para el panel de admin.
//
// Regla (lo OFICIAL es la base):
//   - El oficial es la base: esos partidos aparecen ya capturados.
//   - El borrador local se aplica ENCIMA solo para lo que el oficial no tiene
//     (cambios nuevos sin subir) o para conflictos que el usuario decidio
//     conservar.
//   - CONFLICTO = un mismo partido existe en ambos pero con marcador distinto.
//     No se pisa en silencio: se marca y el usuario elige cual conservar.
//
// Es PURA (sin React ni fetch) para poder probarla a fondo.

function sameG(a, b) {
  return !!a && !!b && a.hs === b.hs && a.as === b.as
}

function samePens(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  return !!a.went === !!b.went && a.hs === b.hs && a.as === b.as
}

function sameK(a, b) {
  return !!a && !!b && a.hs === b.hs && a.as === b.as && samePens(a.pens, b.pens)
}

// Detecta conflictos INICIALES: ids presentes en ambos (oficial y borrador) con
// distinto marcador. Se calcula al abrir el panel (fotografia del momento).
export function findConflicts(official, draft) {
  const ids = new Set()
  const oG = official.groupMatches ?? {}
  const dG = draft.groupMatches ?? {}
  for (const id of Object.keys(dG)) {
    if (oG[id] && !sameG(oG[id], dG[id])) ids.add(id)
  }
  const oK = official.knockout ?? {}
  const dK = draft.knockout ?? {}
  for (const id of Object.keys(dK)) {
    if (oK[id] && !sameK(oK[id], dK[id])) ids.add(id)
  }
  return ids
}

// Clasifica UN partido:
//   'official' -> viene del archivo oficial (sin cambio local pendiente)
//   'local'    -> cambio local sin subir (nuevo, o conflicto resuelto a "mío")
//   'conflict' -> difiere del oficial y el usuario aun no decide
//   'empty'    -> nadie lo tiene
function classify(off, loc, active, sameFn) {
  if (active) return 'conflict'
  if (loc) {
    if (!off) return 'local'
    return sameFn(off, loc) ? 'official' : 'local'
  }
  if (off) return 'official'
  return 'empty'
}

// Mezcla oficial + borrador y devuelve:
//   - effective: objeto con forma de real-results (para buildBracket / export)
//   - groupClass / koClass: { id: 'official'|'local'|'conflict'|'empty' }
//   - counts: { official, local, conflict }
//
// conflicts = Set de ids en conflicto inicial; keptLocal = Set de ids cuyo
// conflicto el usuario resolvio "conservar el mío".
export function mergeRealResults({ official, draft, conflicts = new Set(), keptLocal = new Set() }) {
  const off = {
    groupMatches: {},
    knockout: {},
    groupTiebreaks: {},
    thirdPlaceTiebreaks: [],
    ...official,
  }

  const effective = {
    groupMatches: { ...off.groupMatches },
    knockout: { ...off.knockout },
    groupTiebreaks: { ...(off.groupTiebreaks ?? {}), ...(draft.groupTiebreaks ?? {}) },
    thirdPlaceTiebreaks:
      (draft.thirdPlaceTiebreaks?.length ? draft.thirdPlaceTiebreaks : off.thirdPlaceTiebreaks) ?? [],
  }

  const groupClass = {}
  const koClass = {}

  const gIds = new Set([
    ...Object.keys(off.groupMatches ?? {}),
    ...Object.keys(draft.groupMatches ?? {}),
  ])
  for (const id of gIds) {
    const o = off.groupMatches?.[id]
    const l = draft.groupMatches?.[id]
    const active = conflicts.has(id) && !keptLocal.has(id) && !!o && !!l && !sameG(o, l)
    groupClass[id] = classify(o, l, active, sameG)
    const value = active ? o : l ?? o
    if (value === undefined) delete effective.groupMatches[id]
    else effective.groupMatches[id] = value
  }

  const kIds = new Set([
    ...Object.keys(off.knockout ?? {}),
    ...Object.keys(draft.knockout ?? {}),
  ])
  for (const id of kIds) {
    const o = off.knockout?.[id]
    const l = draft.knockout?.[id]
    const active = conflicts.has(id) && !keptLocal.has(id) && !!o && !!l && !sameK(o, l)
    koClass[id] = classify(o, l, active, sameK)
    const value = active ? o : l ?? o
    if (value === undefined) delete effective.knockout[id]
    else effective.knockout[id] = value
  }

  let official_ = 0
  let local = 0
  let conflict = 0
  for (const cls of [...Object.values(groupClass), ...Object.values(koClass)]) {
    if (cls === 'official') official_++
    else if (cls === 'local') local++
    else if (cls === 'conflict') conflict++
  }

  return { effective, groupClass, koClass, counts: { official: official_, local, conflict } }
}
