import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base condicional segun el MODE de Vite:
//   - dev (npm run dev):           mode 'development' -> base '/'  (localhost
//     normal, en la raiz).
//   - build y preview y Pages:     mode 'production'  -> base
//     '/quiniela-mundial-2026/'  (la app se sirve desde esa SUBCARPETA en
//     https://tnl-mx.github.io/quiniela-mundial-2026/).
//
// OJO: usamos `mode`, NO `command`. `vite preview` corre con command 'serve'
// (igual que dev), asi que discriminar por command dejaria el preview en base
// '/' y no coincidiria con el build (saldria en blanco). `mode` es
// 'production' tanto en build como en preview, asi que el preview simula bien
// produccion.
//
// Con este base, Vite reescribe automaticamente las rutas de index.html y de
// los assets (JS/CSS). La carga de datos de public/data ya respeta este base
// via import.meta.env.BASE_URL en src/data/loaders.js.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/quiniela-mundial-2026/' : '/',
}))
