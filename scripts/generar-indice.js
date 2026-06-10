// Generador del INDICE de quinielas, POR TORNEO.
//
// Como el sitio es estatico (GitHub Pages), el navegador no puede "listar" una
// carpeta. Por eso generamos, para CADA torneo, un index.json con los nombres
// de archivo de las quinielas de su carpeta. El dashboard de ese torneo lee su
// index.json y luego carga cada quiniela.
//
// La lista de torneos (y la carpeta de cada uno) sale de public/data/
// tournaments.json: una sola fuente de verdad, compartida con la app.
//
// Se corre:
//   - automaticamente antes del build (script "prebuild" en package.json),
//   - en el workflow de GitHub Actions antes de `npm run build`,
//   - o a mano con `npm run indice`.
//
// Asi, cuando alguien sube un nuevo JSON a la carpeta del torneo y hace push,
// el indice se regenera solo y la quiniela aparece sin pasos manuales.

import { readdirSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'public', 'data')
const CONFIG_FILE = join(DATA_DIR, 'tournaments.json')

const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))

for (const t of config.tournaments ?? []) {
  // predictionsDir viene relativo a public/data/ (ej. "predictions/familia").
  const dir = join(DATA_DIR, t.predictionsDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // Listamos solo los .json reales, excluyendo el propio index.json.
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .sort()

  writeFileSync(join(dir, 'index.json'), JSON.stringify(files, null, 2) + '\n', 'utf-8')
  console.log(`[indice] ${t.id}: ${files.length} quiniela(s) -> ${t.predictionsDir}/index.json`)
}
