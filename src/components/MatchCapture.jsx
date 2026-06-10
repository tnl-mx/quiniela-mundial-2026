// Tarjeta de captura de UN partido. Es la pieza central del wizard.
// Recibe el partido, el marcador actual, y callbacks de cambio/navegacion.
// Reusa las clases proto-* definidas en src/pages/Wizard.css (mismo look
// del prototipo aprobado).

export function MatchCapture({
  match,         // { id, group, home, away }
  score,         // { hs, as } actual
  teams,         // mapa { CODIGO: { name, flag, ... } }
  groupCode,
  matchIndex,    // 0..5 dentro del grupo
  onScoreChange, // (hs, as) => void
  onPrev,
  onNext,
  canGoPrev,
  uncapturedInGroup = 0,    // cuantos partidos NO capturados quedan en el grupo
  onRandomFillGroup,        // () => void, abre el modal de relleno
}) {
  const home = teams[match.home]
  const away = teams[match.away]

  // Cada handler emite un nuevo (hs, as) completo: no mutamos el otro lado.
  const handleHomeChange = (newHs) => onScoreChange(newHs, score.as)
  const handleAwayChange = (newAs) => onScoreChange(score.hs, newAs)

  return (
    <section className="proto-match" aria-labelledby="match-title">
      <header className="proto-match-header">
        <p className="proto-match-eyebrow">Capturando ahora</p>
        <h2 id="match-title" className="proto-match-title">
          {home.name} vs {away.name}
        </h2>
        <p className="proto-match-sub">
          Grupo {groupCode} · Partido {matchIndex + 1} de 6
        </p>
      </header>

      <div className="proto-match-teams">
        <TeamScore team={home} value={score.hs} onChange={handleHomeChange} />
        <span className="proto-match-vs" aria-hidden="true">vs</span>
        <TeamScore team={away} value={score.as} onChange={handleAwayChange} />
      </div>

      <div className="proto-match-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onPrev}
          disabled={!canGoPrev}
        >
          <span aria-hidden="true">←</span> Anterior
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Siguiente<span className="btn-label-long"> partido</span>{' '}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {onRandomFillGroup && (
        <div className="proto-match-fill">
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={onRandomFillGroup}
            disabled={uncapturedInGroup === 0}
            title={
              uncapturedInGroup === 0
                ? 'Este grupo ya está completo'
                : 'Asigna marcadores aleatorios a los partidos que aún no capturas en este grupo'
            }
          >
            <span aria-hidden="true">✨</span>{' '}
            {uncapturedInGroup === 0
              ? 'Grupo completo'
              : `Rellenar el resto del grupo al azar (${uncapturedInGroup})`}
          </button>
        </div>
      )}
    </section>
  )
}

function TeamScore({ team, value, onChange }) {
  const dec = () => onChange(Math.max(0, value - 1))
  const inc = () => onChange(Math.min(99, value + 1))

  return (
    <div className="proto-team">
      <span className="proto-team-flag" aria-hidden="true">{team.flag}</span>
      <span className="proto-team-name">{team.name}</span>
      <div className="proto-score">
        <button
          type="button"
          className="proto-score-btn"
          onClick={dec}
          disabled={value <= 0}
          aria-label={`Restar gol a ${team.name}`}
        >
          −
        </button>
        <span className="proto-score-value" aria-live="polite">{value}</span>
        <button
          type="button"
          className="proto-score-btn"
          onClick={inc}
          aria-label={`Sumar gol a ${team.name}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
