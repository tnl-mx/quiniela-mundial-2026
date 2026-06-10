// Pantalla de resumen del grupo: ENCIMA la tabla final con clasificados
// resaltados, y DEBAJO los 6 partidos del grupo en linea editable con
// controles -/+. Cualquier edicion ahi recalcula la tabla en vivo
// (el motor groupTable se llama desde el Wizard).
//
// Si el grupo tiene un empate sin resolver en posiciones 1-3, mostramos
// un aviso amarillo y un boton para ir al resolutor. Cuando el empate
// queda resuelto (via TiebreakResolver) y el usuario vuelve aqui, la
// pantalla NO muestra ese aviso.

import { GroupTable } from './GroupTable.jsx'

export function GroupSummary({
  group,
  table,
  teams,
  matches,           // los 6 partidos del grupo (orden segun tournament)
  prediction,
  origin,            // 'flow' | 'index'
  needsTiebreak,     // bool calculado en Wizard
  isLastGroup,
  onScoreChange,     // (matchId, hs, as) => void
  onContinue,        // saltar al siguiente grupo (modo flujo)
  onBackToIndex,     // volver al indice
  onEditOneByOne,    // ir a M1 del grupo en modo captura
  onGoToTiebreak,    // ir al resolutor de empates
}) {
  const qualified = table.slice(0, 2)
  const qualifiedNames = qualified.map((r) => teams[r.code].name).join(' y ')
  const enteredFromIndex = origin === 'index'

  // Label del boton principal segun origen.
  const continueLabel = enteredFromIndex
    ? 'Volver al índice'
    : isLastGroup
    ? 'Terminar fase de grupos'
    : 'Continuar al siguiente grupo'

  // Click del boton primario. Si entramos del flujo y hay empate sin
  // resolver al avanzar, redirigir al resolutor (consistente con el flujo
  // normal: empate no resuelto bloquea el avance).
  const handleContinue = () => {
    if (enteredFromIndex) {
      onBackToIndex()
      return
    }
    if (needsTiebreak) {
      onGoToTiebreak()
      return
    }
    onContinue()
  }

  return (
    <section className="group-summary">
      <header className="group-summary-header">
        <p
          className={`group-summary-eyebrow ${
            needsTiebreak ? 'is-warning' : ''
          }`}
        >
          {needsTiebreak ? 'Empate por resolver' : 'Grupo completo'}
        </p>
        <h2 className="group-summary-title">Grupo {group} — Resumen</h2>
        <p className="group-summary-sub">
          <strong>{qualifiedNames}</strong> avanzan a la siguiente ronda.
        </p>
      </header>

      <GroupTable groupCode={group} table={table} teams={teams} fullColumns />

      {/* Boton de avance TAMBIEN arriba: para quien no va a editar nada y
          quiere continuar de inmediato sin bajar hasta el fondo. El de abajo
          se conserva para quien si edita los partidos. */}
      <div className="group-summary-top-nav">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleContinue}
        >
          {continueLabel} <span aria-hidden="true">→</span>
        </button>
      </div>

      {needsTiebreak && (
        <div className="group-summary-tie-warning" role="alert">
          <p>
            <strong>⚠ Hay un empate sin resolver en este grupo.</strong>{' '}
            Define el orden manual para que la quiniela quede consistente.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGoToTiebreak}
          >
            Resolver empate
          </button>
        </div>
      )}

      <section
        className="group-summary-matches"
        aria-labelledby={`summary-matches-${group}`}
      >
        <header className="group-summary-matches-header">
          <h3
            id={`summary-matches-${group}`}
            className="group-summary-matches-title"
          >
            Partidos del grupo
          </h3>
          <p className="group-summary-matches-sub">
            Edita un marcador y la tabla se recalcula en vivo.
          </p>
        </header>
        <ul className="group-summary-match-list">
          {matches.map((match) => (
            <EditableMatchRow
              key={match.id}
              match={match}
              score={prediction.groupMatches[match.id]}
              teams={teams}
              onScoreChange={onScoreChange}
            />
          ))}
        </ul>
      </section>

      <div className="group-summary-nav">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onEditOneByOne}
        >
          <span aria-hidden="true">←</span> Editar uno por uno
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleContinue}
        >
          {continueLabel} <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}

// Una fila del listado editable: muestra ambos equipos del partido en
// dos lineas (bandera + nombre a la izquierda, control de marcador a la
// derecha). Reusa .proto-score con el modificador .is-compact (mas chico).
function EditableMatchRow({ match, score, teams, onScoreChange }) {
  const home = teams[match.home]
  const away = teams[match.away]
  // Defensive default: aqui los partidos ya estan capturados (estamos en
  // el resumen del grupo), pero por seguridad caemos a 0-0 si no.
  const hs = score?.hs ?? 0
  const as = score?.as ?? 0

  return (
    <li className="summary-match">
      <div className="summary-match-row">
        <div className="summary-match-team">
          <span className="summary-match-team-flag" aria-hidden="true">
            {home.flag}
          </span>
          <span className="summary-match-team-name">{home.name}</span>
        </div>
        <CompactScore
          value={hs}
          onChange={(newHs) => onScoreChange(match.id, newHs, as)}
          label={home.name}
        />
      </div>
      <div className="summary-match-row">
        <div className="summary-match-team">
          <span className="summary-match-team-flag" aria-hidden="true">
            {away.flag}
          </span>
          <span className="summary-match-team-name">{away.name}</span>
        </div>
        <CompactScore
          value={as}
          onChange={(newAs) => onScoreChange(match.id, hs, newAs)}
          label={away.name}
        />
      </div>
    </li>
  )
}

function CompactScore({ value, onChange, label }) {
  return (
    <div className="proto-score is-compact">
      <button
        type="button"
        className="proto-score-btn"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`Restar gol a ${label}`}
      >
        −
      </button>
      <span className="proto-score-value">{value}</span>
      <button
        type="button"
        className="proto-score-btn"
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label={`Sumar gol a ${label}`}
      >
        +
      </button>
    </div>
  )
}
