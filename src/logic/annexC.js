// Logica del Annex C de las FIFA Competition Regulations 2026.
//
// El Annex C es una tabla oficial que dice, para cada combinacion posible de
// "que 8 grupos aportaron un tercero clasificado a la Ronda de 32", como se
// emparejan esos 8 terceros con los 8 ganadores de grupo que les tocan
// (ganadores de A, B, D, E, G, I, K, L; los otros 4 ganadores enfrentan
// segundos lugares y no aparecen aqui).
//
// La tabla tiene C(12,8) = 495 filas: una por cada combinacion posible de
// 8 grupos elegidos entre los 12 (A..L). Cada fila se llama "option" y esta
// numerada del 1 al 495.

// Parsea el texto del CSV a una estructura en memoria.
// Es una funcion PURA: no toca red ni filesystem. Asi es facil de probar.
export function parseAnnexCcsv(csvText) {
  // Quitamos espacios extra al final del archivo y dividimos por linea
  // (tolerando saltos CRLF de Windows).
  const lines = csvText.trim().split(/\r?\n/)

  // La primera linea son los nombres de columna.
  // Esperamos: Option,1A,1B,1D,1E,1G,1I,1K,1L
  const header = lines[0].split(',').map((c) => c.trim())

  // De "1A" sacamos solo "A". Esa letra identifica al GANADOR de grupo cuya
  // llave estamos llenando: el valor de la celda dira que tercero (3X) lo
  // enfrenta.
  const winnerGroups = header.slice(1).map((h) => h.replace(/^1/, ''))

  const dataLines = lines.slice(1)
  return dataLines.map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    const option = Number.parseInt(cells[0], 10)

    const pairings = {}
    for (let i = 0; i < winnerGroups.length; i++) {
      pairings[winnerGroups[i]] = cells[i + 1]
    }

    return { option, pairings }
  })
}

// Carga el CSV desde el servidor estatico de Vite.
// En el navegador, /data/... apunta a public/data/... gracias a Vite.
// En las pruebas NO usamos esta funcion: leemos el archivo del filesystem.
export async function loadAnnexCcsv(url = '/data/annex_C_combinations.csv') {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(
      `No se pudo cargar ${url}: ${res.status} ${res.statusText}`,
    )
  }
  const text = await res.text()
  return parseAnnexCcsv(text)
}

// Dado el conjunto de 8 grupos cuyos terceros clasificaron, encuentra la fila
// del Annex C cuya combinacion de terceros coincide EXACTAMENTE.
//
// Idea del algoritmo:
//   1. Convertimos el input a un Set para no depender del orden en que vengan.
//   2. Para cada fila del CSV, tomamos sus 8 valores tipo "3X", les quitamos
//      el "3", y formamos otro Set con esas letras de grupo.
//   3. Si ambos Sets tienen el mismo tamano y los mismos elementos, esa es
//      la fila buscada.
//   4. Como C(12,8) = 495 = numero exacto de combinaciones posibles, sabemos
//      que existe UNA Y SOLO UNA fila para cualquier conjunto valido (esto
//      lo verifica la prueba de robustez de annexC.test.js).
export function assignThirdPlaceToBracket(qualifiedGroups, options) {
  const want = new Set(qualifiedGroups)

  for (const row of options) {
    // Extraemos las letras de grupo de los valores "3X" de esta fila.
    const thirdsInRow = new Set(
      Object.values(row.pairings).map((v) => v.replace(/^3/, '')),
    )

    // Mismo tamano + cada elemento esperado esta presente => son iguales.
    if (
      thirdsInRow.size === want.size &&
      [...want].every((g) => thirdsInRow.has(g))
    ) {
      return { option: row.option, pairings: row.pairings }
    }
  }

  throw new Error(
    `No se encontro una option del Annex C que coincida con los grupos clasificados: ${[
      ...want,
    ]
      .sort()
      .join(',')}`,
  )
}
