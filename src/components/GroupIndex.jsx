// Rejilla de los 12 grupos. Cada tarjeta muestra el estado del grupo:
//   - empty           : sin partidos capturados
//   - partial         : X/6 capturados
//   - complete        : 6/6 y sin empate en posiciones 1-3
//   - tie-resolved    : 6/6 con empate exacto en 1-3 pero el usuario ya
//                       guardo el orden manual (groupTiebreaks). Color azul,
//                       comunica "todo bien, ya lo decidiste".
//   - tie-unresolved  : 6/6 con empate exacto en 1-3 SIN orden manual.
//                       Color naranja de alerta. Requiere accion.
// Al hacer click salta al partido siguiente (si esta partial) o al resumen
// editable (si esta complete o cualquiera de los dos estados de empate).

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function statusFor(group, { countCaptured, getResolvedTable, hasUserTiebreak }) {
  const captured = countCaptured(group)
  if (captured === 0) return { kind: 'empty', captured, total: 6 }
  if (captured < 6) return { kind: 'partial', captured, total: 6 }

  // 6/6 capturados: hay empate en top 3?
  const table = getResolvedTable(group)
  const hasTie = table.slice(0, 3).some((r) => r.tied)
  if (!hasTie) return { kind: 'complete', captured, total: 6, table }

  // Hay empate: resuelto o no?
  return hasUserTiebreak(group)
    ? { kind: 'tie-resolved', captured, total: 6, table }
    : { kind: 'tie-unresolved', captured, total: 6, table }
}

export function GroupIndex({
  teams,
  countCaptured,
  getResolvedTable,
  hasUserTiebreak,
  onPickGroup,
  onPickGroupSummary,
  uncapturedCount = 0,
  onRandomFillUntil,
}) {
  return (
    <section className="group-index">
      <header className="group-index-header">
        <h2 className="group-index-title">Tus 12 grupos</h2>
        <p className="group-index-sub">
          Salta a cualquier grupo para editarlo o continuarlo.
        </p>
        {/* Boton global: abre el chooser para elegir HASTA que fase rellenar
            al azar (solo grupos, hasta octavos, todo, etc.). */}
        {onRandomFillUntil && uncapturedCount > 0 && (
          <div className="group-index-action">
            <button
              type="button"
              className="btn btn-primary"
              onClick={onRandomFillUntil}
            >
              <span aria-hidden="true">✨</span>{' '}
              Rellenar al azar… ({uncapturedCount})
            </button>
          </div>
        )}
      </header>

      <ul className="group-index-grid">
        {GROUP_LETTERS.map((g) => {
          const status = statusFor(g, {
            countCaptured,
            getResolvedTable,
            hasUserTiebreak,
          })
          // Cualquier estado de grupo "cerrado" (complete/tie-*) lleva al
          // resumen. Los abiertos (empty/partial) van al primer partido
          // sin capturar.
          const goesToSummary =
            status.kind === 'complete' ||
            status.kind === 'tie-resolved' ||
            status.kind === 'tie-unresolved'
          const handleClick = () => {
            if (goesToSummary) onPickGroupSummary(g)
            else onPickGroup(g)
          }
          return (
            <li key={g}>
              <button
                type="button"
                className={`group-card group-card-${status.kind}`}
                onClick={handleClick}
              >
                <span className="group-card-letter">Grupo {g}</span>
                <span className="group-card-status">
                  {status.kind === 'empty' && 'Sin empezar'}
                  {status.kind === 'partial' && `${status.captured}/${status.total} partidos`}
                  {status.kind === 'tie-unresolved' && (
                    <>
                      <span aria-hidden="true">⚠</span> Empate por resolver
                    </>
                  )}
                  {status.kind === 'tie-resolved' && (
                    <>
                      <span aria-hidden="true">✓</span> Empate resuelto
                    </>
                  )}
                  {status.kind === 'complete' && (
                    <>
                      <span aria-hidden="true">✓</span> Completo
                    </>
                  )}
                </span>
                {(status.kind === 'complete' ||
                  status.kind === 'tie-resolved' ||
                  status.kind === 'tie-unresolved') && (
                  <span className="group-card-qualified">
                    {teams[status.table[0].code].flag} {status.table[0].code}
                    {' · '}
                    {teams[status.table[1].code].flag} {status.table[1].code}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
