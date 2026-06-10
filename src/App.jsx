// ROUTER de la app (ruteo por hash, robusto en GitHub Pages).
//
//   raiz  (sin hash)  -> QuinielaApp  (la app que llena cada participante)
//   #/torneos         -> TournamentsIndex (lista de torneos activos)
//   #/familia, #/...   -> Leaderboard del torneo correspondiente
//
// El base path /quiniela-mundial-2026/ no afecta al hash, asi que los enlaces
// tipo .../#/familia funcionan igual en local y en Pages.

import { useHashRoute } from './data/useHashRoute.js'
import { QuinielaApp } from './pages/QuinielaApp.jsx'
import { TournamentsIndex } from './pages/TournamentsIndex.jsx'
import { Leaderboard } from './pages/Leaderboard.jsx'

export default function App() {
  const route = useHashRoute()

  if (route === '') return <QuinielaApp />
  if (route === 'torneos') return <TournamentsIndex />

  // Cualquier otro segmento es el id de un torneo (#/familia, #/empresa, #/demo).
  // Si no existe, el propio Leaderboard muestra "Torneo no encontrado".
  return <Leaderboard tournamentId={route} />
}
