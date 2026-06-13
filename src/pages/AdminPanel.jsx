// ============================================================================
// PANEL DEL ORGANIZADOR (#/admin).
//
// Captura los RESULTADOS REALES del Mundial y descarga real-results.json listo
// para commit. Reutiliza el motor: buildBracket arma el cuadro real automatico
// a partir de los resultados de grupos (opcion a).
//
// LO OFICIAL ES LA BASE: al abrir, carga el real-results.json del repo (lo ya
// subido) y lo muestra como capturado. Encima aplica el BORRADOR local solo
// para lo que falte; si un partido difiere entre oficial y borrador, lo marca
// como CONFLICTO y deja elegir (no pisa en silencio).
//
// Acceso: PIN (333221). Solo DISUADE; la proteccion real es que el archivo
// oficial solo cambia por commit.
// ============================================================================

import './AdminPanel.css'
import { useEffect, useRef, useState } from 'react'
import { useDataset } from '../data/useDataset.js'
import { useRealResultsDraft } from '../state/useRealResultsDraft.js'
import { loadRealResults } from '../data/loaders.js'
import { buildBracket } from '../logic/bracket.js'
import { calculateGroupTable } from '../logic/groupTable.js'
import { buildRealResultsJson } from '../logic/realResultsExport.js'
import { isStaleKnockout } from '../logic/knockoutStale.js'
import { mergeRealResults, findConflicts } from '../logic/realResultsMerge.js'
import { fillAllRemainingAtRandom } from '../logic/randomFill.js'
import { publishRealResults } from '../logic/githubPublish.js'

const PIN = '333221'
const AUTH_KEY = 'quiniela-mundial-2026:admin-auth'
const GH_TOKEN_KEY = 'quiniela-mundial-2026:gh-token'
const QUINIELA_URL = import.meta.env.BASE_URL ?? '/'

