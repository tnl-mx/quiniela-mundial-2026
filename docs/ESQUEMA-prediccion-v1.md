# Esquema oficial del JSON de prediccion - Quiniela Mundial 2026
## schemaVersion 1 (contrato, no cambiar a la ligera)

Este es el formato en que cada participante exporta su quiniela. Una vez que la
gente exporte con este formato, cambiarlo rompe los archivos ya enviados. Por eso
incluye schemaVersion: si en fase 2 cambia algo, se sube el numero y se migra.

```json
{
  "meta": {
    "firstName": "Ana",
    "lastName": "Lopez",
    "email": "ana@ejemplo.com",       // opcional, util para base de datos futura
    "entry": 1,                        // numero de quiniela de esa persona (1, 2, ...)
    "schemaVersion": 1,
    "exportedAt": "2026-06-08T12:00:00Z",
    "tournament": "FIFA World Cup 2026"
  },

  "groupMatches": {
    "A1": { "hs": 2, "as": 1 },
    "A2": { "hs": 0, "as": 0 }
    // ... los 72 partidos de grupos por su id
  },

  "groupTiebreaks": {
    // SOLO presente cuando hubo empate exacto que el usuario resolvio a mano.
    // Llave = letra de grupo, valor = orden final de codigos de equipo (1o a 4o).
    "A": ["MEX", "KOR", "CZE", "RSA"]
  },

  "thirdPlaceTiebreaks": [
    // SOLO presente si hubo empate exacto entre terceros que el usuario resolvio.
    // Orden final de codigos de equipo entre los terceros empatados.
  ],

  "knockout": {
    // Cada llave por su match number oficial FIFA (M73..M104).
    // home/away son los codigos de equipo concretos que el usuario hizo avanzar.
    "M73": {
      "home": "MEX",
      "away": "KOR",
      "hs": 1,
      "as": 1,
      "pens": { "went": true, "hs": 4, "as": 3 }   // pens solo si hubo empate en eliminatoria
    }
    // ... hasta M104 (la final)
  },

  "champion": "MEX",

  // --- Reservado para FASE 2 (apartado desde ya, vacio por ahora) ---
  "awards": {
    "goldenBall": null,     // mejor jugador
    "goldenBoot": null,     // maximo goleador
    "goldenGlove": null,    // mejor portero
    "youngPlayer": null,    // mejor joven
    "fairPlay": null        // premio fair play (equipo)
  },

  "wildcards": {}           // categorias propias, fase 2
}
```

## Notas de diseno
- schemaVersion permite migrar formatos sin romper archivos viejos.
- groupTiebreaks y thirdPlaceTiebreaks guardan las decisiones manuales del usuario
  en empates exactos. Sin esto, al reimportar el empate reapareceria sin resolver.
- knockout usa match numbers oficiales (cuadro 12.6 FIFA) para hablar el mismo
  idioma que las reglas reales.
- home/away se guardan concretos ("fotografia" del bracket) en vez de recalcular,
  por robustez. El resultado es identico porque todo sigue reglas oficiales.
- awards y wildcards se reservan vacios ahora para que los archivos de fase 1 ya
  tengan el espacio cuando llegue fase 2.
