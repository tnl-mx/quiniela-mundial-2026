// ============================================================================
// LEADERBOARD funcional del dashboard.
//
// Lee las quinielas reales (via predictions/index.json), corre el motor de
// puntuacion (src/logic/scoring.js) por cada una y muestra el ranking tipo
// tabla de futbol. Reutiliza el diseno aprobado en el prototipo.
//
// Props:
//   - demo: si true, usa los datos de ejemplo gitignored (solo local).
//
// Al tocar una fila se abre el DETALLE de esa persona (PersonDetail), con
// navegacion por estado interno (sin ruteo de URL todavia).
// ============================================================================

import { useState } from 'react'
import './Leaderboard.css'
import { useLeaderboard } from '../data/useLeaderboard.js'
import { PersonDetail } from './PersonDetail.jsx'
import { EvolutionChart } from './EvolutionChart.jsx'

// Indicador de subio/bajo respecto a hace 4 partidos.
function DeltaIndicator({ delta }) {
  if (delta == null) return null
  if (delta > 0) return <span className="lb-delta lb-delta--up" title={`Subió ${delta}`}>▲{delta}</span>
  if (delta < 0) return <span className="lb-delta lb-delta--down" title={`Bajó ${-delta}`}>▼{-delta}</span>
  return <span className="lb-delta lb-delta--same" title="Sin cambio">–</span>
}

// Categorias del desglose: icono, etiquetas y el texto de ayuda del popover.
// Las claves coinciden con `cols` que arma useLeaderboard.
// Orden: fase de grupos primero (Partidos, Grupos), luego eliminatoria
// (Avance) y Campeón. Este orden se aplica solo: encabezados desktop, pills
// movil y leyenda mapean sobre este mismo array.
// Nota: el icono de Avance usa 🔼 (U+1F53C), un emoji de UN solo code point con
// presentacion emoji garantizada, igual que ⚽ 📊 👑. La flecha ⬆/⬆️ (U+2B06,
// dingbat) se renderiza inconsistente (a veces como texto chico) y descuadraba
// el encabezado; 🔼 se apila ARRIBA del texto idéntico a los otros tres.
const CATEGORIES = [
  {
    key: 'partidos',
    icon: '⚽',
    short: 'Part',
    long: 'Partidos',
    help: 'Puntos por acertar el resultado o el marcador exacto de los partidos (grupos y eliminatoria).',
  },
  {
    key: 'grupos',
    icon: '📊',
    short: 'Gru',
    long: 'Grupos',
    help: 'Puntos por la clasificación y la posición final de los equipos en cada grupo.',
  },
  {
    key: 'avance',
    icon: '🔼',
    short: 'Av',
    long: 'Avance',
    help: 'Puntos por atinar qué equipos avanzan en cada ronda de la eliminatoria.',
  },
  {
    key: 'campeon',
    icon: '👑',
    short: 'Camp',
    long: 'Campeón',
    help: 'Puntos por acertar al campeón del Mundial.',
  },
]

// Pill/chip que muestra el CAMPEON que ELIGIO la persona en su quiniela (su
// prediccion, no los puntos). Es un boton para que en movil se pueda TOCAR y
// ver el popover; stopPropagation evita que el toque abra el detalle de la fila.
function ChampionPick({ teams, code, className }) {
  if (!code) return null
  const flag = teams?.[code]?.flag ?? '🏳'
  const stop = (e) => e.stopPropagation()
  return (
    <button
      type="button"
      className={`lb-champ ${className}`}
      onClick={stop}
      title="Campeón que eligió esta persona en su quiniela"
    >
      <span aria-hidden="true">👑 {flag}</span> {code}
      <span className="lb-champ__tip" role="tooltip">
        Campeón que eligió esta persona en su quiniela
      </span>
    </button>
  )
}