const KO_ROUNDS = [
  { key: 'r32', label: 'Ronda de 32' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semifinales' },
  { key: 'third', label: 'Tercer lugar' },
  { key: 'final', label: 'Final' },
]
const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function isValid(s) {
  return s != null && Number.isFinite(s.hs) && Number.isFinite(s.as)
}

function fmtScore(e) {
  if (!isValid(e)) return '—'
  let s = `${e.hs}–${e.as}`
  if (e.pens?.went) s += ` (pen ${e.pens.hs}-${e.pens.as})`
  return s
}

// ---------- Control +/- ----------
function Stepper({ value, onChange, label }) {
  return (
    <div className="adm-stepper">
      <button type="button" className="adm-stepper__btn" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Restar a ${label}`}>−</button>
      <span className="adm-stepper__val">{value}</span>
      <button type="button" className="adm-stepper__btn" onClick={() => onChange(Math.min(99, value + 1))} aria-label={`Sumar a ${label}`}>+</button>
    </div>
  )
}

function Fixture({ teams, home, away, hs, as, onHome, onAway }) {
  const flag = (c) => teams[c]?.flag ?? '🏳'
  const nm = (c) => teams[c]?.name ?? c
  return (
    <div className="adm-fixture">
      <span className="adm-team adm-team--home" title={nm(home)}>
        <span className="adm-code">{home}</span>
        <span className="adm-flag" aria-hidden="true">{flag(home)}</span>
      </span>
      <Stepper value={hs} onChange={onHome} label={nm(home)} />
      <span className="adm-vs" aria-hidden="true">-</span>
      <Stepper value={as} onChange={onAway} label={nm(away)} />
      <span className="adm-team adm-team--away" title={nm(away)}>
        <span className="adm-flag" aria-hidden="true">{flag(away)}</span>
        <span className="adm-code">{away}</span>
      </span>
    </div>
  )
}

// ---------- Fila de conflicto (oficial vs borrador) ----------
function ConflictRow({ idLabel, teams, home, away, official, local, onUsarOficial, onConservarMio }) {
  const flag = (c) => teams[c]?.flag ?? '🏳'
  return (
    <div className="adm-match is-conflict">
      <span className="adm-ko-id">{idLabel}</span>
      <div className="adm-conflict">
        <p className="adm-conflict__head">
          ⚠ <strong>{home} {flag(home)} vs {flag(away)} {away}</strong> · difiere de lo guardado
        </p>
        <div className="adm-conflict__opts">
          <span className="adm-conflict__opt">Oficial: <strong>{fmtScore(official)}</strong></span>
          <span className="adm-conflict__opt">Tu borrador: <strong>{fmtScore(local)}</strong></span>
        </div>
        <div className="adm-conflict__btns">
          <button type="button" className="btn btn-secondary" onClick={onUsarOficial}>Usar oficial</button>
          <button type="button" className="btn btn-primary" onClick={onConservarMio}>Conservar el mío</button>
        </div>
      </div>
    </div>
  )
}

// ---------- Partido de grupo ----------
function GroupMatch({ match, teams, cls, score, official, local, onScore, onClear, onUsarOficial, onConservarMio }) {
  if (cls === 'conflict') {
    return (
      <ConflictRow
        idLabel={match.id}
        teams={teams}
        home={match.home}
        away={match.away}
        official={official}
        local={local}
        onUsarOficial={() => onUsarOficial(match.id)}
        onConservarMio={() => onConservarMio(match.id)}
      />
    )
  }
  const captured = isValid(score)
  const hs = score?.hs ?? 0
  const as = score?.as ?? 0
  return (
    <div className={`adm-match ${captured ? 'is-captured' : ''}`}>
      <Fixture
        teams={teams}
        home={match.home}
        away={match.away}
        hs={hs}
        as={as}
        onHome={(v) => onScore(match.id, v, as)}
        onAway={(v) => onScore(match.id, hs, v)}
      />
      <div className="adm-actions">
        {cls === 'official' && <span className="adm-tag adm-tag--ok">✓ oficial</span>}
        {cls === 'local' && <span className="adm-tag adm-tag--local">• local sin subir</span>}
        {cls === 'local' && <button type="button" className="adm-link" onClick={() => onClear(match.id)}>quitar mi cambio</button>}
        {cls === 'empty' && <button type="button" className="adm-link" onClick={() => onScore(match.id, 0, 0)}>marcar 0–0</button>}
      </div>
    </div>
  )
}

// ---------- Llave eliminatoria ----------
function KnockoutMatch({ live, teams, cls, effEntry, official, local, onScore, onPens, onClear, onUsarOficial, onConservarMio }) {
  if (!live.home || !live.away) {
    return (
      <div className="adm-match is-pending">
        <span className="adm-ko-id">{live.id}</span>
        <span className="adm-pending-msg">Esperando resultados de la ronda anterior…</span>
      </div>
    )
  }

  if (cls === 'conflict') {
    return (
      <ConflictRow
        idLabel={live.id}
        teams={teams}
        home={live.home}
        away={live.away}
        official={official}
        local={local}
        onUsarOficial={() => onUsarOficial(live.id)}
        onConservarMio={() => onConservarMio(live.id)}
      />
    )
  }

  const stale = isStaleKnockout(effEntry, live)
  const hasScore = Number.isFinite(live.hs) && Number.isFinite(live.as)
  const captured = hasScore && !stale
  const hs = live.hs ?? 0
  const as = live.as ?? 0
  const tied = hasScore && hs === as

  return (
    <div className={`adm-match ${captured ? 'is-captured' : ''} ${stale ? 'is-stale' : ''}`}>
      <span className="adm-ko-id">{live.id}</span>
      <Fixture
        teams={teams}
        home={live.home}
        away={live.away}
        hs={hs}
        as={as}
        onHome={(v) => onScore(live.id, v, as, live.home, live.away)}
        onAway={(v) => onScore(live.id, hs, v, live.home, live.away)}
      />

      {tied && (
        <div className="adm-pens">
          <span className="adm-pens__label">Penales</span>
          <Stepper value={live.pens?.hs ?? 0} onChange={(v) => onPens(live.id, v, live.pens?.as ?? 0)} label="penales local" />
          <span className="adm-vs" aria-hidden="true">-</span>
          <Stepper value={live.pens?.as ?? 0} onChange={(v) => onPens(live.id, live.pens?.hs ?? 0, v)} label="penales visitante" />
          {live.pens?.went && live.pens.hs === live.pens.as && (
            <span className="adm-pens__warn">Los penales no pueden empatar</span>
          )}
        </div>
      )}

      <div className="adm-actions">
        {stale ? (
          <span className="adm-tag adm-tag--stale">⚠ Revisar: cambiaron los equipos. Reconfirma.</span>
        ) : cls === 'official' ? (
          <span className="adm-tag adm-tag--ok">✓ oficial</span>
        ) : cls === 'local' ? (
          <span className="adm-tag adm-tag--local">• local sin subir</span>
        ) : (
          <span className="adm-tag adm-tag--todo">por capturar</span>
        )}
        {(cls === 'local' || stale) && (
          <button type="button" className="adm-link" onClick={() => onClear(live.id)}>quitar mi cambio</button>
        )}
      </div>
    </div>
  )
}

// ---------- Desempate manual ----------
function TiebreakControl({ groupCode, provisionalOrder, teams, onSave }) {
  const [order, setOrder] = useState(provisionalOrder)
  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOrder(next)
  }
  return (
    <div className="adm-tiebreak">
      <p className="adm-tiebreak__title">⚠ Empate exacto en el Grupo {groupCode}. Define el orden real (1º a 4º):</p>
      {order.map((code, i) => (
        <div className="adm-tiebreak__row" key={code}>
          <span className="adm-tiebreak__pos">{i + 1}º</span>
          <span className="adm-flag" aria-hidden="true">{teams[code]?.flag ?? '🏳'}</span>
          <span className="adm-code">{code}</span>
          <span className="adm-tiebreak__name">{teams[code]?.name ?? code}</span>
          <span className="adm-tiebreak__moves">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">▲</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Bajar">▼</button>
          </span>
        </div>
      ))}
      <button type="button" className="btn btn-primary adm-tiebreak__save" onClick={() => onSave(order)}>
        Guardar orden del Grupo {groupCode}
      </button>
    </div>
  )
}

// ---------- Gate de PIN ----------
function PinGate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const submit = (e) => {
    e.preventDefault()
    if (value === PIN) {
      try { window.localStorage.setItem(AUTH_KEY, '1') } catch { /* modo privado */ }
      onUnlock()
    } else {
      setError(true)
    }
  }
  return (
    <main className="adm-gate">
      <form className="adm-gate__card" onSubmit={submit}>
        <h1 className="adm-gate__title">🔒 Panel del organizador</h1>
        <p className="adm-gate__sub">Ingresa el PIN para capturar resultados reales.</p>
        <input className="adm-gate__input" type="password" inputMode="numeric" autoFocus value={value}
          onChange={(e) => { setValue(e.target.value); setError(false) }} placeholder="PIN" aria-label="PIN" />
        {error && <p className="adm-gate__error">PIN incorrecto.</p>}
        <button type="submit" className="btn btn-primary">Entrar</button>
        <p className="adm-gate__note">Esto solo evita entradas accidentales. El archivo oficial se actualiza por commit, no desde aquí.</p>
        <a className="adm-gate__home" href={QUINIELA_URL}>← Volver al inicio</a>
      </form>
    </main>
  )
}

// ---------- Panel ----------
export function AdminPanel() {
  const [authed, setAuthed] = useState(() => {
    try { return window.localStorage.getItem(AUTH_KEY) === '1' } catch { return false }
  })

  const dataset = useDataset()
  const {
    draft, setGroupScore, clearGroupScore, setGroupTiebreak,
    setKnockoutScore, setKnockoutPens, clearKnockout, clearAll, applyGroupScores,
  } = useRealResultsDraft()

  // Cargamos el real-results OFICIAL del repo (la base).
  const [official, setOfficial] = useState(null)
  const [officialError, setOfficialError] = useState(false)
  useEffect(() => {
    let cancelled = false
    loadRealResults()
      .then((o) => { if (!cancelled) setOfficial(o) })
      .catch(() => {
        if (!cancelled) {
          setOfficialError(true)
          setOfficial({ groupMatches: {}, knockout: {}, champion: null, awards: {} })
        }
      })
    return () => { cancelled = true }
  }, [])

  // Conflictos iniciales: fotografia al abrir (borrador vs oficial).
  const conflictsRef = useRef(null)
  const [keptLocal, setKeptLocal] = useState(() => new Set())

  // Publicar a GitHub: token (solo en este dispositivo) + estado de publicacion.
  const [ghToken, setGhToken] = useState(() => {
    try { return window.localStorage.getItem(GH_TOKEN_KEY) || '' } catch { return '' }
  })
  const [publishState, setPublishState] = useState({ loading: false, ok: null, error: null, commitUrl: null })

  if (!authed) return <PinGate onUnlock={() => setAuthed(true)} />
  if (dataset.loading) return <main className="adm-page"><p>Cargando datos del torneo…</p></main>
  if (dataset.error) return <main className="adm-page"><p>Error al cargar datos: {dataset.error.message}</p></main>
  if (official === null) return <main className="adm-page"><p>Cargando resultados oficiales…</p></main>

  const { tournament, teams } = dataset

  // Fijamos los conflictos iniciales una sola vez (al tener oficial + borrador).
  if (conflictsRef.current === null) {
    conflictsRef.current = findConflicts(official, draft)
  }
  const conflicts = conflictsRef.current

  // Mezcla oficial + borrador -> efectivo + clasificacion + conteos.
  const { effective, groupClass, koClass, counts } = mergeRealResults({
    official, draft, conflicts, keptLocal,
  })

  // El bracket vivo se arma sobre el EFECTIVO (oficial + cambios locales).
  const bracket = buildBracket({
    tournament, teams,
    annexCOptions: dataset.annexCOptions,
    predictions: effective,
  })

  // --- Resolucion de conflictos ---
  const usarOficial = (id) => {
    // Quitar mi cambio local: el efectivo vuelve a usar el oficial.
    if (id.startsWith('M')) clearKnockout(id)
    else clearGroupScore(id)
  }
  const conservarMio = (id) => {
    setKeptLocal((prev) => new Set(prev).add(id))
  }

  // --- Progreso / fase ---
  const groupCaptured = Object.values(effective.groupMatches).filter(isValid).length
  const allGroupsComplete = groupCaptured === tournament.groupMatches.length

  // --- Empates de grupo por resolver ---
  const tiedGroups = []
  if (allGroupsComplete) {
    for (const g of GROUP_LETTERS) {
      if (!tournament.groups[g]) continue
      if (effective.groupTiebreaks[g]) continue
      const table = calculateGroupTable({ groupCode: g, predictions: effective.groupMatches, tournament, teams })
      if (table.slice(0, 3).some((r) => r.tied)) {
        tiedGroups.push({ groupCode: g, order: table.map((r) => r.code) })
      }
    }
  }

  // --- JSON oficial (oficial + mis cambios) ---
  const json = buildRealResultsJson({ draft: effective, bracket })
  const jsonText = JSON.stringify(json, null, 2)

  const download = () => {
    if (counts.conflict > 0 && !window.confirm(
      `Tienes ${counts.conflict} conflicto(s) sin resolver. El archivo usará el valor OFICIAL en esos. ¿Descargar igual?`,
    )) return
    const blob = new Blob([jsonText + '\n'], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'real-results.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = () => {
    navigator.clipboard?.writeText(jsonText).then(
      () => alert('real-results.json copiado al portapapeles.'),
      () => alert('No se pudo copiar; usa Descargar.'),
    )
  }
  const logout = () => {
    try { window.localStorage.removeItem(AUTH_KEY) } catch { /* noop */ }
    setAuthed(false)
  }
  const testFillGroups = () => {
    applyGroupScores(fillAllRemainingAtRandom({ tournament, predictions: effective }))
  }
  const wipe = () => {
    if (window.confirm('¿Vaciar TODO tu borrador local? (no afecta el archivo oficial ni lo ya subido)')) clearAll()
  }

  // Token: se guarda solo en este dispositivo (localStorage), nunca en el repo.
  const onTokenChange = (value) => {
    setGhToken(value)
    try { window.localStorage.setItem(GH_TOKEN_KEY, value) } catch { /* noop */ }
    setPublishState({ loading: false, ok: null, error: null, commitUrl: null })
  }

  // Publica el mismo JSON (oficial + mis cambios) directo a main via API.
  const publish = async () => {
    if (!ghToken.trim()) {
      setPublishState({ loading: false, ok: false, error: 'Captura primero tu token de GitHub.', commitUrl: null })
      return
    }
    if (counts.conflict > 0 && !window.confirm(
      `Tienes ${counts.conflict} conflicto(s) sin resolver. Se publicará el valor OFICIAL en esos. ¿Publicar igual?`,
    )) return
    setPublishState({ loading: true, ok: null, error: null, commitUrl: null })
    const res = await publishRealResults({ token: ghToken.trim(), json })
    if (res.ok) {
      setPublishState({ loading: false, ok: true, error: null, commitUrl: res.commitUrl })
    } else {
      setPublishState({ loading: false, ok: false, error: res.error || 'No se pudo publicar.', commitUrl: null })
    }
  }

  const koLive = [...bracket.r32, ...bracket.r16, ...bracket.qf, ...bracket.sf, ...bracket.third, ...bracket.final]

  return (
    <main className="adm-page">
      <header className="adm-bar">
        <div className="adm-bar__title">
          <strong>Panel del organizador</strong>
          <span className="adm-bar__sub">Resultados reales · Mundial 2026 (compartido por todos los torneos)</span>
        </div>
        <div className="adm-bar__progress">
          <span>Del oficial: <strong>{counts.official}</strong></span>
          <span> · Locales sin subir: <strong>{counts.local}</strong></span>
          {counts.conflict > 0 && <span className="adm-bar__stale"> · Conflictos: {counts.conflict}</span>}
        </div>
        <div className="adm-bar__actions">
          <button type="button" className="btn btn-primary" onClick={download}>⬇ Descargar JSON</button>
          <button type="button" className="btn btn-secondary" onClick={copy}>Copiar</button>
          <button type="button" className="adm-link" onClick={logout}>Salir</button>
        </div>
      </header>

      <p className="adm-note">
        Base: el <code>real-results.json</code> ya subido. Tus cambios se guardan local hasta que descargues el JSON y lo subas por commit.
        {officialError && ' (No se pudo cargar el oficial; trabajando solo con tu borrador.)'}
      </p>

      {/* FASE DE GRUPOS */}
      <section className="adm-section">
        <h2 className="adm-section__title">Fase de grupos</h2>
        {GROUP_LETTERS.filter((g) => tournament.groups[g]).map((g) => (
          <div className="adm-block" key={g}>
            <h3 className="adm-block__title">Grupo {g}</h3>
            {tournament.groupMatches.filter((m) => m.group === g).map((m) => (
              <GroupMatch
                key={m.id}
                match={m}
                teams={teams}
                cls={groupClass[m.id] ?? 'empty'}
                score={effective.groupMatches[m.id]}
                official={official.groupMatches?.[m.id]}
                local={draft.groupMatches?.[m.id]}
                onScore={setGroupScore}
                onClear={clearGroupScore}
                onUsarOficial={usarOficial}
                onConservarMio={conservarMio}
              />
            ))}
          </div>
        ))}
        {!allGroupsComplete && (
          <button type="button" className="btn btn-tertiary adm-testfill" onClick={testFillGroups}>
            ✨ Rellenar grupos al azar (para probar)
          </button>
        )}
      </section>

      {/* DESEMPATES */}
      {tiedGroups.length > 0 && (
        <section className="adm-section">
          <h2 className="adm-section__title">Desempates por definir</h2>
          {tiedGroups.map((t) => (
            <TiebreakControl key={t.groupCode} groupCode={t.groupCode} provisionalOrder={t.order} teams={teams}
              onSave={(order) => setGroupTiebreak(t.groupCode, order)} />
          ))}
        </section>
      )}

      {/* FASE ELIMINATORIA */}
      <section className="adm-section">
        <h2 className="adm-section__title">Fase eliminatoria</h2>
        {!allGroupsComplete ? (
          <p className="adm-muted">Completa los {tournament.groupMatches.length} partidos de grupos para que se arme la eliminatoria.</p>
        ) : tiedGroups.length > 0 ? (
          <p className="adm-muted">Resuelve los desempates de grupo de arriba para armar el cuadro.</p>
        ) : (
          KO_ROUNDS.map((r) => (
            <div className="adm-block" key={r.key}>
              <h3 className="adm-block__title">{r.label}</h3>
              {bracket[r.key].map((live) => (
                <KnockoutMatch
                  key={live.id}
                  live={live}
                  teams={teams}
                  cls={koClass[live.id] ?? 'empty'}
                  effEntry={effective.knockout[live.id]}
                  official={official.knockout?.[live.id]}
                  local={draft.knockout?.[live.id]}
                  onScore={setKnockoutScore}
                  onPens={setKnockoutPens}
                  onClear={clearKnockout}
                  onUsarOficial={usarOficial}
                  onConservarMio={conservarMio}
                />
              ))}
            </div>
          ))
        )}
      </section>

      {/* CAMPEON */}
      <section className="adm-section">
        <h2 className="adm-section__title">Campeón</h2>
        {bracket.champion ? (
          <div className="adm-champion">
            <span className="adm-flag" aria-hidden="true">{teams[bracket.champion]?.flag ?? '🏳'}</span>
            <strong>{teams[bracket.champion]?.name ?? bracket.champion}</strong>
            <span className="adm-muted"> (derivado de la final)</span>
          </div>
        ) : (
          <p className="adm-muted">Se definirá automáticamente al capturar la final.</p>
        )}
      </section>

      {/* Publicar a GitHub: escribe real-results.json directo a main (1 toque) */}
      <section className="adm-section adm-publish">
        <h2 className="adm-section__title">Publicar a GitHub</h2>
        <label className="adm-publish__label" htmlFor="adm-gh-token">Token de GitHub</label>
        <input
          id="adm-gh-token"
          type="password"
          className="adm-publish__input"
          value={ghToken}
          onChange={(e) => onTokenChange(e.target.value)}
          placeholder="github_pat_..."
          autoComplete="off"
        />
        <p className="adm-publish__hint">
          Se guarda solo en este dispositivo. Token fine-grained con Contents: Read and write sobre este repo.
        </p>
        <div className="adm-publish__row">
          <button type="button" className="btn btn-primary" onClick={publish} disabled={publishState.loading}>
            {publishState.loading ? 'Publicando…' : '🚀 Publicar a GitHub'}
          </button>
        </div>
        {publishState.ok && (
          <p className="adm-publish__ok">
            ✓ Publicado. El sitio se actualiza en 1 o 2 minutos.
            {publishState.commitUrl && (
              <> · <a href={publishState.commitUrl} target="_blank" rel="noreferrer">ver commit</a></>
            )}
          </p>
        )}
        {publishState.ok === false && publishState.error && (
          <p className="adm-publish__error">⚠ {publishState.error}</p>
        )}
      </section>

      <section className="adm-section adm-footer">
        <button type="button" className="btn btn-primary" onClick={download}>⬇ Descargar real-results.json</button>
        <button type="button" className="btn btn-secondary" onClick={copy}>Copiar al portapapeles</button>
        <button type="button" className="adm-link adm-danger" onClick={wipe}>Vaciar borrador</button>
      </section>
    </main>
  )
}
