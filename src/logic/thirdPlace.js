// Ranking de los 12 terceros lugares para decidir cuales 8 pasan a la
// Ronda de 32 y cuales 4 quedan eliminados.
//
// Reglas (las mismas que en groupTable.js):
//   - Orden: 1) puntos, 2) diferencia de goles, 3) goles a favor.
//   - Si dos o mas terceros quedan EXACTAMENTE iguales en esos tres
//     criterios, se marcan como empate no resuelto (tied: true) y entre
//     ellos se aplica un orden PROVISIONAL por ranking FIFA (numero mas
//     bajo = mejor = primero). La marca de empate se conserva siempre:
//     el desempate definitivo lo decide el usuario en la interfaz.

export function rankThirdPlacedTeams({ groupTables, teams = {} }) {
  // 1) Sacamos la fila de posicion 3 de cada grupo. Copiamos solo los
  //    campos que importan aqui: NO arrastramos el tied/tiedWith del
  //    ranking interno del grupo, porque en este nuevo ranking esos
  //    campos tendran otro significado (empate entre terceros, no dentro
  //    del grupo).
  const thirds = []
  for (const [groupCode, table] of Object.entries(groupTables)) {
    const row = table.find((r) => r.position === 3)
    if (!row) continue
    thirds.push({
      code: row.code,
      groupCode,
      played: row.played,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      points: row.points,
    })
  }

  // 2) Ordenamos por los 3 criterios + FIFA como cuarto criterio PROVISIONAL.
  const fifaRank = (code) =>
    teams[code]?.fifaRank ?? Number.POSITIVE_INFINITY

  thirds.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDifference !== a.goalDifference) {
      return b.goalDifference - a.goalDifference
    }
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return fifaRank(a.code) - fifaRank(b.code)
  })

  // 3) Detectamos empates no resueltos: filas consecutivas (ya ordenadas)
  //    que coinciden EXACTAMENTE en puntos, diferencia de goles y goles a
  //    favor. Mismo enfoque que en groupTable.
  const sameTrio = (a, b) =>
    a.points === b.points &&
    a.goalDifference === b.goalDifference &&
    a.goalsFor === b.goalsFor

  const tieGroups = []
  let currentGroup = [0]
  for (let i = 1; i < thirds.length; i++) {
    if (sameTrio(thirds[i - 1], thirds[i])) {
      currentGroup.push(i)
    } else {
      tieGroups.push(currentGroup)
      currentGroup = [i]
    }
  }
  if (thirds.length > 0) tieGroups.push(currentGroup)

  // 4) Devolvemos cada fila con posicion (1..n), si clasifico (top 8),
  //    y la info de empate.
  return thirds.map((row, index) => {
    const group = tieGroups.find((g) => g.includes(index)) ?? [index]
    const tied = group.length > 1
    const tiedWith = tied
      ? group.filter((i) => i !== index).map((i) => thirds[i].code)
      : []
    return {
      ...row,
      position: index + 1,
      qualified: index < 8,
      tied,
      tiedWith,
    }
  })
}