function initials(name) {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Puntos de eliminatoria de una fila (avance + marcador KO + penales + bono).
function knockoutPoints(row) {
  const b = row.breakdown
  return b.knockoutAdvance + b.knockoutMatch + b.penalties + b.multiplierBonus
}

function maxBy(rows, fn) {
  return rows.reduce((best, r) => (fn(r) > fn(best) ? r : best), rows[0])
}

// ---------- Subcomponentes ----------

function StatCard({ tag, name, detail }) {
  return (
    <div className="lb-stat">
      <span className="lb-stat__tag">{tag}</span>
      <span className="lb-stat__name">{name}</span>
      <span className="lb-stat__detail">{detail}</span>
    </div>
  )
}

function Row({ row, position, teams, onSelect }) {
  const medalClass =
    position === 1 ? 'is-gold' : position === 2 ? 'is-silver' : position === 3 ? 'is-bronze' : ''

  // Soporta clic y teclado (Enter/Espacio) porque la fila es role="button".
  const open = () => onSelect(row)
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  }

  const championPick = row.prediction?.champion ?? null

  return (
    <div
      className={`lb-row lb-grid ${position === 1 ? 'is-first' : ''}`}
      role="button"
      tabIndex={0}
      title={`Ver detalle de ${row.name}`}
      onClick={open}
      onKeyDown={onKey}
    >
      <div className="lb-rankcell">
        <div className={`lb-rank ${medalClass}`}>{position}</div>
        <DeltaIndicator delta={row.delta} />
      </div>

      <div className="lb-main">
        <div className="lb-name-line">
          <span className="lb-avatar" aria-hidden="true">{initials(row.name)}</span>
          <span className="lb-name">{row.name}</span>
        </div>
        {/* DESKTOP: chip del campeon elegido, debajo del nombre (no es columna). */}
        <ChampionPick teams={teams} code={championPick} className="lb-champ--chip" />
        {/* Desglose para MOVIL: pills bajo el nombre (ocultas en desktop) */}
        <div className="lb-pills">
          {CATEGORIES.map((c) => (
            <span className="lb-pill" key={c.key}>
              <span aria-hidden="true">{c.icon}</span> {c.short} {row.cols[c.key]}
            </span>
          ))}
          {/* MOVIL: una pill mas con el campeon elegido (su prediccion). */}
          <ChampionPick teams={teams} code={championPick} className="lb-champ--pill" />
        </div>
      </div>

      {/* Celdas de desglose para DESKTOP (ocultas en movil) */}
      {CATEGORIES.map((c) => (
        <div className="lb-cell lb-num" key={c.key}>
          {row.cols[c.key]}
        </div>
      ))}

      <div className="lb-cell-total lb-num">{row.total}</div>
    </div>
  )
}

// Estado grande centrado (carga / vacio / error).
function State({ emoji, title, text }) {
  return (
    <div className="lb-state">
      <span className="lb-state__emoji" aria-hidden="true">{emoji}</span>
      <h2 className="lb-state__title">{title}</h2>
      {text && <p className="lb-state__text">{text}</p>}
    </div>
  )
}

// ---------- Pantalla ----------

// URL de la raiz (la app de quiniela) respetando el base path de Pages.
const QUINIELA_URL = import.meta.env.BASE_URL ?? '/'

