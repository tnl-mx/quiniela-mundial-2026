import { useEffect, useState } from 'react'

// Ruteo por HASH (robusto en GitHub Pages: no necesita servidor ni truco de
// 404, y es inmune al base path /quiniela-mundial-2026/).
//
// Devuelve el "segmento" del hash, normalizado:
//   ""              (raiz, sin hash)      -> app de quiniela
//   "#/familia"     -> "familia"
//   "#/torneos"     -> "torneos"
//   "#/"            -> ""
//
// Escucha 'hashchange' para re-renderizar cuando cambia la URL.
function readHash() {
  // Quita el "#", la "/" inicial opcional, y nos quedamos con el primer tramo.
  return window.location.hash.replace(/^#\/?/, '').split('/')[0].trim()
}

export function useHashRoute() {
  const [route, setRoute] = useState(readHash)

  useEffect(() => {
    const onChange = () => setRoute(readHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}
