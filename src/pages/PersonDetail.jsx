// ============================================================================
// DETALLE POR PERSONA.
//
// Muestra la quiniela completa de una persona: que predijo en cada partido,
// que paso en la realidad (si ya se jugo) y cuantos puntos gano, con
// indicadores visuales (exacto / resultado / fallo / por jugar).
//
// Fuente de los puntos y la clasificacion: el array items[] que devuelve el
// motor scoring.js (ya trae status machine-readable + prediction/actual ya
// mapeados por equipo, incluso en cruces invertidos). Los partidos NO jugados
// no tienen item: se recorren desde la estructura del torneo + la prediccion y
// se muestran como "por jugar", sin puntos.
//
// Vista PUBLICA: cualquiera puede ver la quiniela de cualquiera.
// ============================================================================

import './PersonDetail.css'
import { resolveStandings, isGroupComplete } from '../logic/scoring.js'

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Rango de match numbers -> nombre de ronda (cuadro oficial FIFA).
function roundOf(matchId) {
  const n = Number.parseInt(matchId.slice(1), 10)
  if (n >= 73 && n <= 88) return 'Ronda de 32'
  if (n >= 89 && n <= 96) return 'Octavos'
  if (n >= 97 && n <= 100) return 'Cuartos'
  if (n >= 101 && n <= 102) return 'Semifinales'
  if (n === 103) return 'Tercer lugar'
  if (n === 104) return 'Final'
  return 'Eliminatoria'
}
const ROUND_ORDER = ['Ronda de 32', 'Octavos', 'Cuartos', 'Semifinales', 'Tercer lugar', 'Final']

