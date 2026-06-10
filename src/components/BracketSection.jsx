// Seccion de fase eliminatoria dentro del indice general del wizard.
//   - Si los grupos NO estan completos: muestra un gate con mensaje y
//     boton para volver a grupos.
//   - Si estan completos: muestra el bracket con sus 6 rondas, cada llave
//     clickeable para editarla. Si hay champion lo muestra arriba.
//     Si hay llaves "stale" (equipos distintos a la prediccion original),
//     muestra un aviso persistente con la lista.

const ROUNDS = [
  { id: 'r32', label: 'Ronda de 32' },
  { id: 'r16', label: 'Octavos' },
  { id: 'qf', label: 'Cuartos' },
  { id: 'sf', label: 'Semifinales' },
  { id: 'third', label: 'Tercer lugar (opcional)' },
  { id: 'final', label: 'Final' },
]

// Rondas que tienen pantalla de cierre revisitable.
const CLOSURE_ROUNDS = new Set(['r32', 'r16', 'qf', 'sf'])

export function BracketSection({
  groupsComplete,
  bracket,
  teams,
  staleMatches,
  onPickMatch,
  onGoToBridge,
  onGoToGroups,
  onViewClosure,
  onViewCoronation,
  onRequestFillRound,
}) {
  // --- Gate: grupos incompletos ---
  if (!groupsComplete) {
    return (
      <section className="bracket-section bracket-gate">
        <header className="bracket-section-header">
          <h2 className="bracket-section-title">Fase eliminatoria</h2>
        </header>
        <div className="bracket-gate-body">
          <p>
            Primero termina la fase de grupos (los 12 grupos con sus 6
            partidos capturados y los empates resueltos).
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onGoToGroups}
          >
            Ir a completar grupos
          </button>
        </div>
      </section>
    )
  }

  if (!bracket) return null

  const champion = bracket.champion ? teams[bracket.champion] : null
  const staleIds = new Set(staleMatches.map((m) => m.id))

  return (
    <section className="bracket-section">
      <header className="bracket-section-header">
        <h2 className="bracket-section-title">Fase eliminatoria</h2>
        {!champion && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onGoToBridge}
          >
            Ver puente "Tus clasificados"
          </button>
        )}
      </header>

      {champion && (
        // Banner del campeon: ahora es un boton que lleva a la pantalla de
        // coronacion (cierre celebratorio del torneo), revisitable.
        <button
          type="button"
          className="bracket-champion-banner is-clickable"
          onClick={onViewCoronation}
        >
          <span className="bracket-champion-icon" aria-hidden="true">🏆</span>
          <div>
            <p className="bracket-champion-label">Campeón · ver coronación</p>
            <p className="bracket-champion-team">
              <span aria-hidden="true">{champion.flag}</span> {champion.name}
            </p>
          </div>
          <span className="bracket-champion-cta" aria-hidden="true">→</span>
        </button>
      )}

      {staleMatches.length > 0 && (
        <div className="bracket-stale-summary" role="alert">
          <p>
            <strong>
              ⚠ {staleMatches.length} llave{staleMatches.length === 1 ? '' : 's'} cambió
              de equipos
            </strong>{' '}
            respecto a tu predicción original. Probablemente editaste una
            llave previa y eso cascadeó. Revísalas y confirma o ajusta.
          </p>
          <ul className="bracket-stale-list">
            {staleMatches.map((m) => {
              const home = teams[m.home]
              const away = teams[m.away]
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={() => onPickMatch(m.id)}
                  >
                    {m.id}: {home?.flag} {home?.name ?? '?'} vs{' '}
                    {away?.name ?? '?'} {away?.flag}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {ROUNDS.map(({ id, label }) => {
        const matches = bracket[id] ?? []
        if (matches.length === 0) return null
        const decidedCount = matches.filter((m) => m.status === 'decided').length
        const roundComplete = decidedCount === matches.length
        // Boton "Ver cierre": solo en rondas con cierre y ya completas.
        const showClosure = CLOSURE_ROUNDS.has(id) && roundComplete

        // Relleno por ronda: una ronda esta LISTA cuando ninguna llave esta
        // 'pending' (su ronda previa ya se resolvio). Mostramos el boton
        // mientras quede algo por decidir; deshabilitado si la previa no esta
        // lista, para comunicar la dependencia.
        const roundReady = matches.every((m) => m.status !== 'pending')
        const hasWork = decidedCount < matches.length
        const showFill = !!onRequestFillRound && hasWork

        return (
          <section key={id} className="bracket-round" aria-labelledby={`round-${id}`}>
            <header className="bracket-round-header">
              <h3 id={`round-${id}`} className="bracket-round-title">
                {label}
              </h3>
              <span className="bracket-round-meta">
                {showFill && (
                  <button
                    type="button"
                    className="btn btn-tertiary bracket-round-fill-btn"
                    onClick={() => onRequestFillRound(id)}
                    disabled={!roundReady}
                    title={
                      roundReady
                        ? 'Rellenar esta ronda al azar'
                        : 'Primero completa la ronda anterior'
                    }
                  >
                    🎲 Rellenar
                  </button>
                )}
                {showClosure && (
                  <button
                    type="button"
                    className="btn btn-tertiary bracket-round-closure-btn"
                    onClick={() => onViewClosure(id)}
                  >
                    Ver cierre
                  </button>
                )}
                <span className="bracket-round-progress">
                  {decidedCount}/{matches.length}
                </span>
              </span>
            </header>
            <ul className="bracket-round-list">
              {matches.map((m) => (
                <BracketRow
                  key={m.id}
                  match={m}
                  teams={teams}
                  isStale={staleIds.has(m.id)}
                  onPick={onPickMatch}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </section>
  )
}

function BracketRow({ match, teams, isStale, onPick }) {
  const isPending = match.status === 'pending'
  const isDecided = match.status === 'decided'
  const isTiedNeedsPens = match.status === 'tied-needs-pens'
  const home = match.home ? teams[match.home] : null
  const away = match.away ? teams[match.away] : null

  let statusClass = ''
  if (isPending) statusClass = 'is-pending'
  else if (isDecided && !isStale) statusClass = 'is-decided'
  else if (isStale) statusClass = 'is-stale'
  else if (isTiedNeedsPens) statusClass = 'is-tied-needs-pens'
  else statusClass = 'is-awaiting'

  return (
    <li className={`bracket-row ${statusClass}`}>
      <button
        type="button"
        className="bracket-row-button"
        onClick={() => onPick(match.id)}
        disabled={isPending}
        title={
          isPending
            ? 'Esta llave depende de la ronda anterior'
            : `Editar ${match.id}`
        }
      >
        <span className="bracket-row-id">{match.id}</span>
        <span className="bracket-row-teams">
          {home ? (
            <>
              <span aria-hidden="true">{home.flag}</span>
              <span className="bracket-row-team-name">{home.name}</span>
            </>
          ) : (
            <span className="bracket-row-placeholder">(esperando)</span>
          )}
          <span className="bracket-row-vs">vs</span>
          {away ? (
            <>
              <span aria-hidden="true">{away.flag}</span>
              <span className="bracket-row-team-name">{away.name}</span>
            </>
          ) : (
            <span className="bracket-row-placeholder">(esperando)</span>
          )}
        </span>
        <span className="bracket-row-status">
          {isPending && 'Pendiente'}
          {isDecided && !isStale && (
            <>
              {match.hs}–{match.as}
              {match.pens && ` (pens ${match.pens.hs}–${match.pens.as})`}
            </>
          )}
          {isStale && '⚠ Cambio'}
          {isTiedNeedsPens && '⚠ Falta penales'}
          {match.status === 'awaiting-score' && 'Por capturar'}
        </span>
      </button>
    </li>
  )
}
