// Modal "Rellenar al azar — ¿hasta dónde?". Pregunta hasta qué fase rellenar
// la quiniela y confirma con el conteo. El relleno respeta lo ya capturado y
// las dependencias (se ejecuta fase por fase en orden).
//
// options: [{ target, label, count }]   (count = partidos que se rellenarán
//           hasta esa fase, acumulado). Una opcion con count 0 ya está
//           completa y se deshabilita.

import { useState } from 'react'

export function FillUntilModal({ options, onConfirm, onCancel }) {
  // Seleccion por defecto: la primera opcion con algo que rellenar; si todas
  // estan en 0, la ultima (Todo).
  const firstEnabled =
    options.find((o) => o.count > 0)?.target ??
    options[options.length - 1]?.target
  const [target, setTarget] = useState(firstEnabled)

  const selected = options.find((o) => o.target === target)
  const canConfirm = !!selected && selected.count > 0

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fill-until-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="fill-until-title" className="modal-title">
            Rellenar al azar
          </h2>
        </header>

        <div className="modal-body">
          <p>¿Hasta qué fase quieres rellenar?</p>

          <fieldset className="modal-fieldset">
            {options.map((opt) => {
              const disabled = opt.count === 0
              return (
                <label
                  key={opt.target}
                  className={`modal-radio ${disabled ? 'is-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="fill-until"
                    value={opt.target}
                    checked={target === opt.target}
                    disabled={disabled}
                    onChange={() => setTarget(opt.target)}
                  />
                  <span>
                    <strong>{opt.label}.</strong>{' '}
                    {disabled ? (
                      <em className="modal-radio-note">Ya está completo</em>
                    ) : (
                      <>
                        {opt.count} partido{opt.count === 1 ? '' : 's'} por
                        rellenar.
                      </>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>

          {/* Conteo dinamico de la opcion elegida. */}
          {canConfirm && (
            <div className="reset-warning" role="status">
              <p className="reset-warning-title">
                Se rellenarán {selected.count} partido
                {selected.count === 1 ? '' : 's'} al azar hasta{' '}
                {selected.label}.
              </p>
              <ul className="reset-warning-list">
                <li>Respeta lo que ya capturaste (no lo cambia).</li>
                <li>Marcadores realistas y penales en los empates.</li>
                <li>Puedes editar todo después.</li>
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
            className="btn btn-primary"
            onClick={() => onConfirm(target)}
            disabled={!canConfirm}
          >
            Sí, rellenar
          </button>
        </div>
      </div>
    </div>
  )
}
