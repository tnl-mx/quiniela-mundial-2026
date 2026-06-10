// Calculo de la tabla de UN grupo a partir de marcadores predichos.
//
// Reglas:
//   - Victoria = 3 puntos, empate = 1, derrota = 0.
//   - Orden: 1) puntos, 2) diferencia de goles, 3) goles a favor.
//   - Si dos o mas equipos quedan EXACTAMENTE iguales en esos tres
//     criterios, se marcan como empate no resuelto (tied: true) y entre
//     ellos se aplica un orden PROVISIONAL por ranking FIFA (numero mas
//     bajo = mejor = primero). Ese orden es solo una sugerencia visual;
//     el desempate definitivo lo decide el usuario en la interfaz.

const PTS_WIN = 3
const PTS_DRAW = 1

// Un marcador es valido solo si tiene dos numeros no negativos.
// Asi un partido sin capturar (undefined, null o a medias) simplemente
// se ignora y la funcion no truena.
function isValidScore(score) {
  return (
    score != null &&
    Number.isFinite(score.hs) && score.hs >= 0 &&
    Number.isFinite(score.as) && score.as >= 0
  )
}

// Fila vacia para inicializar las estadisticas de cada equipo.
function emptyRow(code) {
  return {
    code,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  }
}

export function calculateGroupTable({
  groupCode,
  predictions = {},
  tournament,
  teams = {},
}) {
  // 1) Sacamos los 4 codigos de equipo del grupo y arrancamos su fila en cero.
  const teamCodes = tournament.groups[groupCode] ?? []
  const rowsByCode = new Map()
  for (const code of teamCodes) {
    rowsByCode.set(code, emptyRow(code))
  }

  // 2) Nos quedamos con los partidos de ese grupo.
  const matches = tournament.groupMatches.filter((m) => m.group === groupCode)

  // 3) Para cada partido con marcador valido, sumamos a las dos filas.
  for (const match of matches) {
    const score = predictions[match.id]
    if (!isValidScore(score)) continue

    const home = rowsByCode.get(match.home)
    const away = rowsByCode.get(match.away)
    if (!home || !away) continue

    const hs = score.hs
    const as_ = score.as

    home.played += 1
    away.played += 1
    home.goalsFor += hs
    home.goalsAgainst += as_
    away.goalsFor += as_
    away.goalsAgainst += hs

    if (hs > as_) {
      home.wins += 1
      home.points += PTS_WIN
      away.losses += 1
    } else if (hs < as_) {
      away.wins += 1
      away.points += PTS_WIN
      home.losses += 1
    } else {
      home.draws += 1
      away.draws += 1
      home.points += PTS_DRAW
      away.points += PTS_DRAW
    }
  }

  // 4) Pasamos el Map a un arreglo y calculamos la diferencia de goles.
  const rows = [...rowsByCode.values()].map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
  }))

  // 5) Ordenamos. Los tres primeros criterios son los "de verdad".
  //    El cuarto criterio (ranking FIFA) es solo un orden PROVISIONAL
  //    entre equipos perfectamente empatados; los marcamos como tied
  //    abajo para que la interfaz pida el desempate manual.
  const fifaRank = (code) =>
    teams[code]?.fifaRank ?? Number.POSITIVE_INFINITY

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference
    }
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return fifaRank(a.code) - fifaRank(b.code)
  })

  // 6) Detectamos empates no resueltos: filas consecutivas (ya ordenadas)
  //    que coinciden EXACTAMENTE en puntos, diferencia de goles y goles
  //    a favor. Agrupamos sus indices.
  const sameTrio = (a, b) =>
    a.points === b.points &&
    a.goalDifference === b.goalDifference &&
    a.goalsFor === b.goalsFor

  const tieGroups = []
  let currentGroup = [0]
  for (let i = 1; i < rows.length; i++) {
    if (sameTrio(rows[i - 1], rows[i])) {
      currentGroup.push(i)
    } else {
      tieGroups.push(currentGroup)
      currentGroup = [i]
    }
  }
  if (rows.length > 0) tieGroups.push(currentGroup)

  // 7) Devolvemos cada fila con posicion (1..n) y la info de empate.
  return rows.map((row, index) => {
    const group = tieGroups.find((g) => g.includes(index)) ?? [index]
    const tied = group.length > 1
    const tiedWith = tied
      ? group.filter((i) => i !== index).map((i) => rows[i].code)
      : []
    return {
      ...row,
      position: index + 1,
      tied,
      tiedWith,
    }
  })
}
