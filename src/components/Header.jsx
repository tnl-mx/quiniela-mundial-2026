// Barra superior del wizard. Enfoque hibrido, priorizando MOVIL:
//   - Siempre visibles (las 2 acciones mas usadas): "Mi progreso" (el mapa de
//     la quiniela) y "Compartir" (la pantalla de exportar/mandar la quiniela).
//   - En DESKTOP (>=900px) hay espacio, asi que ademas mostramos directo:
//     "Importar", "Editar datos", "Borrar fase" y "Empezar de nuevo".
//   - En MOVIL/tablet (<900px) esas opciones viven en un menu desplegable "⋯"
//     bien etiquetado y tappable, para no saturar la barra angosta.
// Reseteo dividido en DOS entradas visibles: "Borrar fase" (arreglar una
// parte) y "Empezar de nuevo" (reinicio grande), no escondidas en una sola.
// Abajo, la barra de progreso (grupos X/72 o bracket X/32).

import { useState } from 'react'

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L']

function roundFromMatchId(matchId) {
  const n = Number.parseInt(matchId.slice(1), 10)
  if (n >= 73 && n <= 88) return 'Ronda de 32'
  if (n >= 89 && n <= 96) return 'Octavos'
  if (n >= 97 && n <= 100) return 'Cuartos'
  if (n >= 101 && n <= 102) return 'Semifinales'
  if (n === 103) return 'Tercer lugar'
  if (n === 104) return 'Final'
  return ''
}

export function Header({
  capturedMatches,
  totalMatches,
  bracketDecidedCount = 0,
  currentGroup,
  currentMatchIndex,
  currentBracketMatchId,
  groupsComplete,
  onShowIndex,
  onShowResetPhase,
  onShowStartOver,
  onShowExport,
  onShowImport,
  onEditData,
}) {
  const inBracketView = !!currentBracketMatchId
  const [menuOpen, setMenuOpen] = useState(false)

  // Ejecuta una accion del menu y lo cierra.
  const runMenu = (fn) => () => {
    setMenuOpen(false)
    fn()
  }

  let stepText = ''
  if (currentGroup) {
    const groupNumber = GROUP_LETTERS.indexOf(currentGroup) + 1
    stepText = `Grupo ${groupNumber} de 12`
    if (currentMatchIndex != null) {
      stepText += ` · Partido ${currentMatchIndex + 1} de 6`
    }
  } else if (inBracketView) {
    stepText = `${roundFromMatchId(currentBracketMatchId)} · ${currentBracketMatchId}`
  } else if (groupsComplete) {
    stepText = 'Fase eliminatoria'
  } else {
    stepText = 'Fase de grupos'
  }

  // Phase de la barra: bracket cuando el usuario esta en el bracket O ya
  // termino los grupos (esta en index o bridge).
  const showBracketBar = inBracketView || groupsComplete
  const total = showBracketBar ? 32 : totalMatches
  const captured = showBracketBar ? bracketDecidedCount : capturedMatches
  const phaseUnit = showBracketBar ? 'llaves' : 'partidos'
  const pct = total > 0 ? (captured / total) * 100 : 0

  return (
    <header className="wiz-header">
      <div className="wiz-header-inner">
        <div className="wiz-header-top">
          <div className="wiz-header-title-group">
            <h1 className="wiz-header-title">Quiniela Mundial 2026</h1>
            <p className="wiz-header-save-note">
              Tu avance se guarda en este dispositivo.
            </p>
          </div>
          <div className="wiz-header-actions">
            {/* Siempre visibles: las 2 acciones mas usadas. */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onShowIndex}
            >
              Mi progreso
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onShowExport}
            >
              Compartir
            </button>

            {/* Solo DESKTOP: opciones directas (hay espacio de sobra). */}
            <button
              type="button"
              className="btn btn-secondary wiz-action-desktop"
              onClick={onShowImport}
            >
              Importar
            </button>
            <button
              type="button"
              className="btn btn-secondary wiz-action-desktop"
              onClick={onEditData}
            >
              Editar datos
            </button>
            <button
              type="button"
              className="btn btn-secondary wiz-action-desktop"
              onClick={onShowResetPhase}
            >
              Borrar fase
            </button>
            <button
              type="button"
              className="btn btn-secondary wiz-action-desktop"
              onClick={onShowStartOver}
            >
              Empezar de nuevo
            </button>

            {/* Solo MOVIL/tablet: menu desplegable con el resto, bien
                etiquetado y con objetivos grandes para tocar. */}
            <div className="wiz-menu wiz-menu-mobile">
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Más opciones"
                title="Más opciones"
              >
                ⋯
              </button>

              {menuOpen && (
                <>
                  {/* Capa para cerrar al tocar fuera. */}
                  <div
                    className="wiz-menu-backdrop"
                    onClick={() => setMenuOpen(false)}
                    role="presentation"
                  />
                  <div className="wiz-menu-panel" role="menu">
                    <button
                      type="button"
                      className="wiz-menu-item"
                      role="menuitem"
                      onClick={runMenu(onShowImport)}
                    >
                      ⬇ Importar quiniela
                    </button>
                    <button
                      type="button"
                      className="wiz-menu-item"
                      role="menuitem"
                      onClick={runMenu(onEditData)}
                    >
                      ✎ Editar mis datos
                    </button>
                    <div className="wiz-menu-sep" role="separator" />
                    <button
                      type="button"
                      className="wiz-menu-item"
                      role="menuitem"
                      onClick={runMenu(onShowResetPhase)}
                    >
                      ✂ Borrar fase
                    </button>
                    <button
                      type="button"
                      className="wiz-menu-item is-danger"
                      role="menuitem"
                      onClick={runMenu(onShowStartOver)}
                    >
                      ↻ Empezar de nuevo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="wiz-header-progress">
          <div className="wiz-header-progress-label">
            <span className="wiz-header-progress-step">{stepText}</span>
            <span className="wiz-header-progress-meta">
              {captured} / {total} {phaseUnit}
            </span>
          </div>
          <div className="wiz-header-progress-track" aria-hidden="true">
            <div
              className="wiz-header-progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
