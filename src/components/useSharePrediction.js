// Hook reutilizable para COMPARTIR la quiniela: genera el JSON (schema v1) y
// expone copiar-al-portapapeles y descargar-archivo. Lo usan tanto la
// pantalla de Compartir (ExportPanel) como la coronacion, para no duplicar la
// logica de portapapeles/descarga.

import { useMemo, useState } from 'react'
import {
  predictionToJsonString,
  suggestedFileName,
} from '../logic/predictionIO.js'

export function useSharePrediction(prediction) {
  // Stampamos exportedAt al generar. new Date() aqui es correcto: estamos en
  // runtime de navegador, no en logica pura.
  const jsonString = useMemo(
    () =>
      predictionToJsonString(prediction, {
        exportedAt: new Date().toISOString(),
      }),
    [prediction],
  )

  const fileName = suggestedFileName(prediction.meta)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      // Via moderna (requiere contexto seguro: https o localhost).
      await navigator.clipboard.writeText(jsonString)
    } catch {
      // Fallback: textarea temporal + execCommand.
      const ta = document.createElement('textarea')
      ta.value = jsonString
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* sin portapapeles disponible; el usuario puede copiar manual */
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const download = () => {
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return { jsonString, fileName, copied, copy, download }
}
