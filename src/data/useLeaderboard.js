import { useEffect, useState } from 'react'
import {
  loadTeams,
  loadTournament,
  loadAnnexCOptions,
  loadScoring,
  loadTournamentsConfig,
  loadRealResults,
  loadPredictionIndex,
  loadPrediction,
} from './loaders.js'
import { scorePrediction } from '../logic/scoring.js'
import { cropRealResults, maxPlayedMatch } from '../logic/matchOrder.js'

// Hook que arma el leaderboard de UN torneo (parametrizado por tournamentId):
//   1) lee la config de torneos y resuelve la carpeta de quinielas del torneo
//      (todos comparten el mismo real-results del Mundial),
//   2) carga datos base + scoring + real-results + el indice del torneo,
//   3) carga cada quiniela y corre el motor scorePrediction,
//   4) rankea de mayor a menor por total,
//   5) detecta la fase del torneo (para las tarjetas de stats).
//
// Devuelve { loading, error, notFound, tournamentName, rows, phase, counts,
//            tournament, teams, realResults }.
//
// Nunca truena por datos incompletos: si una quiniela no carga, se salta; si no
// hay quinielas o no hay resultados, devuelve listas vacias y la UI muestra el
// estado amable correspondiente.

function isValidScore(s) {
  return s != null && Number.isFinite(s.hs) && Number.isFinite(s.as)
}

// Reparte las 7 categorias del motor en las 4 columnas que muestra la tabla.
// Penales y el bono del multiplicador son puntos "de partido" de eliminatoria,
// asi que se suman a PARTIDOS (el desglose fino vivira en el detalle por persona).
function toColumns(b) {
  return {
    partidos: b.groupMatches + b.knockoutMatch + b.penalties + b.multiplierBonus,
    avance: b.knockoutAdvance,
    grupos: b.groupTable,
    campeon: b.champion,
  }
}

// Resuelve el descriptor del torneo a partir de la config y el id pedido.
// 'demo' es un torneo especial SOLO local (datos gitignored) para validar.
function resolveTournament(config, tournamentId) {
  if (tournamentId === 'demo') {
    return {
      id: 'demo',
      name: 'Demo (datos de ejemplo)',
      predictionsDir: 'predictions-demo',
      realResults: 'real-results-demo.json',
    }
  }
  const t = (config.tournaments ?? []).find((x) => x.id === tournamentId)
  if (!t) return null
  return { ...t, realResults: config.realResults ?? 'real-results.json' }
}

export function useLeaderboard({ tournamentId } = {}) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    notFound: false,
    tournamentName: '',
    rows: [],
    phase: 'pre',
    counts: { participants: 0, groupPlayed: 0, koPlayed: 0 },
    // Datos compartidos que el detalle por persona necesita para recorrer la
    // estructura del torneo y mostrar los partidos "por jugar".
    tournament: null,
    teams: null,
    realResults: null,
    // Para la grafica de evolucion (reconstruye rankings sobre crops).
    scoring: null,
    annexCOptions: null,
  })

  useEffect(() => {
    let cancelled = false

    async function run() {
      // 1) Config + datos base compartidos (en paralelo).
      const [teams, tournament, annexCOptions, scoring, config] = await Promise.all([
        loadTeams(),
        loadTournament(),
        loadAnnexCOptions(),
        loadScoring(),
        loadTournamentsConfig(),
      ])

      // Resolvemos el torneo pedido. Si no existe, estado "no encontrado".
      const tInfo = resolveTournament(config, tournamentId)
      if (!tInfo) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, notFound: true }))
        }
        return
      }

      // 2) real-results compartido + indice del torneo.
      const [realResults, index] = await Promise.all([
        loadRealResults(tInfo.realResults),
        loadPredictionIndex(tInfo.predictionsDir),
      ])

      // 3) Cada quiniela del indice. Si una falla, se salta (no rompe el resto).
      const loaded = await Promise.all(
        (index ?? []).map((file) =>
          loadPrediction(tInfo.predictionsDir, file)
            .then((p) => ({ file, p }))
            .catch(() => null),
        ),
      )

      // 4) Puntuar cada quiniela con el motor.
      const rows = loaded
        .filter(Boolean)
        .map(({ file, p }) => {
          const result = scorePrediction({
            prediction: p,
            realResults,
            tournament,
            teams,
            annexCOptions,
            scoring,
          })
          const name =
            `${p.meta?.firstName ?? ''} ${p.meta?.lastName ?? ''}`.trim() || file
          return {
            file,
            name,
            total: result.total,
            cols: toColumns(result.breakdown),
            breakdown: result.breakdown,
            // Para el detalle por persona: su quiniela completa y los items del
            // motor (desglose concepto por concepto, con status/prediction/actual).
            prediction: p,
            items: result.items,
          }
        })
        // Ranking de mayor a menor por total (desempate por nombre, estable).
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

      // 5) Fase del torneo a partir de cuanto se ha jugado de verdad.
      const groupPlayed = Object.values(realResults.groupMatches ?? {}).filter(
        isValidScore,
      ).length
      const koPlayed = Object.values(realResults.knockout ?? {}).filter(
        isValidScore,
      ).length
      const phase = koPlayed > 0 ? 'knockout' : groupPlayed > 0 ? 'groups' : 'pre'

      // 6) Flechas subio/bajo: posicion actual vs ranking "hace 4 partidos"
      //    (resultados recortados a matchNumber = N_actual - 4). Se reusa el
      //    mismo motor sobre un real-results recortado. Sin datos previos
      //    suficientes (N_prev < 1), no hay flecha (row.delta = null).
      const maxPlayed = maxPlayedMatch(realResults)
      const nPrev = maxPlayed - 4
      if (nPrev >= 1) {
        const croppedPrev = cropRealResults(realResults, nPrev)
        const prev = rows.map((r) => ({
          file: r.file,
          name: r.name,
          total: scorePrediction({
            prediction: r.prediction,
            realResults: croppedPrev,
            tournament,
            teams,
            annexCOptions,
            scoring,
          }).total,
        }))
        prev.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        const prevPos = new Map(prev.map((r, i) => [r.file, i + 1]))
        // delta > 0 = subio (estaba mas abajo antes); < 0 = bajo.
        rows.forEach((r, i) => {
          r.delta = prevPos.get(r.file) - (i + 1)
        })
      } else {
        rows.forEach((r) => {
          r.delta = null
        })
      }

      if (!cancelled) {
        setState({
          loading: false,
          error: null,
          notFound: false,
          tournamentName: tInfo.name,
          rows,
          phase,
          counts: { participants: rows.length, groupPlayed, koPlayed },
          tournament,
          teams,
          realResults,
          // Para la grafica de evolucion (reconstruye rankings recortando).
          scoring,
          annexCOptions,
        })
      }
    }

    run().catch((error) => {
      if (!cancelled) setState((s) => ({ ...s, loading: false, error }))
    })

    return () => {
      cancelled = true
    }
  }, [tournamentId])

  return state
}
