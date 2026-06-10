// Detecta si el marcador guardado de una llave eliminatoria quedo "stale":
// es decir, se capturo para CIERTOS equipos pero el cuadro se recalculo (por
// editar resultados de grupos) y ahora esa llave la juegan OTROS equipos.
//
// En ese caso el marcador viejo NO debe darse por bueno (ni mostrarse como
// confirmado, ni exportarse al archivo oficial) hasta que el organizador lo
// vuelva a confirmar con los equipos nuevos.
//
// `stored`   = lo guardado en el borrador: { home, away, hs, as, pens? } | undefined
// `liveMatch`= la llave del bracket vivo (buildBracket): { home, away, ... }

export function isStaleKnockout(stored, liveMatch) {
  if (!stored || !stored.home || !stored.away) return false // no capturada
  if (!liveMatch || !liveMatch.home || !liveMatch.away) return false
  return stored.home !== liveMatch.home || stored.away !== liveMatch.away
}
