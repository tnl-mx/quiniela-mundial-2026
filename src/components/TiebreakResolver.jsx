// Pantalla para que el usuario decida manualmente el orden de los equipos
// cuando el grupo termina con un empate exacto que el motor NO puede
// resolver automaticamente.
//
// Mostramos los 4 equipos en su orden actual (provisional segun ranking
// FIFA si el usuario aun no ha resuelto). El usuario los reordena con
// botones ▲/▼. Al guardar se persiste la lista completa en
// groupTiebreaks[grupo] = [codigoT1, codigoT2, codigoT3, codigoT4].

import { useEffect, useState } from 'react'

export function TiebreakResolver({ group, table, teams, onSave, onCancel }) {
  // Orden inicial = el provisional que viene en la tabla.
  const [order, setOrder] = useState(() => table.map((r) => r.code))

  // Si la tabla cambia (por edicion de marcador desde otra vista), volvemos
  // a sincronizar el orden local con el provisional nuevo.
  useEffect(() => {
    setOrder(table.map((r) => r.code))
  }, [table])

  // Conjunto de codigos que estan empatados con al menos otro equipo en
  // los 3 criterios (puntos, GD, GF). Lo usamos para marcar las filas
  // empatadas con un chip.
  const tiedCodes = new Set(table.filter((r) => r.tied).map((r) => r.code))

  const moveUp = (idx) => {
    if (idx === 0) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }

  const moveDown = (idx) => {
    if (idx === order.length - 1) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }

  return (
    <section className="tiebreak">
      <header className="tiebreak-header">
        <p className="tiebreak-eyebrow">Empate por resolver</p>
        <h2 className="tiebreak-title">
          Define el orden del Grupo {group}
        </h2>
        <p className="tiebreak-sub">
          Hay un empate exacto en puntos, diferencia de goles y goles a favor.
          El motor no puede decidir solo. Ordena los equipos como prefieras
          (los marcados <strong>Empate</strong> son los que estan empatados
          entre si) y guarda para continuar.
        </p>
      </header>

      <ol className="tiebreak-list">
        {order.map((code, idx) => {
          const team = teams[code]
          const isTied = tiedCodes.has(code)
          const isQualifies = idx < 2
          return (
            <li
              key={code}
              className={[
                'tiebreak-row',
                isTied ? 'is-tied' : '',
                isQualifies ? 'is-qualifies' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="tiebreak-pos">{idx + 1}</span>
              <span className="tiebreak-flag" aria-hidden="true">{team.flag}</span>
              <span className="tiebreak-name">{team.name}</span>
              {isTied ? (
                <span className="tiebreak-tied-tag">Empate</span>
              ) : (
                <span />
              )}
              <div className="tiebreak-actions">
                <button
                  type="button"
                  className="tiebreak-arrow"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  aria-label={`Subir ${team.name}`}
                >▲</button>
                <button
                  type="button"
                  className="tiebreak-arrow"
                  onClick={() => moveDown(idx)}
                  disabled={idx === order.length - 1}
                  aria-label={`Bajar ${team.name}`}
                >▼</button>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="tiebreak-nav">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Volver
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSave(order)}
        >
          Guardar orden
        </button>
      </div>
    </section>
  )
}
