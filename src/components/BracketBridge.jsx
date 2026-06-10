// Pantalla puente entre la fase de grupos y el bracket eliminatorio.
// Muestra "Tus clasificados": 1° y 2° de cada grupo, los 8 mejores
// terceros con su grupo de origen, y la lista de los 16 enfrentamientos
// de la Ronda de 32 ya armados por el motor.

import { rankThirdPlacedTeams } from '../logic/thirdPlace.js'

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']

export function BracketBridge({
  bracket,
  allGroupTables,
  teams,
  onStart,
  onBackToIndex,
}) {
  // Top 8 terceros (los que clasifican). Usamos las tablas resueltas
  // (con los desempates del usuario aplicados).
  const thirdsRanking = rankThirdPlacedTeams({
    groupTables: allGroupTables,
    teams,
  })
  const qualifiedThirds = thirdsRanking.filter((t) => t.qualified)

  return (
    <section className="bracket-bridge">
      <header className="bracket-bridge-header">
        <p className="bracket-bridge-eyebrow">Fase eliminatoria</p>
        <h2 className="bracket-bridge-title">Tus clasificados</h2>
        <p className="bracket-bridge-sub">
          Estos son los 32 equipos que avanzan a la Ronda de 32 según tu
          predicción de la fase de grupos.
        </p>
      </header>

      {/* ---- 1° y 2° de cada grupo ---- */}
      <section className="bracket-bridge-section">
        <h3 className="bracket-bridge-section-title">1° y 2° de cada grupo</h3>
        <ul className="bracket-bridge-list">
          {GROUP_LETTERS.map((g) => {
            const t = allGroupTables[g]
            if (!t || t.length < 2) return null
            const first = teams[t[0].code]
            const second = teams[t[1].code]
            return (
              <li key={g} className="bracket-bridge-group-row">
                <span className="bracket-bridge-group-letter">Grupo {g}</span>
                <span className="bracket-bridge-group-teams">
                  <span className="bracket-bridge-team">
                    <span aria-hidden="true">{first.flag}</span> {first.name}
                  </span>
                  <span className="bracket-bridge-team-sep">·</span>
                  <span className="bracket-bridge-team">
                    <span aria-hidden="true">{second.flag}</span> {second.name}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---- 8 mejores terceros ---- */}
      <section className="bracket-bridge-section">
        <h3 className="bracket-bridge-section-title">
          8 mejores terceros
        </h3>
        <ul className="bracket-bridge-list">
          {qualifiedThirds.map((t) => {
            const team = teams[t.code]
            return (
              <li key={t.code} className="bracket-bridge-third-row">
                <span className="bracket-bridge-team">
                  <span aria-hidden="true">{team.flag}</span> {team.name}
                </span>
                <span className="bracket-bridge-third-origin">
                  Grupo {t.groupCode}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---- Enfrentamientos de R32 ---- */}
      <section className="bracket-bridge-section">
        <h3 className="bracket-bridge-section-title">
          Ronda de 32 — Enfrentamientos
        </h3>
        <ul className="bracket-bridge-matches">
          {bracket.r32.map((m) => {
            const home = teams[m.home]
            const away = teams[m.away]
            if (!home || !away) return null
            return (
              <li key={m.id} className="bracket-bridge-match">
                <span className="bracket-bridge-match-id">{m.id}</span>
                <span className="bracket-bridge-match-teams">
                  <span aria-hidden="true">{home.flag}</span> {home.name}
                  {' '}
                  <span className="bracket-bridge-match-vs">vs</span>
                  {' '}
                  <span aria-hidden="true">{away.flag}</span> {away.name}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="bracket-bridge-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBackToIndex}
        >
          Volver al índice
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
        >
          Empezar a capturar eliminatoria{' '}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}
