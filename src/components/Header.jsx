// Barra superior del wizard. El header NO es identico en movil y desktop:
//   - Siempre visibles (movil y desktop): "Mi progreso" (el mapa de la
//     quiniela) y "Compartir" (exportar/mandar la quiniela). Son las dos mas
//     usadas.
//   - DESKTOP (>=700px): ademas mostramos directo en la barra "Importar",
//     "Editar datos", "Borrar fase" y "Empezar de nuevo".
//   - MOVIL (<700px): esas cuatro viven en un BOTTOM SHEET (hoja que sube
//     desde abajo, ancho completo, lista vertical grande y tappable). Asi la
//     barra angosta solo lleva 2 botones + "Más" y no se satura ni se corta.
// Reseteo dividido en DOS entradas: "Borrar fase" (arreglar una parte) y
// "Empezar de nuevo" (reinicio grande). Abajo, la barra de progreso.

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
  // El boton "Más" abre un menu con el resto de acciones. menuOpen controla su
  // visibilidad. El MISMO estado alimenta el bottom sheet (movil) y el
  // dropdown (desktop); CSS decide cual se ve segun el ancho.
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  // Ejecuta una accion del menu: PRIMERO cierra el menu y LUEGO dispara la
  // accion (abrir un modal/panel), para que no queden encimados.
  const runMenu = (fn) => () => {
    setMenuOpen(false)
    fn()
  }

  // Contenido del menu "Más", organizado en dos grupos. Es la MISMA data para
  // el sheet movil y el dropdown desktop. tone: 'normal' | 'warning' | 'danger'.
  const menuGroups = [
    {
      label: 'Tu quiniela',
      items: [
        {
          icon: '⬇',
          title: 'Importar quiniela',
          desc: 'Carga una quiniela guardada (archivo o texto).',
          tone: 'normal',
          onClick: onShowImport,
        },
        {
          icon: '✎',
          title: 'Editar mis datos',
          desc: 'Cambia tu nombre o correo.',
          tone: 'normal',
          onClick: onEditData,
        },
      ],
    },
    {
      label: 'Reiniciar',
      items: [
        {
          icon: '✂',
          title: 'Borrar fase',
          desc: 'Reinicia una etapa específica (grupos, octavos, etc.).',
          tone: 'warning',
          onClick: onShowResetPhase,
        },
        {
          icon: '↻',
          title: 'Empezar de nuevo',
          desc: 'Borra tu quiniela, o borra todo y vuelve al inicio.',
          tone: 'danger',
          onClick: onShowStartOver,
        },
      ],
    },
  ]

  // Render compartido de los grupos del menu (mismo en sheet y dropdown).
  const renderMenuGroups = () =>
    menuGroups.map((group) => (
      <div className="wiz-more-group" key={group.label}>
        <p className="wiz-more-grouplabel">{group.label}</p>
        {group.items.map((it) => (
          <button
            key={it.title}
            type="button"
            role="menuitem"
            className={`wiz-more-item is-${it.tone}`}
            onClick={runMenu(it.onClick)}
          >
            <span className="wiz-more-icon" aria-hidden="true">{it.icon}</span>
            <span className="wiz-more-text">
              <span className="wiz-more-title">{it.title}</span>
              <span className="wiz-more-desc">{it.desc}</span>
            </span>
          </button>
        ))}
      </div>
    ))

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
            {/* EXACTAMENTE 3 botones, iguales en movil y desktop. */}
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

            {/* "Más": en desktop abre un dropdown anclado aqui (a la derecha);
                en movil abre el bottom sheet de mas abajo. Mismo estado. */}
            <div className="wiz-more">
              <button
                type="button"
                className="btn btn-secondary wiz-more-trigger"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span aria-hidden="true">☰</span> Más
              </button>

              {/* Dropdown DESKTOP (CSS lo muestra solo en >=700px). */}
              {menuOpen && (
                <div className="wiz-more-dropdown-wrap">
                  <div
                    className="wiz-more-backdrop"
                    onClick={closeMenu}
                    role="presentation"
                  />
                  <div
                    className="wiz-more-dropdown"
                    role="menu"
                    aria-label="Más opciones"
                  >
                    {renderMenuGroups()}
                  </div>
                </div>
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

      {/* Bottom sheet MOVIL (CSS lo muestra solo en <700px). Hoja desde abajo,
          ancho completo; el overlay cierra al tocar fuera. Mismo contenido que
          el dropdown desktop. */}
      {menuOpen && (
        <div
          className="wiz-sheet-backdrop"
          onClick={closeMenu}
          role="presentation"
        >
          <div
            className="wiz-sheet"
            role="menu"
            aria-label="Más opciones"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wiz-sheet-handle" aria-hidden="true" />
            {renderMenuGroups()}
            <button
              type="button"
              className="btn btn-secondary wiz-sheet-close"
              onClick={closeMenu}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
