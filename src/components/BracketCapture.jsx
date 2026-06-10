// Captura de UNA llave de la fase eliminatoria.
// Reusa el patron visual de MatchCapture (proto-match con equipos lado a
// lado + control -/+). Cuando el marcador queda empatado (hs === as)
// aparece un sub-componente de penales.
// Penales NO se auto-capturan; el usuario debe ponerlos.

const ROUND_LABEL = {
  R32: 'Ronda de 32',
  R16: 'Octavos',
  QF: 'Cuartos',
  SF: 'Semifinales',
  THIRD: 'Tercer lugar',
  FINAL: 'Final',
}

export function BracketCapture({
  match,         // partido tal como lo arma el motor (con home/away/hs/as/pens)
  stored,        // entrada cruda en prediction.knockout[matchId]
  teams,
  isStale,       // bool: equipos cambiaron respecto a la prediccion guardada
  onScoreChange, // (matchId, hs, as, home, away) => void
  onPensChange,  // (matchId, pHs, pAs) => void
  onPrev,
  onNext,
  onSkipThird,
  canGoPrev,
}) {
  // Si la llave todavia no tiene equipos (la ronda previa no esta resuelta),
  // mostramos un mensaje claro.
  if (!match.home || !match.away) {
    return (
      <section className="bracket-capture is-pending" aria-labelledby="bracket-match-title">
        <header className="bracket-capture-header">
          <p className="bracket-capture-eyebrow">
            {ROUND_LABEL[match.round] ?? match.round} · {match.id}
          </p>
          <h2 id="bracket-match-title" className="bracket-capture-title">
            Aún no se puede capturar
          </h2>
          <p className="bracket-capture-sub">
            Esta llave depende de la ronda anterior. Termina las llaves
            que la alimentan para poder capturar aquí.
          </p>
        </header>
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
            Siguiente <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    )
  }

  const home = teams[match.home]
  const away = teams[match.away]
  // Score que mostramos: lo del motor (que ya viene del prediction stored).
  const hs = Number.isFinite(match.hs) ? match.hs : 0
  const as = Number.isFinite(match.as) ? match.as : 0
  const tied = hs === as
  const isFinal = match.id === 'M104'
  const isThird = match.id === 'M103'

  const handleHomeChange = (newHs) =>
    onScoreChange(match.id, newHs, as, match.home, match.away)
  const handleAwayChange = (newAs) =>
    onScoreChange(match.id, hs, newAs, match.home, match.away)
  const handleConfirmStale = () =>
    onScoreChange(match.id, hs, as, match.home, match.away)

  return (
    <section
      className="bracket-capture proto-match"
      aria-labelledby="bracket-match-title"
    >
      <header className="bracket-capture-header proto-match-header">
        <p className="bracket-capture-eyebrow proto-match-eyebrow">
          {ROUND_LABEL[match.round] ?? match.round} · {match.id}
        </p>
        <h2
          id="bracket-match-title"
          className="bracket-capture-title proto-match-title"
        >
          {home.name} vs {away.name}
        </h2>
        <p className="bracket-capture-sub proto-match-sub">
          {isFinal
            ? 'La final del torneo. El ganador es tu campeón.'
            : isThird
            ? 'Partido por el tercer lugar (opcional)'
            : 'Anota el marcador final.'}
        </p>
      </header>

      {isStale && (
        <div className="bracket-stale-banner" role="alert">
          <p>
            <strong>⚠ Cambiaron los equipos de esta llave</strong> respecto
            a tu predicción original (probablemente editaste una llave
            anterior). Confirma el marcador o ajústalo a la nueva versión.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleConfirmStale}
          >
            Confirmar marcador
          </button>
        </div>
      )}

      <div className="proto-match-teams">
        <TeamScore
          team={home}
          value={hs}
          onChange={handleHomeChange}
        />
        <span className="proto-match-vs" aria-hidden="true">vs</span>
        <TeamScore
          team={away}
          value={as}
          onChange={handleAwayChange}
        />
      </div>

      {tied && (
        <PenaltyCapture
          home={home}
          away={away}
          pens={stored?.pens}
          onPensChange={(pHs, pAs) => onPensChange(match.id, pHs, pAs)}
        />
      )}

      <div className="proto-match-nav bracket-capture-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onPrev}
          disabled={!canGoPrev}
        >
          <span aria-hidden="true">←</span> Anterior
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Siguiente <span aria-hidden="true">→</span>
        </button>
      </div>

      {isThird && (
        <div className="bracket-capture-skip">
          <button
            type="button"
            className="btn btn-tertiary"
            onClick={onSkipThird}
          >
            Saltar tercer lugar (ir a la final)
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

// Sub-componente: captura de la tanda de penales. Aparece solo cuando el
// marcador esta empatado. Reusa el control compacto .is-compact.
// Reglas visuales:
//   - Si no hay pens (went=false o undefined): warning naranja "Captura los penales".
//   - Si hay pens pero estan empatados: warning naranja "No pueden empatar".
//   - Si hay pens con ganador: estado normal (sin warning).
function PenaltyCapture({ home, away, pens, onPensChange }) {
  const pHs = Number.isFinite(pens?.hs) ? pens.hs : 0
  const pAs = Number.isFinite(pens?.as) ? pens.as : 0
  const went = pens?.went === true
  const equalPens = went && pHs === pAs

  // Necesita accion del usuario: o no ha registrado pens, o estan en empate.
  const needsAction = !went || equalPens

  return (
    <section
      className={`bracket-pens ${needsAction ? 'is-warning' : ''}`}
      aria-labelledby="bracket-pens-title"
    >
      <header className="bracket-pens-header">
        <h3 id="bracket-pens-title" className="bracket-pens-title">
          Penales
        </h3>
        <p className="bracket-pens-help">
          {!went && '⚠ El partido empató. Captura el ganador por penales.'}
          {went && equalPens &&
            '⚠ Los penales no pueden empatar. Ajusta para que haya un ganador.'}
          {went && !equalPens &&
            `Ganador por penales: ${pHs > pAs ? home.name : away.name}.`}
        </p>
      </header>

      <div className="bracket-pens-controls">
        <PensTeam
          team={home}
          value={pHs}
          onChange={(p) => onPensChange(p, pAs)}
        />
        <span className="bracket-pens-dash" aria-hidden="true">—</span>
        <PensTeam
          team={away}
          value={pAs}
          onChange={(p) => onPensChange(pHs, p)}
        />
      </div>
    </section>
  )
}

function PensTeam({ team, value, onChange }) {
  const dec = () => onChange(Math.max(0, value - 1))
  const inc = () => onChange(Math.min(99, value + 1))
  return (
    <div className="bracket-pens-team">
      <span className="bracket-pens-team-label">
        <span aria-hidden="true">{team.flag}</span> {team.name}
      </span>
      <div className="proto-score is-compact">
        <button
          type="button"
          className="proto-score-btn"
          onClick={dec}
          disabled={value <= 0}
          aria-label={`Restar penal a ${team.name}`}
        >
          −
        </button>
        <span className="proto-score-value">{value}</span>
        <button
          type="button"
          className="proto-score-btn"
          onClick={inc}
          aria-label={`Sumar penal a ${team.name}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
