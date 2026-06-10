// Pantalla de CIERRE de una ronda eliminatoria (R32, Octavos, Cuartos,
// Semifinales). Se muestra cuando el usuario completa todas las llaves de la
// ronda (con sus penales resueltos) antes de avanzar a la siguiente.
//
// Para cada llave usamos buildBracket como fuente de verdad:
//   - El equipo que AVANZA (m.winner) se resalta en verde.
//   - El equipo ELIMINADO (m.loser) se atenua y se tacha.
//
// Origen del acceso (como en los grupos: flow vs index):
//   - origin 'flow'  -> se llego por el flujo lineal de captura. El boton
//                       principal dice "Continuar a [siguiente ronda]".
//   - origin 'index' -> se llego desde "Ver cierre" en el indice. El boton
//                       dice "Volver al índice".

// Metadatos por ronda: titulo y nombre de la ronda siguiente (para el boton
// de continuar en el flujo lineal).
const ROUND_META = {
  r32: { label: 'Ronda de 32', nextLabel: 'Octavos' },
  r16: { label: 'Octavos', nextLabel: 'Cuartos' },
  qf: { label: 'Cuartos', nextLabel: 'Semifinales' },
  sf: { label: 'Semifinales', nextLabel: 'el Tercer lugar y la Final' },
}

export function RoundClosure({
  round,        // 'r32' | 'r16' | 'qf' | 'sf'
  bracket,
  teams,
  origin = 'flow',
  onContinue,   // solo se usa en origin 'flow'
  onBackToIndex,
}) {
  const meta = ROUND_META[round]
  const matches = bracket?.[round] ?? []
  if (!meta) return null

  // Botones de avance. Se renderizan ARRIBA y ABAJO: quien solo quiere ver y
  // continuar no tiene que bajar hasta el fondo; quien revisa las llaves lo
  // tiene tambien al final.
  const navButtons =
    origin === 'flow' ? (
      <>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBackToIndex}
        >
          Volver al índice
        </button>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continuar a {meta.nextLabel} <span aria-hidden="true">→</span>
        </button>
      </>
    ) : (
      <button type="button" className="btn btn-primary" onClick={onBackToIndex}>
        Volver al índice
      </button>
    )

  return (
    <section className="round-closure" aria-labelledby="round-closure-title">
      <header className="round-closure-header">
        <p className="round-closure-eyebrow">Cierre de ronda</p>
        <h2 id="round-closure-title" className="round-closure-title">
          {meta.label}
        </h2>
        <p className="round-closure-sub">
          Estos son los equipos que avanzan según tus marcadores.
        </p>
      </header>

      <div className="round-closure-nav round-closure-nav-top">{navButtons}</div>

      <ul className="round-closure-list">
        {matches.map((m) => (
          <ClosureMatch key={m.id} match={m} teams={teams} />
        ))}
      </ul>

      <div className="round-closure-nav">{navButtons}</div>
    </section>
  )
}

// Una llave dentro del cierre: marcador final + quien avanza (verde) y quien
// queda eliminado (atenuado/tachado). Si la llave por algun motivo no esta
// decidida, lo mostramos de forma neutra sin romper.
function ClosureMatch({ match, teams }) {
  const home = match.home ? teams[match.home] : null
  const away = match.away ? teams[match.away] : null
  const decided = match.status === 'decided'
  const hs = Number.isFinite(match.hs) ? match.hs : null
  const as = Number.isFinite(match.as) ? match.as : null
  const pens = match.pens

  return (
    <li className="closure-match">
      <span className="closure-match-id">{match.id}</span>

      <div className="closure-match-body">
        <ClosureTeam
          team={home}
          advances={decided && match.winner === match.home}
          eliminated={decided && match.loser === match.home}
        />

        <span className="closure-match-score" aria-hidden="true">
          {hs != null && as != null ? `${hs}–${as}` : '—'}
          {pens && (
            <span className="closure-match-pens">
              pens {pens.hs}–{pens.as}
            </span>
          )}
        </span>

        <ClosureTeam
          team={away}
          advances={decided && match.winner === match.away}
          eliminated={decided && match.loser === match.away}
        />
      </div>
    </li>
  )
}

function ClosureTeam({ team, advances, eliminated }) {
  const cls = [
    'closure-team',
    advances ? 'is-advances' : '',
    eliminated ? 'is-eliminated' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={cls}>
      <span className="closure-team-flag" aria-hidden="true">
        {team?.flag ?? '⏳'}
      </span>
      <span className="closure-team-name">{team?.name ?? '—'}</span>
      {advances && (
        <span className="closure-team-tag" aria-label="Avanza">
          ✓ Avanza
        </span>
      )}
    </span>
  )
}
