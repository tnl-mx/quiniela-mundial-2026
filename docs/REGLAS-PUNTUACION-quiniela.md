# Reglas de puntuación de la quiniela

Estas reglas las implementa `src/logic/scoring.js` (función `scorePrediction`). El
sistema de puntos vive en `public/data/scoring.json` y es editable; aquí se
describen los valores por defecto entre paréntesis.

Principio general: **solo cuenta lo que YA tiene resultado real**. Los
partidos/grupos ausentes en `public/data/real-results.json` valen 0 (todavía no
se juegan), así el puntaje crece conforme avanza el Mundial. Nada truena por
datos incompletos: si falta algo, esa parte simplemente no suma.

El motor construye **dos brackets** con `buildBracket`: uno sobre la predicción
de la persona y otro sobre los resultados reales (que tienen la misma forma que
una predicción). Comparar ambos es la base de las capas de eliminatoria.

---

## A) Fase de grupos — cada partido

Por cada partido de grupo que ya tenga resultado real:

- **Marcador exacto** (`hs` y `as` iguales): `groupMatch.exactScore` (3). Ya
  incluye el resultado; no se suma `outcome` aparte.
- **Solo el resultado** (mismo ganador, o ambos empate): `groupMatch.outcome` (1).
- Ni el resultado: 0.

## B) Fase de grupos — tabla de cada grupo

Solo se evalúan los grupos cuyos **6 partidos** ya tengan resultado real.

- **Clasifica (1.º o 2.º)** — `groupTable.advances` (2): por cada equipo que la
  persona predijo en el top 2 del grupo y que en la realidad quedó en el top 2.
  Se evalúa **grupo por grupo** en cuanto ese grupo esté completo (funciona
  desde temprano en el torneo).
- **Posición exacta** — `groupTable.exactPosition` (3): por cada posición
  (1.º/2.º/3.º/4.º) cuyo equipo predicho coincide con el real.
- **Clasifica como mejor tercero** — `groupTable.advances` (2): por cada equipo
  que la persona predijo que clasificaba como tercero y que realmente clasificó
  como tercero.
  - **Importante:** esta sub-parte se activa **solo cuando los 12 grupos están
    completos** (los 72 partidos de grupos con resultado real). Razón: saber qué
    terceros clasifican requiere rankear los 12 terceros entre sí (cálculo
    cross-grupo), imposible hasta cerrar toda la fase de grupos. Mientras la fase
    no esté completa, estos puntos valen 0; no se descartan, solo se activan
    cuando ya es posible calcularlos (que es justo cuando importan).

La posición predicha usa la tabla del grupo + los desempates manuales del
usuario (`groupTiebreaks`); la real usa la tabla real.

## C) Eliminatoria — avance (capa independiente, por EQUIPO)

Para cada ronda (R32→octavos, octavos→cuartos, cuartos→semis, semis→final): por
cada equipo que la persona predijo que avanzaba de esa ronda **y** que en la
realidad avanzó de esa ronda (sin importar contra quién ni en qué llave), se
suma el punto de `knockoutAdvance` según la **ronda destino**:

- `r16` = 1, `qf` = 2, `sf` = 3, `final` = 4.

«La persona predijo que un equipo avanza de la ronda X» = en su bracket ese
equipo es **ganador de su llave** de esa ronda. «En la realidad avanzó» = en
los resultados reales ese equipo ganó su llave real de esa ronda. **Se compara
por equipo, no por llave.**

## D) Eliminatoria — marcador (capa independiente), solo si el cruce existió

Un cruce «existió» si el par de equipos `{home, away}` que la persona predijo en
una llave es el mismo par que jugó realmente en **alguna** llave real de esa
**misma ronda**, aunque estén invertidos local/visitante (se compara como
conjunto de 2 equipos).

Si el cruce existió, se evalúa el marcador del tiempo regular como en grupos:

- **Marcador exacto**: `knockoutMatch.exactScore` (3, ya incluye resultado).
- **Solo el resultado**: `knockoutMatch.outcome` (1).

Los goles se comparan **por equipo** (no por posición home/away), para respetar
la inversión local/visitante.

**Penales** (solo si el partido real se fue a penales):

- Si la persona predijo que ese cruce iba a penales: `penalties.wentToPens` (1).
- Si además acertó el marcador exacto de penales (cuidando la inversión):
  `penalties.exactPens` (2).

## E) Multiplicador ×2

En un partido eliminatorio que en la realidad **se fue a penales**, si la
persona acertó **todo**: el cruce existió + marcador regular exacto + predijo
que iba a penales + marcador exacto de penales, entonces **todos** los puntos de
ese partido (avance del equipo que ganó + marcador regular + penales) se
multiplican por `penaltiesMultiplier` (2).

El multiplicador **no** aplica si el partido real no fue a penales. En el
desglose, la copia extra de esos puntos se reporta como `multiplierBonus` (la
base ya está contada en sus categorías, para que el total no haga doble conteo).

## F) Campeón

Si la persona acertó el campeón real: `champion` (5). Este punto se cuenta
**aparte y NUNCA entra al multiplicador**, aunque la final haya sido a penales.

---

## Forma del resultado de `scorePrediction`

```js
{
  total,                         // suma de todo el breakdown
  breakdown: {
    groupMatches,                // capa A
    groupTable,                  // capa B (clasifica + posición + terceros)
    knockoutAdvance,             // capa C
    knockoutMatch,               // capa D (marcador regular)
    penalties,                   // capa D (penales)
    multiplierBonus,             // capa E (copia extra de los puntos duplicados)
    champion,                    // capa F (aparte)
  },
  items: [                       // detalle línea por línea, para la UI
    { category, matchId, label, points, detail },
  ],
}
```
