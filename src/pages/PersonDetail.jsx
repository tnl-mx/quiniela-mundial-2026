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

import { useEffect, useMemo } from 'react'
import './PersonDetail.css'
import { resolveStandings, isGroupComplete } from '../logic/scoring.js'
import { buildBracket } from '../logic/bracket.js'
import { latestPlayedMatchId } from '../logic/matchOrder.js'
import { readScroll, saveScroll } from '../data/scrollMemory.js'

const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

// Rondas del bracket (clave que devuelve buildBracket -> etiqueta visible),
// en orden de avance.
const KO_ROUNDS = [
  ['r32', 'Ronda de 32'],
  ['r16', 'Octavos'],
  ['qf', 'Cuartos'],
  ['sf', 'Semifinales'],
  ['third', 'Tercer lugar'],
  ['final', 'Final'],
]
const ROUND_ORDER = KO_ROUNDS.map(([, label]) => label)

function initials(name) {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// Vista de la pill de puntos de un partido: { tier, label, tooltip }.
//   tier define el COLOR:
//     'pending' (neutro) · 'miss' (gris, +0) · 'basic' (verde claro, acierto
//     basico) · 'good' (verde oscuro, marcador exacto) · 'max' (rosa mundial,
//     la jugada perfecta: en eliminatoria todo acertado + penales con x2).
//   tooltip explica de donde sale el numero (usa los puntos reales del motor).

function groupPoints(item) {
  if (!item) return { tier: 'pending', label: 'Por jugar', tooltip: 'Aún no se juega' }
  const p = item.points
  if (item.status === 'exact') return { tier: 'good', label: `+${p}`, tooltip: `Marcador exacto: +${p}` }
  if (item.status === 'outcome') return { tier: 'basic', label: `+${p}`, tooltip: `Resultado acertado: +${p}` }
  return { tier: 'miss', label: '+0', tooltip: 'No acertó el resultado: +0' }
}

function koPoints(mItem, pItem, x2) {
  if (!mItem) return { tier: 'pending', label: 'Por jugar', tooltip: 'Aún no se juega (o no se dio el cruce)' }
  const earned = (mItem.points || 0) + (pItem?.points || 0) + (x2?.points || 0)
  const parts = []
  parts.push(
    mItem.status === 'exact'
      ? `Marcador exacto +${mItem.points}`
      : mItem.status === 'outcome'
        ? `Resultado +${mItem.points}`
        : 'Marcador +0',
  )
  if (pItem && pItem.points > 0) {
    parts.push(pItem.status === 'exact-pens' ? `Penales exactos +${pItem.points}` : `Penales +${pItem.points}`)
  }
  if (x2) parts.push(`Multiplicador ×${x2.factor || 2}: +${x2.points}`)
  const tooltip = `${parts.join(' · ')} = +${earned}`
  let tier
  if (x2) tier = 'max' // jugada perfecta a penales -> rosa
  else if (mItem.status === 'exact') tier = 'good'
  else if (earned > 0) tier = 'basic'
  else tier = 'miss'
  return { tier, label: `+${earned}`, tooltip }
}

function champPoints(champItem) {
  if (!champItem || champItem.status === 'pending') {
    return { tier: 'pending', label: 'Por jugar', tooltip: 'Aún no hay campeón' }
  }
  if (champItem.status === 'hit') {
    return { tier: 'good', label: `+${champItem.points}`, tooltip: `Campeón acertado: +${champItem.points}` }
  }
  return { tier: 'miss', label: '+0', tooltip: 'Campeón fallado: +0' }
}

// Pill de puntos con color por desempeño y popover (hover/tap) con la matematica.
function PointsPill({ tier, label, tooltip }) {
  return (
    <span className={`pd-pts pd-pts--${tier}`} tabIndex={0}>
      {label}
      <span className="pd-pts__tip" role="tooltip">{tooltip}</span>
    </span>
  )
}

// ---------- Subcomponentes ----------

function Pill({ icon, label, value }) {
  return (
    <span className="pd-pill">
      <span aria-hidden="true">{icon}</span> {label} <strong>{value}</strong>
    </span>
  )
}

// Fila de partido con REJILLA consistente (todas las filas igual):
//   [ fixture: equipos + marcador predicho (+ PEN predicho debajo) ]
//   [ real: "Real X-Y" (· pen a-b) ]
//   [ pill de puntos a la derecha ]
// Asi la pill de puntos y el marcador real quedan alineados entre filas, y la
// pill de penales predichos (PEN x-y) NO descuadra (vive dentro del fixture).
// `predPens` = "x-y" (sin prefijo); `points` = { tier, label, tooltip }.
// `played` = el partido ya tiene resultado real (oficial) -> se tinta la fila.
function MatchRow({ teams, home, away, predText, predPens, realText, points, played, matchId }) {
  const flag = (c) => teams[c]?.flag ?? '🏳'
  return (
    <div className={`pd-match ${played ? 'pd-match--played' : ''}`} data-match-id={matchId}>
      <div className="pd-fixture">
        <div className="pd-fixture__line">
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
        {predPens && <span className="pd-predpens">PEN {predPens}</span>}
      </div>

      <div className="pd-real">
        {realText ? <>Real <strong>{realText}</strong></> : null}
      </div>

      <div className="pd-points">
        <PointsPill {...points} />
      </div>
    </div>
  )
}

// ---------- Vista ----------

export function PersonDetail({ row, position, tournament, teams, realResults, annexCOptions = [], demo = false, tournamentId, onBack }) {
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

  // ----- Fase eliminatoria: bracket DERIVADO de la tabla de grupo de la
  // persona (igual que el motor de puntuacion), para que vea su bracket ya
  // RECALCULADO segun el desempate FIFA 2026 y no el que se guardo al llenar la
  // quiniela. Se respeta el marcador que predijo en cada llave; el equipo de
  // cada slot se deriva del grupo (1o/2o/3o), igual que como se le puntua.
  const predBracket = useMemo(
    () => buildBracket({ tournament, teams, annexCOptions, predictions: pred }),
    [tournament, teams, annexCOptions, pred],
  )
  const koByRound = {}
  for (const [key, label] of KO_ROUNDS) {
    const ms = (predBracket[key] ?? []).filter((m) => m.home && m.away)
    if (ms.length) koByRound[label] = ms
  }
  const hasKnockout = Object.keys(koByRound).length > 0

  // ----- Posicionar el scroll al ABRIR la quiniela (una vez por persona) -----
  // Prioridad: 1) si hay memoria y NO entro un resultado nuevo desde entonces,
  //               restaura donde te quedaste;
  //            2) si hay un resultado NUEVO (o no hay memoria valida): ve al
  //               ultimo resultado capturado y resaltalo;
  //            3) si nada se ha jugado, ve al inicio.
  // El "resultado nuevo" se detecta comparando el tag guardado (el ultimo
  // resultado en ese momento) contra el ultimo resultado actual.
  // Va dentro de requestAnimationFrame para correr DESPUES de pintar el detalle
  // (asi nunca hereda el scroll del leaderboard).
  useEffect(() => {
    const memKey = `person:${tournamentId}:${row.file}`
    const currentLatest = latestPlayedMatchId(realResults)
    const raf = requestAnimationFrame(() => {
      const mem = readScroll(memKey)
      // Solo restauramos la memoria si NO hay un score nuevo (mismo ultimo
      // resultado que cuando se guardo).
      if (mem && mem.tag === currentLatest) {
        window.scrollTo(0, mem.y)
        return
      }
      if (currentLatest) {
        const el = document.querySelector(`[data-match-id="${currentLatest}"]`)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'auto' })
          el.classList.add('pd-match--latest')
          setTimeout(() => el.classList.remove('pd-match--latest'), 2100)
          return
        }
      }
      window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.file, tournamentId])

  // ----- Guardar la posicion de scroll mientras navega (throttle con rAF) -----
  // Junto a la posicion guardamos el ultimo resultado actual (tag), para poder
  // detectar despues si entro un score nuevo.
  useEffect(() => {
    const memKey = `person:${tournamentId}:${row.file}`
    const currentLatest = latestPlayedMatchId(realResults)
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        saveScroll(memKey, window.scrollY, currentLatest)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.file, tournamentId])

  return (
    <main className="pd-page">
      <div className="pd-backbar">
        <button type="button" className="pd-back" onClick={onBack}>
          <span className="pd-back__arrow" aria-hidden="true">←</span>
          Volver al leaderboard
        </button>
      </div>

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
          const playedInGroup = matches.filter((m) => gm[m.id]).length
          // Posiciones que PREDIJO la persona: su quiniela es fija, asi que se
          // muestran SIEMPRE (aunque el grupo todavia no cierre).
          const predSt = resolveStandings(pred, g, tournament, teams)
          // Tabla REAL: posicion ACTUAL segun lo ya jugado (o final, si cerro).
          // Sin partidos jugados aun no hay nada que mostrar.
          const realSt =
            playedInGroup > 0 ? resolveStandings(realResults, g, tournament, teams) : null

          return (
            <div className="pd-block" key={g}>
              <h3 className="pd-block__title">Grupo {g}</h3>

              {matches.map((m) => {
                const item = gm[m.id]
                const p = pred.groupMatches?.[m.id]
                return (
                  <MatchRow
                    key={m.id}
                    teams={teams}
                    home={m.home}
                    away={m.away}
                    predText={fmt(p) ?? '—'}
                    realText={item ? fmt(item.actual) : null}
                    points={groupPoints(item)}
                    played={!!item}
                    matchId={m.id}
                  />
                )
              })}

              {/* Tabla del grupo: a la izquierda lo que PREDIJO la persona (su
                  orden final), a la derecha la posicion ACTUAL segun lo ya
                  jugado (o el orden FINAL cuando el grupo cierra). El acierto
                  (✓ y color) solo se marca cuando el grupo ya termino: antes no
                  hay con que comparar. */}
              {predSt && (
                <div className="pd-standings">
                  <div className="pd-standings__row pd-standings__row--head">
                    <span>#</span>
                    <span>Predicho</span>
                    <span>{complete ? 'Final' : 'Actual'}</span>
                  </div>
                  {[0, 1, 2, 3].map((i) => {
                    const ok = complete && predSt[i] && predSt[i] === realSt[i]
                    const cellClass = !complete
                      ? ''
                      : ok
                        ? 'pd-standings__cell--ok'
                        : 'pd-standings__cell--bad'
                    return (
                      <div className="pd-standings__row" key={i}>
                        <span>{i + 1}</span>
                        <span className={cellClass}>
                          {teams[predSt[i]]?.flag ?? ''} {predSt[i]}
                          {ok ? ' ✓' : ''}
                        </span>
                        <span>
                          {realSt ? (
                            <>
                              {teams[realSt[i]]?.flag ?? ''} {realSt[i]}
                            </>
                          ) : (
                            <span className="pd-standings__pending">—</span>
                          )}
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
              {koByRound[r].map((m) => {
                const mItem = koMatch[m.id]
                const pItem = koPens[m.id]
                const x2 = koX2[m.id]

                // Penales que PREDIJO la persona (si capturo una llave empatada
                // con pens). "x-y" sin prefijo (MatchRow le antepone "PEN ").
                const pp = m.pens
                const predPens =
                  pp?.went && Number.isFinite(pp.hs) && Number.isFinite(pp.as)
                    ? `${pp.hs}-${pp.as}`
                    : null

                // Penales REALES (si se jugo y fue a pens): mapeados por equipo
                // en el item de scoring; se anexan al marcador real.
                const rp = pItem?.actual
                const realPens =
                  rp && Number.isFinite(rp.hs) && Number.isFinite(rp.as)
                    ? ` · pen ${rp.hs}-${rp.as}`
                    : ''
                const realText = mItem ? `${fmt(mItem.actual)}${realPens}` : null

                return (
                  <MatchRow
                    key={m.id}
                    teams={teams}
                    home={m.home}
                    away={m.away}
                    predText={fmt(m) ?? '—'}
                    predPens={predPens}
                    realText={realText}
                    points={koPoints(mItem, pItem, x2)}
                    played={!!mItem}
                    matchId={m.id}
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
              realText={
                champItem?.actual && champItem.status !== 'pending'
                  ? `campeón: ${champItem.actual}`
                  : null
              }
              points={champPoints(champItem)}
              played={!!champItem && champItem.status !== 'pending'}
            />
          </div>
        ) : (
          <p className="pd-muted">No eligió campeón.</p>
        )}
      </section>
    </main>
  )
}
