# Cómo subir una quiniela nueva (rápido)

Guía para agregar la quiniela de una persona a un torneo. El índice se
**regenera solo** en cada deploy, así que no editas `index.json` a mano.

## 1. Elige la carpeta del torneo correcto

Cada torneo tiene su carpeta dentro de `public/data/predictions/`:

| Torneo            | Carpeta                          |
| ----------------- | -------------------------------- |
| Quiniela Familiar | `public/data/predictions/familia/` |
| Quiniela Empresa  | `public/data/predictions/empresa/` |

(La lista de torneos vive en `public/data/tournaments.json`.)

## 2. Guarda el archivo JSON

- Nombre **limpio**, sin acentos ni espacios, en minúsculas, terminado en `.json`.
  Ej.: `gabriela-neme.json`, `tufic-neme.json`.
- El contenido sigue el esquema v1 (ver `docs/ESQUEMA-prediccion-v1.md`): debe
  traer al menos `meta` (con `firstName` y `lastName`), `groupMatches`, y lo que
  haya capturado de `knockout`/`champion`.

## 3. Valida que el JSON es correcto

```bash
python3 -m json.tool public/data/predictions/familia/gabriela-neme.json > /dev/null && echo "JSON válido ✅"
```

Si imprime un error, el archivo tiene un problema de formato (coma de más,
comillas, etc.); arréglalo antes de continuar.

## 4. (Opcional) Verlo en local antes de subir

```bash
npm run indice   # regenera los index.json de todas las carpetas
npm run dev      # abre http://localhost:5173/  -> #/familia
```

## 5. Sube a producción (commit + push)

```bash
git add public/data/predictions/familia/gabriela-neme.json
git commit -m "Agrega quiniela de Gabriela (familia)"
git push
```

El workflow de GitHub Actions corre `npm run indice` y `npm run build`
automáticamente: el índice se regenera y la quiniela aparece en el leaderboard
del torneo en un par de minutos. **No toques `index.json` a mano.**

---

## Registrar resultados reales del Mundial

Los resultados son **compartidos** por todos los torneos. Cuando se juegue un
partido, edita `public/data/real-results.json` con el marcador real (mismo
formato que una predicción) y haz commit/push. El leaderboard recalcula solo.

- Partido de grupo: `"groupMatches": { "A1": { "hs": 2, "as": 1 } }`
- Eliminatoria: `"knockout": { "M73": { "home": "MEX", "away": "KOR", "hs": 1, "as": 1, "pens": { "went": true, "hs": 4, "as": 3 } } }`
- Campeón: `"champion": "ARG"`

Solo agrega lo que YA se jugó; lo demás se queda como "por jugar".
