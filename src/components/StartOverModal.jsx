// Modal "Empezar de nuevo": el reinicio grande, con dos opciones de distinta
// severidad. Confirmacion de DOS pasos (elegir + confirmar) y aviso por
// escrito de exactamente que pasa.
//
//   'blank' (media)  -> "Mi quiniela en blanco": borra TODAS las predicciones
//                       pero CONSERVA tu nombre. No vuelve a la bienvenida.
//   'wipe'  (danger) -> "Borrar todo": borra absolutamente todo, incluido tu
//                       nombre. Vuelve a la pantalla de inicio. Es la mas
//                       destructiva: va AL FINAL y con color de alerta.

import { useState } from 'react'

export function StartOverModal({ onStartOver, onCancel }) {
  const [kind, setKind] = useState('blank')

  const options = [
    {
      kind: 'blank',
      severity: 'medium',
      title: 'Mi quiniela en blanco',
      desc: 'Borra todas tus predicciones (grupos y eliminatoria) pero conserva tu nombre. Empiezas de cero, sigues siendo tú.',
      warnTitle: 'Esto hará:',
      affects: [
        'Conserva tu nombre, apellido y correo',
        'Borra todas las predicciones (grupos y eliminatoria)',
      ],
      confirmLabel: 'Sí, dejar en blanco',
      confirmClass: 'btn-primary',
    },
    {
      kind: 'wipe',
      severity: 'danger',
      title: 'Borrar todo',
      desc: 'Borra absolutamente todo, incluidos tus datos personales. Volverás a la pantalla de inicio (como la primera vez). Útil si otra persona va a usar este dispositivo.',
      warnTitle: 'Esto borrará:',
      affects: [
        'Toda tu quiniela (grupos y eliminatoria)',
        'Tus datos personales (nombre, apellido, correo)',
        'Volverás a la pantalla de inicio',
      ],
      confirmLabel: 'Sí, borrar todo',
      confirmClass: 'btn-danger',
    },
  ]

  const selected = options.find((o) => o.kind === kind)

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-over-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="start-over-title" className="modal-title">
            Empezar de nuevo
          </h2>
        </header>

        <div className="modal-body">
          <p className="reset-group-hint">
            ¿Cómo quieres empezar de nuevo?
          </p>

          <fieldset className="modal-fieldset">
            {options.map((opt) => (
              <label
                key={opt.kind}
                className={`modal-radio is-${opt.severity}`}
              >
                <input
                  type="radio"
                  name="start-over-kind"
                  value={opt.kind}
                  checked={kind === opt.kind}
                  onChange={() => setKind(opt.kind)}
                />
                <span>
                  <strong>{opt.title}.</strong> {opt.desc}
                </span>
              </label>
            ))}
          </fieldset>

          {/* Aviso por escrito de exactamente que pasara. */}
          {selected && (
            <div
              className={`reset-warning ${
                selected.severity === 'danger' ? 'is-danger' : ''
              }`}
              role="alert"
            >
              <p className="reset-warning-title">{selected.warnTitle}</p>
              <ul className="reset-warning-list">
                {selected.affects.map((item) => (
                  <li key={item}>{item}</li>
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
            className={`btn ${selected?.confirmClass ?? 'btn-danger'}`}
            onClick={() => onStartOver(kind)}
          >
            {selected?.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
