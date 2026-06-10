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
import { AdminPanel } from './pages/AdminPanel.jsx'
import { AdminGear } from './components/AdminGear.jsx'

export default function App() {
  const route = useHashRoute()

  // El panel de admin no lleva engrane (ya estas dentro).
  if (route === 'admin') return <AdminPanel />

  // Resto de rutas: la pagina + el engrane discreto de acceso al panel.
  let page
  if (route === '') page = <QuinielaApp />
  else if (route === 'torneos') page = <TournamentsIndex />
  // Cualquier otro segmento es el id de un torneo (#/familia, #/empresa, #/demo).
  // Si no existe, el propio Leaderboard muestra "Torneo no encontrado".
  else page = <Leaderboard tournamentId={route} />

  return (
    <>
      {page}
      <AdminGear />
    </>
  )
}
