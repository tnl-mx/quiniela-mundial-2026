// Mini-indice de torneos (#/torneos): punto de entrada que lista los torneos
// ACTIVOS con su link. Util para compartir y para no recordar URLs cuando haya
// mas de un torneo.

import { useEffect, useState } from 'react'
import './TournamentsIndex.css'
import { loadTournamentsConfig } from '../data/loaders.js'

export function TournamentsIndex() {
  const [tournaments, setTournaments] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadTournamentsConfig()
      .then((cfg) => {
        if (!cancelled) setTournaments((cfg.tournaments ?? []).filter((t) => t.active))
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="ti-page">
      <header className="ti-header">
        <h1 className="ti-title">Quinielas · Mundial 2026</h1>
        <p className="ti-subtitle">Elige un torneo para ver su tabla de posiciones.</p>
      </header>

      {error && <p className="ti-muted">No se pudo cargar la lista de torneos.</p>}
      {!error && tournaments == null && <p className="ti-muted">Cargando…</p>}

      {tournaments && tournaments.length === 0 && (
        <p className="ti-muted">Todavía no hay torneos activos.</p>
      )}

      {tournaments && tournaments.length > 0 && (
        <ul className="ti-list">
          {tournaments.map((t) => (
            <li key={t.id}>
              <a className="ti-card" href={`#/${t.id}`}>
                <span className="ti-card__name">🏆 {t.name}</span>
                <span className="ti-card__go">Ver leaderboard →</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
