import { useEffect, useState } from 'react'
import { loadTeams, loadTournament, loadAnnexCOptions } from './loaders.js'

// Hook que carga TODOS los datos estaticos del torneo una sola vez al inicio.
// Devuelve { teams, tournament, annexCOptions, loading, error }.
// El componente raiz decide que mostrar mientras loading=true o si error existe.
//
// Cargamos tambien annex_C_combinations.csv aunque por ahora el wizard solo
// usa fase de grupos: asi cuando llegue el bracket no tenemos que rehacer
// la capa de datos.
export function useDataset() {
  const [state, setState] = useState({
    teams: null,
    tournament: null,
    annexCOptions: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    Promise.all([loadTeams(), loadTournament(), loadAnnexCOptions()])
      .then(([teams, tournament, annexCOptions]) => {
        if (cancelled) return
        setState({
          teams,
          tournament,
          annexCOptions,
          loading: false,
          error: null,
        })
      })
      .catch((error) => {
        if (cancelled) return
        setState((s) => ({ ...s, loading: false, error }))
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
