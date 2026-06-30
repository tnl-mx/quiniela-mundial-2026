# CLAUDE.md

Contexto y reglas del proyecto para Claude Code. Este archivo se lee solo al
iniciar cualquier sesion (local o en la nube). La parte mas importante es el
protocolo para ACTUALIZAR RESULTADOS OFICIALES desde un mensaje corto.

## Que es este proyecto

App de quinielas del Mundial 2026 (React + Vite), desplegada en GitHub Pages.
El leaderboard puntua cada quiniela contra los resultados reales que viven en un
solo archivo: `public/data/real-results.json`. Cada push a `main` dispara el
GitHub Action que redespliega el sitio.

## TAREA PRINCIPAL: actualizar un resultado oficial

Cuando reciba un mensaje del tipo "Catar vs Suiza quedo 1-0" o
"Mexico le gano 2-0 a Corea", debo:

1. Identificar los dos equipos y convertir sus nombres a su codigo de 3 letras
   usando `public/data/teams.json` (los nombres ahi estan en espanol: QAT=Catar,
   SUI=Suiza, MEX=Mexico, etc.).
2. Localizar el partido:
   - Fase de grupos: buscar en `public/data/tournament.json`, dentro de
     `groupMatches`, la entrada cuyo par `{home, away}` coincida con esos dos
     equipos. Usar su `id` (formato letra de grupo + numero, p. ej. `B2`).
   - Eliminatoria: los ids van de `M73` a `M104`.
3. Asignar el marcador SEGUN home/away del fixture, NO segun el orden en que se
   escribio el mensaje. `hs` = goles del equipo LOCAL (home), `as` = goles del
   VISITANTE (away). Ejemplo: el fixture B2 es home=QAT, away=SUI. Si el mensaje
   dice "Suiza 0 Catar 1", igual debo escribir `{"hs": 1, "as": 0}` porque Catar
   es el local.
4. Editar UNICAMENTE `public/data/real-results.json`. Conservar todas las
   entradas existentes y solo agregar o actualizar la del partido en cuestion.
   Ademas, fijar el campo de nivel superior `"lastMatchId"` al id del partido que
   acabo de capturar (p. ej. `"lastMatchId": "M74"`): el front lo usa para
   resaltar "el resultado mas reciente", y NO se puede inferir por el orden de
   las claves (se guardan ordenadas). JSON valido, indentacion de 2 espacios,
   salto de linea final.
5. Hacer commit a `main` y push. NO correr el dev server ni el build. NO tocar
   ningun otro archivo, en especial nada bajo `.github/workflows/` (en sesiones
   en la nube ese tipo de cambio se rechaza y no es necesario aqui).
6. Responder confirmando exactamente lo que escribi: id del partido, equipos y
   marcador, para que sea facil de verificar.

## Esquema exacto de real-results.json

```json
{
  "groupMatches": {
    "A1": { "hs": 2, "as": 1 }
  },
  "knockout": {
    "M73": {
      "home": "MEX",
      "away": "KOR",
      "hs": 1,
      "as": 1,
      "pens": { "went": true, "hs": 4, "as": 3 }
    }
  },
  "champion": null,
  "awards": {},
  "lastMatchId": "M73"
}
```

Reglas del esquema:

- `groupMatches`: objeto con clave = id del partido de grupo (`A1`...`L6`) y
  valor `{ "hs": <local>, "as": <visitante> }`. Es lo unico que se necesita para
  un partido de grupo.
- `knockout`: clave = id (`M73`...`M104`). El valor incluye `home` y `away` (los
  codigos de los equipos que REALMENTE jugaron esa llave), `hs`/`as` del tiempo
  reglamentario, y `pens` SOLO si se fue a penales (en ese caso `hs` == `as` en
  reglamentario y `pens` lleva `{ "went": true, "hs": <pen local>, "as": <pen
  visitante> }`).
- `champion`: codigo del campeon, solo despues de la final (`M104`). Antes va
  `null`.
- `awards`: normalmente `{}`.
- `lastMatchId`: id del ultimo partido capturado/actualizado (`A1`...`L6` o
  `M73`...`M104`). Sirve para resaltar el resultado mas reciente; ponlo siempre
  que agregues o cambies un marcador, con el id de ESE partido.
- `groupTiebreaks` (opcional): objeto con clave = letra de grupo y valor = arreglo
  de 4 codigos en el orden final del grupo. Solo hace falta si un grupo termina
  empatado y el orden no se resuelve solo. No lo agregues a menos que sea
  necesario.

## Si algo es ambiguo

Si no queda claro a que partido se refiere (dos equipos que se enfrentan en mas
de una fase, dudas de penales, o no encuentro el fixture), preguntar antes de
commitear en vez de adivinar.

## Mensaje de commit sugerido

`Resultado: <Local> <hs>-<as> <Visitante> (<id>)`
Ejemplo: `Resultado: Catar 1-0 Suiza (B2)`
