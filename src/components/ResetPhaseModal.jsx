// Modal "Borrar fase": reinicia una ETAPA concreta de la quiniela. Conserva
// el nombre del participante y respeta el encadenamiento del torneo (borrar
// una fase borra las posteriores, regla "desde aqui hacia adelante").
//
// Confirmacion de DOS pasos: elegir opcion + confirmar ("Sí, borrar"). Cada
// opcion dice POR ESCRITO exactamente que se va a borrar.
//
// Casos especiales: "solo la Final" (M104 + campeon) y "solo el Tercer lugar"
// (M103) NO arrastran cascada, porque ninguno alimenta a otra llave.

import { useState } from 'react'

// Opciones por fase.
//   - scope: valor que se envia a onReset (lo enruta el Wizard a resetFromPhase).
//   - needsKnockout: si true, se deshabilita cuando aun no hay eliminatoria.
const PHASE_OPTIONS = [
  {
    scope: 'groups',
    title: 'Reiniciar la fase de grupos',
    desc: 'Como los grupos definen el resto, esto borra toda la quiniela (conserva tu nombre).',
    affects: ['Fase de grupos', 'Toda la fase eliminatoria'],
    needsKnockout: false,
  },
  {
    scope: 'knockout',
    title: 'Reiniciar toda la fase eliminatoria',
    desc: 'Deja tus grupos intactos.',
    affects: [
      'Ronda de 32', 'Octavos', 'Cuartos', 'Semifinales',
      'Tercer lugar', 'Final (y campeón)',
    ],
    needsKnockout: true,
  },
  {
    scope: 'r16',
    title: 'Reiniciar desde Octavos',
    desc: 'Deja grupos y Ronda de 32 intactos.',
    affects: [
      'Octavos', 'Cuartos', 'Semifinales',
      'Tercer lugar', 'Final (y campeón)',
    ],
    needsKnockout: true,
  },
  {
    scope: 'qf',
    title: 'Reiniciar desde Cuartos',
    desc: 'Deja grupos, Ronda de 32 y Octavos intactos.',
    affects: ['Cuartos', 'Semifinales', 'Tercer lugar', 'Final (y campeón)'],
    needsKnockout: true,
  },
  {
    scope: 'sf',
    title: 'Reiniciar desde Semifinales',
    desc: 'Deja grupos y rondas previas intactos.',
    affects: ['Semifinales', 'Tercer lugar', 'Final (y campeón)'],
    needsKnockout: true,
  },
  {
    scope: 'final',
    title: 'Reiniciar solo la Final',
    desc: 'Caso especial: no arrastra nada más.',
    affects: ['Final (y campeón)'],
    needsKnockout: true,
  },
  {
    scope: 'third',
    title: 'Reiniciar solo el Tercer lugar',
    desc: 'Caso especial: M103 no alimenta a nadie, no toca la Final.',
    affects: ['Tercer lugar'],
    needsKnockout: true,
  },
]

export function ResetPhaseModal({
  capturedMatches,
  tiebreaksCount,
  knockoutCount = 0,
  onReset,
  onCancel,
}) {
  const [scope, setScope] = useState('groups')
  const hasKnockout = knockoutCount > 0
  const selected = PHASE_OPTIONS.find((o) => o.scope === scope)

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-phase-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="reset-phase-title" className="modal-title">
            Borrar una fase
          </h2>
        </header>

        <div className="modal-body">
          <p>
            Tienes <strong>{capturedMatches} partidos</strong> de grupos
            capturados
            {tiebreaksCount > 0 && (
              <>
                {' '}y <strong>{tiebreaksCount} desempate{tiebreaksCount === 1 ? '' : 's'} manual{tiebreaksCount === 1 ? '' : 'es'}</strong>
              </>
            )}
            {hasKnockout && (
              <>
                {' '}y <strong>{knockoutCount} llave{knockoutCount === 1 ? '' : 's'} de eliminatoria</strong>
              </>
            )}
            .
          </p>

          <p className="reset-group-hint">
            Borra una etapa concreta. Tu nombre y las fases anteriores se
            conservan.
          </p>

          <fieldset className="modal-fieldset">
            {PHASE_OPTIONS.map((opt) => {
              const disabled = opt.needsKnockout && !hasKnockout
              return (
                <label
                  key={opt.scope}
                  className={`modal-radio ${disabled ? 'is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="reset-phase-scope"
                    value={opt.scope}
                    checked={scope === opt.scope}
                    disabled={disabled}
                    onChange={() => setScope(opt.scope)}
                  />
                  <span>
                    <strong>{opt.title}.</strong> {opt.desc}
                    {disabled && (
                      <em className="modal-radio-note">
                        {' '}(aún no hay eliminatoria capturada)
                      </em>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>

          {/* Aviso por escrito de exactamente que se va a borrar. */}
          {selected && (
            <div className="reset-warning" role="alert">
              <p className="reset-warning-title">Esto borrará:</p>
              <ul className="reset-warning-list">
                {selected.affects.map((fase) => (
                  <li key={fase}>{fase}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-nav">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onReset(scope)}
          >
            Sí, borrar
          </button>
        </div>
      </div>
    </div>
  )
}
