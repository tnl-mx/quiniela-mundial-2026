// ============================================================================
// GRAFICA DE EVOLUCION del leaderboard (por torneo), en SVG ligero (sin libs).
//
// Eje X: bloques de 4 partidos, DINAMICO (solo hasta el ultimo match jugado).
// Eje Y: puntos acumulados. Una linea por participante. Para cada bloque hasta
// el match N se recorta real-results (cropRealResults) y se corre el motor
// scorePrediction; NO se reimplementa el calculo.
//
// Identificacion: iniciales del top 5 (por puntaje actual) en su ultimo punto,
// y tooltip (hover/tap) con nombre completo + puntos para CUALQUIER linea.
// ============================================================================

import './EvolutionChart.css'
import { useMemo, useState } from 'react'
import { scorePrediction } from '../logic/scoring.js'
import { cropRealResults, maxPlayedMatch, blockEndpoints } from '../logic/matchOrder.js'

// Paleta de colores distinguibles (se repiten con muchas quinielas; el tooltip
// es el identificador definitivo, como acordamos).
const PALETTE = [
  '#0E7A4F', '#E5006D', '#2563EB', '#F59E0B', '#7C3AED', '#0891B2',
  '#DC2626', '#15803D', '#DB2777', '#CA8A04', '#4F46E5', '#0D9488',
]

// Lienzo en coordenadas internas; el SVG se escala con viewBox (responsive).
const W = 800
const H = 360
const PAD = { top: 16, right: 18, bottom: 30, left: 38 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

function initials(name) {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function EvolutionChart({ rows, realResults, tournament, teams, annexCOptions, scoring }) {
  const [hover, setHover] = useState(null) // { si, pi }

  // Series memoizadas: solo recalcula si cambian resultados o quinielas.
  const { series, endpoints, yMax } = useMemo(() => {
    const maxPlayed = maxPlayedMatch(realResults)
    const ends = blockEndpoints(maxPlayed)
    if (ends.length === 0 || rows.length === 0) {
      return { series: [], endpoints: [], yMax: 1 }
    }
    const s = rows.map((row) => ({
      file: row.file,
      name: row.name,
      points: ends.map((n) => {
        const cropped = cropRealResults(realResults, n)
        const total = scorePrediction({
          prediction: row.prediction,
          realResults: cropped,
          tournament,
          teams,
          annexCOptions,
          scoring,
        }).total
        return { n, total }
      }),
    }))
    const max = Math.max(1, ...s.flatMap((row) => row.points.map((p) => p.total)))
    return { series: s, endpoints: ends, yMax: max }
  }, [rows, realResults, tournament, teams, annexCOptions, scoring])

  // Sin resultados todavia: no dibujamos una grafica vacia.
  if (endpoints.length === 0) {
    return (
      <section className="ev-empty">
        <h2 className="ev-title">Evolución</h2>
        <p className="ev-empty__msg">La gráfica aparecerá cuando haya resultados.</p>
      </section>
    )
  }

  const x = (i) =>
    PAD.left + (endpoints.length === 1 ? PLOT_W / 2 : (i / (endpoints.length - 1)) * PLOT_W)
  const y = (total) => PAD.top + (1 - total / yMax) * PLOT_H

  // Top 5 por puntaje actual (rows ya viene ordenado desc): para las iniciales.
  const top5 = new Set(rows.slice(0, 5).map((r) => r.file))

  // Lineas horizontales de referencia (0, mitad, max).
  const yTicks = [0, Math.round(yMax / 2), yMax]

  const hovered = hover ? series[hover.si]?.points[hover.pi] : null
  const hoveredName = hover ? series[hover.si]?.name : null

  return (
    <section className="ev">
      <h2 className="ev-title">Evolución de puntos</h2>
      <p className="ev-sub">Por bloques de 4 partidos · toca una línea para ver de quién es</p>

      <div className="ev-wrap">
        <svg
          className="ev-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Gráfica de evolución de puntos por participante"
          onClick={(e) => { if (e.target.tagName === 'svg') setHover(null) }}
        >
          {/* Rejilla + etiquetas Y */}
          {yTicks.map((t) => (
            <g key={t}>
              <line className="ev-grid" x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} />
              <text className="ev-axis" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">{t}</text>
            </g>
          ))}

          {/* Etiquetas X (numero de match de cada bloque) */}
          {endpoints.map((n, i) => (
            <text key={n} className="ev-axis" x={x(i)} y={H - PAD.bottom + 16} textAnchor="middle">{n}</text>
          ))}

          {/* Lineas por participante */}
          {series.map((row, si) => {
            const color = PALETTE[si % PALETTE.length]
            const pts = row.points.map((p, i) => `${x(i)},${y(p.total)}`).join(' ')
            const dimmed = hover && hover.si !== si
            return (
              <g key={row.file} className={dimmed ? 'ev-dim' : ''}>
                {endpoints.length > 1 && (
                  <polyline className="ev-line" points={pts} stroke={color} />
                )}
                {/* Captura de hover sobre la linea (trazo grueso invisible) */}
                {endpoints.length > 1 && (
                  <polyline
                    className="ev-hit"
                    points={pts}
                    onMouseEnter={() => setHover({ si, pi: row.points.length - 1 })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setHover({ si, pi: row.points.length - 1 })}
                  />
                )}
                {row.points.map((p, pi) => (
                  <circle
                    key={pi}
                    className="ev-dot"
                    cx={x(pi)}
                    cy={y(p.total)}
                    r={hover && hover.si === si && hover.pi === pi ? 5 : 3}
                    fill={color}
                    onMouseEnter={() => setHover({ si, pi })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setHover({ si, pi })}
                  />
                ))}
                {/* Iniciales del top 5 en su ultimo punto */}
                {top5.has(row.file) && (
                  <text
                    className="ev-initials"
                    x={x(row.points.length - 1) + 7}
                    y={y(row.points[row.points.length - 1].total) + 3}
                    fill={color}
                  >
                    {initials(row.name)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="ev-tip"
            style={{
              left: `${(x(hover.pi) / W) * 100}%`,
              top: `${(y(hovered.total) / H) * 100}%`,
            }}
          >
            <strong>{hoveredName}</strong>
            <span>tras match {hovered.n}: {hovered.total} pts</span>
          </div>
        )}
      </div>
    </section>
  )
}