export function Leaderboard({ tournamentId }) {
  const demo = tournamentId === 'demo'
  const {
    loading,
    error,
    notFound,
    tournamentName,
    rows,
    phase,
    counts,
    tournament,
    teams,
    realResults,
    scoring,
    annexCOptions,
  } = useLeaderboard({ tournamentId })

  // Navegacion al detalle por persona (estado interno, sin ruteo de URL).
  const [selectedFile, setSelectedFile] = useState(null)
  const selectedIndex = rows.findIndex((r) => r.file === selectedFile)
  if (selectedFile && selectedIndex !== -1) {
    return (
      <PersonDetail
        row={rows[selectedIndex]}
        position={selectedIndex + 1}
        tournament={tournament}
        teams={teams}
        realResults={realResults}
        demo={demo}
        onBack={() => setSelectedFile(null)}
      />
    )
  }

  // Subtitulo segun la fase del torneo.
  const subtitle =
    phase === 'knockout'
      ? `Fase eliminatoria en curso · ${counts.koPlayed} partidos de eliminatoria jugados`
      : phase === 'groups'
        ? `Fase de grupos en curso · ${counts.groupPlayed} partidos jugados`
        : 'El torneo aún no comienza'

  const title = tournamentName
    ? `${tournamentName} · Mundial 2026`
    : 'Leaderboard · Quiniela Mundial 2026'

  return (
    <main className="lb-page">
      <a className="lb-home-link" href={QUINIELA_URL}>
        ← Ir a llenar tu quiniela
      </a>

      <header className="lb-header">
        <h1 className="lb-title">{title}</h1>
        <p className="lb-subtitle">{subtitle}</p>
        {demo && <span className="lb-demo-flag">⚠ Modo demo · datos de ejemplo</span>}
      </header>

      {!loading && notFound && (
        <State
          emoji="🔍"
          title="Torneo no encontrado"
          text="Revisa el enlace. Los torneos disponibles están en #/torneos."
        />
      )}

      {loading && <State emoji="⏳" title="Cargando leaderboard…" />}

      {!loading && error && (
        <State
          emoji="⚠️"
          title="No se pudo cargar el leaderboard"
          text={error.message}
        />
      )}

      {!loading && !error && !notFound && rows.length === 0 && (
        <State
          emoji="📭"
          title="Aún no hay quinielas"
          text="Cuando se suban quinielas aparecerán aquí, rankeadas por puntos."
        />
      )}

      {!loading && !error && !notFound && rows.length > 0 && (
        <>
          {/* Tarjetas de stats: solo las que aplican a la fase actual */}
          {phase !== 'pre' && (
            <section className="lb-stats">
              <StatCard tag="🥇 Líder" name={rows[0].name} detail={`${rows[0].total} pts`} />
              <StatCard
                tag="🎯 Rey del marcador"
                name={maxBy(rows, (r) => r.cols.partidos).name}
                detail={`${maxBy(rows, (r) => r.cols.partidos).cols.partidos} pts en partidos`}
              />
              {phase === 'knockout' && (
                <StatCard
                  tag="🔼 Rey de la eliminatoria"
                  name={maxBy(rows, knockoutPoints).name}
                  detail={`${knockoutPoints(maxBy(rows, knockoutPoints))} pts de eliminatoria`}
                />
              )}
            </section>
          )}

          {/* Banner cuando hay gente pero el torneo no ha empezado (todos en 0) */}
          {phase === 'pre' && (
            <div className="lb-banner">
              El torneo no ha comenzado. Los puntos aparecerán cuando haya resultados.
            </div>
          )}

          {/* Tabla */}
          <section className="lb-table" aria-label="Tabla de posiciones">
            <div className="lb-head lb-grid">
              <div className="lb-rank-head">#</div>
              <div>Participante</div>
              {CATEGORIES.map((c) => (
                <button type="button" className="lb-cell lb-th" key={c.key}>
                  <span className="lb-th__icon" aria-hidden="true">{c.icon}</span>
                  <span className="lb-th__label">{c.long}</span>
                  <span className="lb-th__tip" role="tooltip">{c.help}</span>
                </button>
              ))}
              <div className="lb-cell-total lb-num">Total</div>
            </div>

            {rows.map((row, i) => (
              <Row
                key={row.file}
                row={row}
                position={i + 1}
                teams={teams}
                onSelect={(r) => setSelectedFile(r.file)}
              />
            ))}
          </section>

          {/* Leyenda discreta (tambien sirve de ayuda en movil, donde no hay hover) */}
          <p className="lb-legend">
            {CATEGORIES.map((c, i) => (
              <span key={c.key}>
                {i > 0 && ' · '}
                <span aria-hidden="true">{c.icon}</span> <strong>{c.long}</strong>{' '}
                ({c.help.replace(/\.$/, '').toLowerCase()})
              </span>
            ))}
            {' · '}
            <strong>Total</strong> = suma de las cuatro
          </p>

          <p className="lb-note">
            Toca una fila para ver el detalle de cada persona.
          </p>

          {/* Gráfica de evolución (solo de las quinielas de ESTE torneo) */}
          <EvolutionChart
            rows={rows}
            realResults={realResults}
            tournament={tournament}
            teams={teams}
            annexCOptions={annexCOptions}
            scoring={scoring}
          />
        </>
      )}
    </main>
  )
}
