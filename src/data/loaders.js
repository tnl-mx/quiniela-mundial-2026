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

// ---------- Datos para el leaderboard (multi-torneo) -----------------------
// La estructura es multi-torneo: cada torneo tiene su carpeta de quinielas
// (predictionsDir) pero TODOS comparten el mismo real-results del Mundial.
// La config vive en tournaments.json (fuente unica, compartida con el script
// que genera los indices).

export async function loadScoring() {
  return fetchJson('scoring.json')
}

// Lista de torneos disponibles y el nombre del real-results compartido.
export async function loadTournamentsConfig() {
  return fetchJson('tournaments.json')
}

// Resultados reales del Mundial (compartidos por todos los torneos).
export async function loadRealResults(file = 'real-results.json') {
  return fetchJson(file)
}

// Indice (array de nombres de archivo) de las quinielas de un torneo.
// `dir` es la carpeta del torneo, ej. "predictions/familia".
export async function loadPredictionIndex(dir) {
  return fetchJson(`${dir}/index.json`)
}

// Lee UNA quiniela por su carpeta de torneo + nombre de archivo.
export async function loadPrediction(dir, file) {
  return fetchJson(`${dir}/${file}`)
}
