// Calculo de la tabla de UN grupo a partir de marcadores.
//
// Desempate OFICIAL FIFA Mundial 2026 (Art. 13), cuando hay empate en PUNTOS:
//   1) puntos en el ENFRENTAMIENTO DIRECTO entre los equipos empatados
//   2) diferencia de goles en esos enfrentamientos directos
//   3) goles a favor en esos enfrentamientos directos
//   4) diferencia de goles GENERAL (todos los partidos del grupo)
//   5) goles a favor GENERAL
//   6) fair play (tarjetas)  -> no lo registramos: no hay datos de tarjetas
//   7) ranking FIFA
//
// OJO: para 2026 el enfrentamiento directo va PRIMERO (antes que la diferencia
// general). Es distinto a Mundiales pasados. Los criterios 1-3 se RE-APLICAN a
// cualquier subconjunto que siga empatado tras separarse parcialmente.
//
// Si dos o mas equipos quedan iguales hasta despues de aplicar todo lo que
// podemos calcular (head-to-head + diferencia/goles generales), se marcan como
// empate no resuelto (tied: true), se ordenan provisionalmente por ranking FIFA
// y el desempate definitivo (fair play / sorteo) lo decide el usuario en la
// interfaz via groupTiebreaks.

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
  const byCode = Object.fromEntries(rows.map((r) => [r.code, r]))
  const fifaRank = (code) => teams[code]?.fifaRank ?? Number.POSITIVE_INFINITY

  // Mini-tabla de ENFRENTAMIENTO DIRECTO: solo los partidos jugados ENTRE el
  // conjunto `codes` cuentan. Devuelve { code: {points, goalDifference, goalsFor} }.
  function headToHead(codes) {
    const set = new Set(codes)
    const st = Object.fromEntries(
      codes.map((c) => [c, { points: 0, goalsFor: 0, goalsAgainst: 0 }]),
    )
    for (const m of matches) {
      if (!set.has(m.home) || !set.has(m.away)) continue
      const s = predictions[m.id]
      if (!isValidScore(s)) continue
      const h = st[m.home]
      const a = st[m.away]
      h.goalsFor += s.hs
      h.goalsAgainst += s.as
      a.goalsFor += s.as
      a.goalsAgainst += s.hs
      if (s.hs > s.as) h.points += PTS_WIN
      else if (s.hs < s.as) a.points += PTS_WIN
      else {
        h.points += PTS_DRAW
        a.points += PTS_DRAW
      }
    }
    for (const c of codes) st[c].goalDifference = st[c].goalsFor - st[c].goalsAgainst
    return st
  }

  // Pares de equipos que quedaron empatados sin resolver (se llena en resolveTie).
  const tiedWithMap = new Map(teamCodes.map((c) => [c, new Set()]))

  // Ordena un conjunto de equipos EMPATADOS EN PUNTOS. Aplica head-to-head
  // (pts, dif, goles) y re-aplica el criterio a cada subconjunto que siga
  // empatado. Si el head-to-head no separa a nadie, cae a diferencia y goles
  // GENERALES y, por ultimo, ranking FIFA; lo que ni asi se separe queda como
  // empate real (se marca en tiedWithMap).
  function resolveTie(codes) {
    if (codes.length <= 1) return codes

    const h = headToHead(codes)
    const sorted = [...codes].sort(
      (a, b) =>
        h[b].points - h[a].points ||
        h[b].goalDifference - h[a].goalDifference ||
        h[b].goalsFor - h[a].goalsFor,
    )

    // Bloques que el head-to-head dejo iguales (mismos pts/dif/goles directos).
    const blocks = []
    let cur = [sorted[0]]
    for (let i = 1; i < sorted.length; i++) {
      const p = sorted[i - 1]
      const q = sorted[i]
      if (
        h[p].points === h[q].points &&
        h[p].goalDifference === h[q].goalDifference &&
        h[p].goalsFor === h[q].goalsFor
      ) {
        cur.push(q)
      } else {
        blocks.push(cur)
        cur = [q]
      }
    }
    blocks.push(cur)

    if (blocks.length > 1) {
      // El head-to-head separo en bloques: re-aplicamos el criterio a cada
      // bloque que siga con mas de un equipo (subconjunto), como manda FIFA.
      return blocks.flatMap((b) => resolveTie(b))
    }

    // El head-to-head no separo a NINGUNO: diferencia y goles GENERALES y,
    // por ultimo, ranking FIFA. Lo que quede igual en dif+goles generales es
    // un empate real (solo fair play / sorteo lo rompe): lo marcamos.
    const s2 = [...codes].sort(
      (a, b) =>
        byCode[b].goalDifference - byCode[a].goalDifference ||
        byCode[b].goalsFor - byCode[a].goalsFor ||
        fifaRank(a) - fifaRank(b),
    )
    for (const a of s2) {
      for (const b of s2) {
        if (
          a !== b &&
          byCode[a].goalDifference === byCode[b].goalDifference &&
          byCode[a].goalsFor === byCode[b].goalsFor
        ) {
          tiedWithMap.get(a).add(b)
        }
      }
    }
    return s2
  }

  // 5) Ordenamos: primero por PUNTOS; cada bloque de equipos con los mismos
  //    puntos se desempata con resolveTie (head-to-head -> general -> FIFA).
  const byPoints = [...rows].sort((a, b) => b.points - a.points)
  const pointBlocks = []
  if (byPoints.length > 0) {
    let cur = [byPoints[0].code]
    for (let i = 1; i < byPoints.length; i++) {
      if (byPoints[i].points === byPoints[i - 1].points) {
        cur.push(byPoints[i].code)
      } else {
        pointBlocks.push(cur)
        cur = [byPoints[i].code]
      }
    }
    pointBlocks.push(cur)
  }
  const finalOrder = pointBlocks.flatMap((b) => resolveTie(b))

  // 6) Devolvemos cada fila con posicion (1..n) y la info de empate no resuelto.
  return finalOrder.map((code, index) => {
    const tiedWith = [...tiedWithMap.get(code)]
    return {
      ...byCode[code],
      position: index + 1,
      tied: tiedWith.length > 0,
      tiedWith,
    }
  })
}
