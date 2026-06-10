// Pantalla de CORONACION: cierre celebratorio del torneo. Aparece cuando la
// final (M104) esta resuelta y hay campeon.
//
// Fuente de verdad: buildBracket.
//   - Campeon:    bracket.champion
//   - Subcampeon: perdedor de la final (final.loser)
//   - Finalistas: los dos equipos de la final (final.home / final.away)
//   - Tercer lugar: ganador de M103 si se capturo; si se salto, nota discreta.
//
// Despues de celebrar, mostramos las INSTRUCCIONES DE COMPARTIR (copiar /
// descargar) reutilizando el hook useSharePrediction (misma logica que la
// pantalla de Compartir). El confeti es puro CSS (sin librerias) y respeta
// prefers-reduced-motion via los keyframes en Wizard.css.

import { useSharePrediction } from './useSharePrediction.js'

const CONFETTI_PIECES = 20

export function Coronation({
  bracket,
  teams,
  prediction,
  missingCount = 0,
  onEditData,
  onBackToIndex,
  onReview,
}) {
  // El hook debe llamarse SIEMPRE (reglas de hooks), antes de cualquier
  // return temprano.
  const { copied, copy, download } = useSharePrediction(prediction)

  const final = bracket?.final?.[0]
  const championCode = bracket?.champion ?? null
  if (!final || !championCode) return null

  const champion = teams[championCode]
  const runnerUpCode = final.loser ?? null
  const runnerUp = runnerUpCode ? teams[runnerUpCode] : null

  // Los dos finalistas (home/away de la final). El campeon es uno de ellos.
  const finalistA = final.home ? teams[final.home] : null
  const finalistB = final.away ? teams[final.away] : null

  // Tercer lugar: solo si el usuario capturo y resolvio M103.
  const thirdMatch = bracket?.third?.[0]
  const thirdWinnerCode =
    thirdMatch && thirdMatch.status === 'decided' ? thirdMatch.winner : null
  const thirdWinner = thirdWinnerCode ? teams[thirdWinnerCode] : null

  // Avisos suaves antes de invitar a compartir.
  const hasName = !!prediction?.meta?.firstName
  const showWarn = missingCount > 0 || !hasName

  return (
    <section className="coronation" aria-labelledby="coronation-title">
      {/* Confeti decorativo (no interactivo). Dos "capas" para que se sienta
          mas el momento; se desactiva con prefers-reduced-motion. */}
      <div className="coronation-confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI_PIECES }).map((_, i) => (
          <span key={i} className={`confetti-piece confetti-piece-${i % 7}`} />
        ))}
      </div>

      <header className="coronation-header">
        <p className="coronation-eyebrow">Mundial 2026 · Campeón</p>
        <div className="coronation-trophy" aria-hidden="true">🏆</div>
      </header>

      {/* Campeon en grande */}
      <div className="coronation-champion">
        <span className="coronation-champion-flag" aria-hidden="true">
          {champion.flag}
        </span>
        <h2 id="coronation-title" className="coronation-champion-name">
          {champion.name}
        </h2>
        <p className="coronation-champion-label">Campeón del Mundo</p>
      </div>

      {/* Subcampeon */}
      {runnerUp && (
        <div className="coronation-runnerup">
          <span className="coronation-runnerup-label">Subcampeón</span>
          <span className="coronation-runnerup-team">
            <span aria-hidden="true">{runnerUp.flag}</span> {runnerUp.name}
          </span>
        </div>
      )}

      {/* Mencion de los dos finalistas */}
      {finalistA && finalistB && (
        <div className="coronation-finalists">
          <p className="coronation-section-label">La gran final</p>
          <p className="coronation-finalists-teams">
            <span aria-hidden="true">{finalistA.flag}</span> {finalistA.name}
            <span className="coronation-finalists-vs"> vs </span>
            <span aria-hidden="true">{finalistB.flag}</span> {finalistB.name}
          </p>
        </div>
      )}

      {/* Tercer lugar (opcional) */}
      <div className="coronation-third">
        <p className="coronation-section-label">Tercer lugar</p>
        {thirdWinner ? (
          <p className="coronation-third-team">
            <span aria-hidden="true">{thirdWinner.flag}</span> {thirdWinner.name}
          </p>
        ) : (
          <p className="coronation-third-empty">
            No capturaste el partido por el tercer lugar.
          </p>
        )}
      </div>

      {/* ---- Instrucciones de compartir ---- */}
      <div className="coronation-share">
        <h3 className="coronation-share-title">¡Tu quiniela está lista! 🎉</h3>

        {showWarn && (
          <div className="coronation-share-warn" role="alert">
            {missingCount > 0 && (
              <p>
                ⚠ Te faltan <strong>{missingCount}</strong> partido
                {missingCount === 1 ? '' : 's'} por capturar. Puedes compartir
                igual, pero tu quiniela está incompleta.
              </p>
            )}
            {!hasName && (
              <p>
                Te falta poner tu nombre para identificar la quiniela.{' '}
                <button
                  type="button"
                  className="btn btn-tertiary coronation-share-editlink"
                  onClick={onEditData}
                >
                  Editar mis datos
                </button>
              </p>
            )}
          </div>
        )}

        <p className="coronation-share-text">
          Para participar, comparte tu quiniela:
        </p>

        <div className="coronation-share-actions">
          <button type="button" className="btn btn-primary" onClick={copy}>
            {copied ? '¡Copiado!' : '⧉ Copiar mi quiniela'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={download}>
            ⬇ Descargar archivo
          </button>
        </div>

        <p className="coronation-share-hint">
          Copia tu quiniela y pégala en WhatsApp, o descarga el archivo y
          envíala.
        </p>
      </div>

      <div className="coronation-nav">
        <button type="button" className="btn btn-secondary" onClick={onReview}>
          Revisar la quiniela
        </button>
        <button type="button" className="btn btn-secondary" onClick={onBackToIndex}>
          Volver al índice
        </button>
      </div>
    </section>
  )
}
