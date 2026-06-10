// Pantalla de EXPORTAR la quiniela. Genera el JSON completo (schema v1) y
// ofrece dos vias: descargar un .json o copiar el texto al portapapeles
// (comodo para pegar en WhatsApp desde el movil). El JSON se puede ver en un
// area de texto opcional.
//
// El export refleja EXACTAMENTE el estado actual, incluida la fotografia
// home/away de cada llave del bracket (eso lo garantiza serializePrediction).

import { useState } from 'react'
import { useSharePrediction } from './useSharePrediction.js'

export function ExportPanel({
  prediction,
  missingCount = 0,
  onEditData,
  onBackToIndex,
}) {
  // Logica de compartir (JSON + copiar + descargar) reutilizada del hook.
  const { jsonString, fileName, copied, copy, download } =
    useSharePrediction(prediction)

  const [showJson, setShowJson] = useState(false)

  const meta = prediction.meta ?? {}
  const fullName = [meta.firstName, meta.lastName].filter(Boolean).join(' ')

  return (
    <section className="io-panel" aria-labelledby="export-title">
      <header className="io-panel-header">
        <p className="io-panel-eyebrow">Compartir</p>
        <h2 id="export-title" className="io-panel-title">
          Compartir mi quiniela
        </h2>
        <p className="io-panel-sub">
          {fullName ? <>Quiniela de <strong>{fullName}</strong>{' '}</> : null}
          <button
            type="button"
            className="btn btn-tertiary io-edit-link"
            onClick={onEditData}
          >
            Editar mis datos
          </button>
        </p>
      </header>

      {/* Aviso de completitud (informativo, no bloquea). */}
      <div
        className={`io-status ${missingCount > 0 ? 'is-incomplete' : 'is-complete'}`}
      >
        {missingCount > 0 ? (
          <>
            ⚠ Te faltan <strong>{missingCount}</strong> partido
            {missingCount === 1 ? '' : 's'} por capturar. Puedes exportar igual,
            pero tu quiniela está incompleta.
          </>
        ) : (
          <>✓ Tu quiniela está completa.</>
        )}
      </div>

      {/* Acciones principales. */}
      <div className="io-actions">
        <button type="button" className="btn btn-primary" onClick={download}>
          ⬇ Descargar archivo
        </button>
        <button type="button" className="btn btn-secondary" onClick={copy}>
          {copied ? '¡Copiado!' : '⧉ Copiar al portapapeles'}
        </button>
      </div>

      <p className="io-filename">
        Se descargará como <code>{fileName}</code>
      </p>

      {/* JSON opcional para ver/copiar manual. */}
      <button
        type="button"
        className="btn btn-tertiary io-toggle-json"
        onClick={() => setShowJson((s) => !s)}
      >
        {showJson ? 'Ocultar JSON' : 'Ver JSON'}
      </button>

      {showJson && (
        <textarea
          className="io-textarea"
          readOnly
          value={jsonString}
          rows={12}
          onFocus={(e) => e.target.select()}
        />
      )}

      <div className="io-panel-nav">
        <button type="button" className="btn btn-secondary" onClick={onBackToIndex}>
          Volver al índice
        </button>
      </div>
    </section>
  )
}