function initials(name) {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// Traduce un status + puntos a la clase de chip y su texto.
function chipFor(status, points) {
  switch (status) {
    case 'exact':
      return { cls: 'exact', text: `Exacto +${points}` }
    case 'outcome':
      return { cls: 'outcome', text: `Resultado +${points}` }
    case 'miss':
      return { cls: 'miss', text: 'Falló +0' }
    case 'no-prediction':
      return { cls: 'miss', text: 'Sin pronóstico' }
    default:
      return { cls: 'pending', text: 'Por jugar' }
  }
}

// ---------- Subcomponentes ----------

function Pill({ icon, label, value }) {
  return (
    <span className="pd-pill">
      <span aria-hidden="true">{icon}</span> {label} <strong>{value}</strong>
    </span>
  )
}

// Una fila de partido: equipos + marcador predicho, y a la derecha el real
// (si se jugo) + el chip de estado. `pens` y `x2` son adornos opcionales.
function MatchRow({ teams, home, away, predText, realText, chip, pens, x2 }) {
  const flag = (c) => teams[c]?.flag ?? '🏳'
  return (
    <div className="pd-match">
      <div className="pd-fixture">
        <span className="pd-team pd-team--home">
          <span className="pd-code">{home ?? '—'}</span>
          <span className="pd-flag" aria-hidden="true">{flag(home)}</span>
        </span>
        <span className="pd-pred">{predText}</span>
        <span className="pd-team pd-team--away">
          <span className="pd-flag" aria-hidden="true">{flag(away)}</span>
          <span className="pd-code">{away ?? '—'}</span>
        </span>
      </div>
      <div className="pd-outcome">
        {realText && (
          <span className="pd-real">
            Real <strong>{realText}</strong>
          </span>
        )}
        {pens && <span className="pd-chip pd-chip--pens">{pens}</span>}
        {x2 && <span className="pd-chip pd-chip--x2">×2!</span>}
        <span className={`pd-chip pd-chip--${chip.cls}`}>{chip.text}</span>
      </div>
    </div>
  )
}

// ---------- Vista ----------

export function PersonDetail({ row, position, tournament, teams, realResults, demo = false, onBack }) {
  // Mapas de items por categoria para buscar rapido.
  const items = row.items ?? []
  const gm = {} // groupMatches por matchId
  const koMatch = {} // knockoutMatch por matchId (perspectiva de la persona)
  const koPens = {} // penalties por matchId
  const koX2 = {} // multiplierBonus por matchId
  let champItem = null
  for (const it of items) {
    if (it.category === 'groupMatches') gm[it.matchId] = it
    else if (it.category === 'knockoutMatch') koMatch[it.matchId] = it
    else if (it.category === 'penalties') koPens[it.matchId] = it
    else if (it.category === 'multiplierBonus') koX2[it.matchId] = it
    else if (it.category === 'champion') champItem = it
  }

  const pred = row.prediction ?? {}
  const fmt = (s) => (s && Number.isFinite(s.hs) && Number.isFinite(s.as) ? `${s.hs}–${s.as}` : null)

  // ----- Fase eliminatoria: llaves que predijo la persona, por ronda -----
  const koPred = pred.knockout ?? {}
  const koIds = Object.keys(koPred).filter((id) => koPred[id]?.home && koPred[id]?.away)
  const koByRound = {}
  for (const id of koIds) {
    const r = roundOf(id)
    ;(koByRound[r] ??= []).push(id)
  }
  const hasKnockout = koIds.length > 0

  return (
    <main className="pd-page">
      <button type="button" className="pd-back" onClick={onBack}>
        ← Volver al leaderboard
      </button>

      {demo && <div className="pd-demo-flag">⚠ Modo demo · datos de ejemplo</div>}

      {/* Encabezado de la persona */}
      <header className="pd-header">
        <span className="pd-avatar" aria-hidden="true">{initials(row.name)}</span>
        <div className="pd-header__info">
          <h1 className="pd-name">{row.name}</h1>
          <p className="pd-meta">
            Posición <strong>#{position}</strong> en el ranking
          </p>
        </div>
        <div className="pd-total">
          <div className="pd-total__num">{row.total}</div>
          <div className="pd-total__label">puntos</div>
        </div>
      </header>

      {/* Mini-resumen por categoria */}
      <div className="pd-summary">
        <Pill icon="⚽" label="Partidos" value={row.cols.partidos} />
        <Pill icon="⬆" label="Avance" value={row.cols.avance} />
        <Pill icon="📊" label="Grupos" value={row.cols.grupos} />
        <Pill icon="👑" label="Campeón" value={row.cols.campeon} />
      </div>

      {/* ===== FASE DE GRUPOS ===== */}
      <section className="pd-section">
        <h2 className="pd-section__title">Fase de grupos</h2>
        {GROUP_LETTERS.filter((g) => tournament.groups[g]).map((g) => {
          const matches = tournament.groupMatches.filter((m) => m.group === g)
          const complete = isGroupComplete(realResults, g, tournament)
          const predSt = complete ? resolveStandings(pred, g, tournament, teams) : null
          const realSt = complete ? resolveStandings(realResults, g, tournament, teams) : null

          return (
            <div className="pd-block" key={g}>
              <h3 className="pd-block__title">Grupo {g}</h3>

              {matches.map((m) => {
                const item = gm[m.id]
                const p = pred.groupMatches?.[m.id]
                const chip = item ? chipFor(item.status, item.points) : chipFor('pending', 0)
                const realText = item ? fmt(item.actual) : null
                return (
                  <MatchRow
                    key={m.id}
                    teams={teams}
                    home={m.home}
                    away={m.away}
                    predText={fmt(p) ?? '—'}
                    realText={realText}
                    chip={chip}
                  />
                )
              })}

              {/* Tabla del grupo: posiciones predichas vs reales (si ya termino) */}
              {complete && (
                <div className="pd-standings">
                  <div className="pd-standings__row pd-standings__row--head">
                    <span>#</span>
                    <span>Predicho</span>
                    <span>Real</span>
                  </div>
                  {[0, 1, 2, 3].map((i) => {
                    const ok = predSt[i] && predSt[i] === realSt[i]
                    return (
                      <div className="pd-standings__row" key={i}>
                        <span>{i + 1}</span>
                        <span className={ok ? 'pd-standings__cell--ok' : 'pd-standings__cell--bad'}>
                          {teams[predSt[i]]?.flag ?? ''} {predSt[i]}
                          {ok ? ' ✓' : ''}
                        </span>
                        <span>
                          {teams[realSt[i]]?.flag ?? ''} {realSt[i]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </section>

      {/* ===== FASE ELIMINATORIA ===== */}
      <section className="pd-section">
        <h2 className="pd-section__title">Fase eliminatoria</h2>
        {!hasKnockout ? (
          <p className="pd-muted">
            Sin pronóstico de eliminatoria todavía (o la fase aún no comienza).
          </p>
        ) : (
          ROUND_ORDER.filter((r) => koByRound[r]).map((r) => (
            <div className="pd-block" key={r}>
              <h3 className="pd-block__title">{r}</h3>
              {koByRound[r].map((id) => {
                const ko = koPred[id]
                const mItem = koMatch[id]
                const pItem = koPens[id]
                const x2 = koX2[id]
                const chip = mItem ? chipFor(mItem.status, mItem.points) : chipFor('pending', 0)
                const realText = mItem ? fmt(mItem.actual) : null
                const pensLabel = pItem
                  ? pItem.status === 'exact-pens'
                    ? `pens ✓ +${pItem.points}`
                    : pItem.status === 'went'
                      ? `pens +${pItem.points}`
                      : 'pens ✗'
                  : null
                return (
                  <MatchRow
                    key={id}
                    teams={teams}
                    home={ko.home}
                    away={ko.away}
                    predText={fmt(ko) ?? '—'}
                    realText={realText}
                    chip={chip}
                    pens={pensLabel}
                    x2={!!x2}
                  />
                )
              })}
            </div>
          ))
        )}
      </section>

      {/* ===== CAMPEON ===== */}
      <section className="pd-section">
        <h2 className="pd-section__title">Campeón</h2>
        {pred.champion ? (
          <div className="pd-block">
            <MatchRow
              teams={teams}
              home={pred.champion}
              away={champItem?.actual ?? null}
              predText="👑"
              realText={champItem?.actual ? `campeón: ${champItem.actual}` : null}
              chip={
                champItem?.status === 'hit'
                  ? { cls: 'exact', text: `Acertó +${champItem.points}` }
                  : champItem?.status === 'miss'
                    ? { cls: 'miss', text: 'Falló +0' }
                    : { cls: 'pending', text: 'Por jugar' }
              }
            />
          </div>
        ) : (
          <p className="pd-muted">No eligió campeón.</p>
        )}
      </section>
    </main>
  )
}
