// Modal de confirmacion para los distintos alcances de relleno al azar.
// Siempre pide confirmacion con el conteo de cuanto se va a rellenar.
//
//   scope === 'group'   -> rellenar lo que falta del grupo actual
//   scope === 'groups'  -> rellenar la fase de grupos completa (12 grupos)
//   scope === 'round'   -> rellenar una ronda de knockout (R32, Octavos, ...)
//   scope === 'all'     -> rellenar TODO lo que falta (grupos + eliminatoria)
//
// Para 'round' se reciben `roundLabel` (ej. "Octavos") y `count`.

export function RandomFillModal({
  scope,
  group,
  roundLabel,
  count,
  groupCount = 0,
  bracketCount = 0,
  onConfirm,
  onCancel,
}) {
  let title
  if (scope === 'group') title = `Rellenar el Grupo ${group} al azar`
  else if (scope === 'groups') title = 'Rellenar la fase de grupos al azar'
  else if (scope === 'round') title = `Rellenar ${roundLabel} al azar`
  else title = 'Rellenar al azar todo lo que falta'

  return (
    <div className="modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fill-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="fill-title" className="modal-title">{title}</h2>
        </header>

        <div className="modal-body">
          {scope === 'group' && (
            <p>
              Se rellenarán los{' '}
              <strong>
                {count} partido{count === 1 ? '' : 's'} restantes
              </strong>{' '}
              del Grupo {group} con marcadores aleatorios. Los partidos ya
              capturados <strong>no cambian</strong>.
            </p>
          )}

          {scope === 'groups' && (
            <p>
              Se rellenarán los{' '}
              <strong>
                {count} partido{count === 1 ? '' : 's'} de grupos pendientes
              </strong>{' '}
              con marcadores aleatorios, sin tocar la fase eliminatoria. Lo que
              ya tengas capturado <strong>no cambia</strong>.
            </p>
          )}

          {scope === 'round' && (
            <p>
              Se rellenarán las{' '}
              <strong>
                {count} llave{count === 1 ? '' : 's'} de {roundLabel}
              </strong>{' '}
              (con penales en los empates). Solo esta ronda; las demás no se
              tocan. Lo que ya tengas capturado <strong>no cambia</strong>.
            </p>
          )}

          {scope === 'all' && (
            <>
              <p>Se rellenarán al azar:</p>
              <ul className="modal-bullets">
                {groupCount > 0 && (
                  <li>
                    <strong>{groupCount}</strong> partido
                    {groupCount === 1 ? '' : 's'} de grupos pendientes.
                  </li>
                )}
                {bracketCount > 0 && (
                  <li>
                    <strong>{bracketCount}</strong> llave
                    {bracketCount === 1 ? '' : 's'} de la fase eliminatoria
                    (incluyendo penales en empates).
                  </li>
                )}
              </ul>
              <p>
                Los partidos y llaves que ya tengas capturados{' '}
                <strong>no cambian</strong>.
              </p>
            </>
          )}

          <p>
            La distribución de goles está sesgada a marcadores realistas
            (sobre todo 0–2 goles por equipo). Los penales producen tandas
            tipo 4–3, 5–4, sin empates. Si algún grupo queda con empate
            exacto, se ordena automáticamente por ranking FIFA. Puedes editar
            todo después.
          </p>
        </div>

        <div className="modal-nav">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Sí, rellenar
          </button>
        </div>
      </div>
    </div>
  )
}
