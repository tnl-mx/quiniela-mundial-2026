import { Wizard } from './pages/Wizard.jsx'
import { Welcome } from './components/Welcome.jsx'
import { useDataset } from './data/useDataset.js'
import { usePrediction } from './state/usePrediction.js'

export default function App() {
  const dataset = useDataset()
  const predictionApi = usePrediction()

  if (dataset.loading) {
    return (
      <main className="app-loading">
        <p>Cargando datos del torneo…</p>
      </main>
    )
  }

  if (dataset.error) {
    return (
      <main className="app-error">
        <p>
          No se pudieron cargar los datos del torneo.<br />
          {dataset.error.message}
        </p>
      </main>
    )
  }

  // Gate de bienvenida: solo la PRIMERA vez (cuando aun no hay nombre). Si el
  // usuario ya entro antes (o importo una quiniela), meta.firstName existe y
  // pasamos directo al Wizard donde se quedo.
  const hasParticipant = !!predictionApi.prediction.meta?.firstName
  if (!hasParticipant) {
    return <Welcome onStart={(meta) => predictionApi.setMeta(meta)} />
  }

  return <Wizard dataset={dataset} predictionApi={predictionApi} />
}
