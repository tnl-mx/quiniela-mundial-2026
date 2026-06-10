// Pantalla de IMPORTAR una quiniela desde un JSON. Dos vias: cargar un
// archivo .json o pegar el texto. Antes de cargar, validacion defensiva con
// parseAndValidate (JSON valido + estructura del schema v1 + coherencia
// razonable con el torneo).
//
// Importar SOBRESCRIBE la quiniela actual, asi que es un flujo de dos pasos:
//   1) Validar (boton "Revisar / Importar" o al cargar el archivo).
//   2) Confirmar explicitamente el reemplazo (boton rojo).

import { useState } from 'react'
import { parseAndValidate } from '../logic/predictionIO.js'

export function ImportPanel({ dataset, onImport, onBackToIndex }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null) // { ok, error?, prediction?, warnings? }
  const [confirming, setConfirming] = useState(false)

  const runValidation = (raw) => {
    setConfirming(false)
    const r = parseAndValidate(raw, {
      tournament: dataset.tournament,
      teams: dataset.teams,
    })
    setResult(r)
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      setText(content)
      runValidation(content)
    }
    reader.onerror = () => {
      setResult({ ok: false, error: 'No se pudo leer el archivo.' })
    }
    reader.readAsText(file)
    // Permite volver a elegir el MISMO archivo despues (resetea el input).
    e.target.value = ''
  }

  const handleValidateText = () => {
    if (text.trim() === '') {
      setResult({ ok: false, error: 'Pega el contenido del JSON primero.' })
      return
    }
    runValidation(text)
  }

  const handleConfirmImport = () => {
    if (result?.ok) onImport(result.prediction)
  }

  const meta = result?.ok ? result.prediction.meta : null
  const fullName = meta
    ? [meta.firstName, meta.lastName].filter(Boolean).join(' ')
    : ''

  return (
    <section className="io-panel" aria-labelledby="import-title">
      <header className="io-panel-header">
        <p className="io-panel-eyebrow">Reconstruir</p>
        <h2 id="import-title" className="io-panel-title">
          Importar una quiniela
        </h2>
        <p className="io-panel-sub">
          Carga un archivo <code>.json</code> exportado, o pega su contenido.
        </p>
      </header>

      {/* Via A: archivo */}
      <div className="io-import-file">
        <label className="btn btn-secondary io-file-label">
          📂 Elegir archivo .json
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="io-file-input"
          />
        </label>
      </div>

      {/* Via B: pegar texto */}
      <div className="io-import-paste">
        <label className="welcome-label" htmlFor="import-textarea">
          …o pega el JSON aquí
        </label>
        <textarea
          id="import-textarea"
          className="io-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "meta": { "schemaVersion": 1, ... }, ... }'
          rows={10}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleValidateText}
        >
          Revisar / Importar
        </button>
      </div>

      {/* Resultado de la validacion */}
      {result && !result.ok && (
        <div className="io-status is-error" role="alert">
          ✕ {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="io-import-ready">
          <div className="io-status is-complete">
            ✓ JSON válido
            {fullName && (
              <>
                {' '}— quiniela de <strong>{fullName}</strong>
              </>
            )}
            .
          </div>

          {result.warnings?.length > 0 && (
            <div className="io-status is-warning" role="alert">
              <p className="io-warning-title">
                Avisos (puedes importar igual):
              </p>
              <ul className="io-warning-list">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Confirmacion explicita del reemplazo */}
          {!confirming ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirming(true)}
            >
              Cargar esta quiniela
            </button>
          ) : (
            <div className="io-confirm">
              <p className="io-confirm-text">
                <strong>Esto reemplazará tu quiniela actual.</strong> Lo que
                tengas ahora capturado se perderá. ¿Continuar?
              </p>
              <div className="io-confirm-nav">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirming(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmImport}
                >
                  Sí, reemplazar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="io-panel-nav">
        <button type="button" className="btn btn-secondary" onClick={onBackToIndex}>
          Volver al índice
        </button>
      </div>
    </section>
  )
}
