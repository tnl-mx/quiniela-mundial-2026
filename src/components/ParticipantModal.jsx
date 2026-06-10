// Modal para EDITAR los datos del participante despues de la bienvenida (por
// si alguien se equivoco al inicio). Mismos campos que la bienvenida: nombre,
// apellido y correo (opcional).
//
// Reutiliza la estetica de modales (.modal-*). Validacion suave igual que en
// la bienvenida: nombre/apellido requeridos, correo opcional con formato.

import { useState } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ParticipantModal({ meta, onSave, onCancel }) {
  const [firstName, setFirstName] = useState(meta?.firstName ?? '')
  const [lastName, setLastName] = useState(meta?.lastName ?? '')
  const [email, setEmail] = useState(meta?.email ?? '')
  const [touched, setTouched] = useState(false)

  const firstOk = firstName.trim().length > 0
  const lastOk = lastName.trim().length > 0
  const emailOk = email.trim() === '' || EMAIL_RE.test(email.trim())
  const canSave = firstOk && lastOk && emailOk

  const handleSave = () => {
    setTouched(true)
    if (!canSave) return
    onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    })
  }

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="participant-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="participant-title" className="modal-title">
            Mis datos
          </h2>
        </header>

        <div className="modal-body">
          <div className="welcome-form">
            <label className="welcome-field">
              <span className="welcome-label">Nombre</span>
              <input
                type="text"
                className="welcome-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
              />
              {touched && !firstOk && (
                <span className="welcome-error">Escribe tu nombre.</span>
              )}
            </label>

            <label className="welcome-field">
              <span className="welcome-label">Apellido</span>
              <input
                type="text"
                className="welcome-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
              {touched && !lastOk && (
                <span className="welcome-error">Escribe tu apellido.</span>
              )}
            </label>

            <label className="welcome-field">
              <span className="welcome-label">
                Correo <span className="welcome-optional">(opcional)</span>
              </span>
              <input
                type="email"
                className="welcome-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {touched && !emailOk && (
                <span className="welcome-error">
                  Revisa el formato del correo.
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="modal-nav">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
