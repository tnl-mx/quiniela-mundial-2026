// Pantalla de bienvenida (solo la PRIMERA vez, cuando aun no hay nombre).
// Pide datos minimos del participante para identificar la quiniela. Es ligera
// a proposito: nombre, apellido y correo (opcional). Una persona = una sola
// quiniela.
//
// Validacion suave: nombre y apellido razonablemente requeridos; el correo
// es opcional y solo se valida su formato basico si el usuario lo escribe.

import { useState } from 'react'

// Regex deliberadamente simple: "algo@algo.algo". No pretende ser exhaustiva.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Welcome({ onStart }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)

  const firstOk = firstName.trim().length > 0
  const lastOk = lastName.trim().length > 0
  const emailOk = email.trim() === '' || EMAIL_RE.test(email.trim())
  const canSubmit = firstOk && lastOk && emailOk

  const handleSubmit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (!canSubmit) return
    onStart({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    })
  }

  return (
    <main className="welcome-screen">
      <div className="welcome-card">
        <header className="welcome-card-header">
          <p className="welcome-eyebrow">Quiniela Mundial 2026</p>
          <h1 className="welcome-title">¡Bienvenido!</h1>
          <p className="welcome-sub">
            Cuéntanos quién eres para identificar tu quiniela. Solo toma un
            momento.
          </p>
        </header>

        <form className="welcome-form" onSubmit={handleSubmit} noValidate>
          <label className="welcome-field">
            <span className="welcome-label">Nombre</span>
            <input
              type="text"
              className="welcome-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ana"
              autoComplete="given-name"
              autoFocus
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
              placeholder="López"
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
              placeholder="ana@ejemplo.com"
              autoComplete="email"
            />
            {touched && !emailOk && (
              <span className="welcome-error">
                Revisa el formato del correo.
              </span>
            )}
          </label>

          <button type="submit" className="btn btn-primary welcome-submit">
            Empezar mi quiniela <span aria-hidden="true">→</span>
          </button>
        </form>

        <p className="welcome-note">
          Tus datos se guardan solo en este dispositivo. Podrás editarlos
          después.
        </p>
      </div>
    </main>
  )
}
