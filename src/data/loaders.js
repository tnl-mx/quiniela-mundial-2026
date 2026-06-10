// Capa de carga de datos. Lee los JSON y CSV de public/data/ via fetch.
// Las rutas se construyen con import.meta.env.BASE_URL para que funcionen
// tanto en dev (base '/') como en GitHub Pages bajo subcarpeta
// (base '/quiniela-mundial-2026/'). Si usaramos rutas absolutas tipo
// '/data/...' apuntarian mal en produccion (a la raiz del dominio).

import { parseAnnexCcsv } from '../logic/annexC.js'

// Devuelve siempre la URL relativa a la base de la app (import.meta.env.BASE_URL).
// En dev es '/'; en GitHub Pages podria ser '/quiniela-mundial-2026/'.
function dataUrl(file) {
  const base = import.meta.env.BASE_URL ?? '/'
  return `${base}data/${file}`.replace(/\/+/g, '/')
}

async function fetchJson(file) {
  const res = await fetch(dataUrl(file))
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${file}: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function fetchText(file) {
  const res = await fetch(dataUrl(file))
  if (!res.ok) {
    throw new Error(`No se pudo cargar ${file}: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

export async function loadTeams() {
  return fetchJson('teams.json')
}

export async function loadTournament() {
  return fetchJson('tournament.json')
}

export async function loadAnnexCOptions() {
  const text = await fetchText('annex_C_combinations.csv')
  return parseAnnexCcsv(text)
}
