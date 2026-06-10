# Features acordadas para el WIZARD (no para el prototipo visual)

Estas dos features NO van en el prototipo de estilo. Van en el wizard real,
que es el paso siguiente. Anotadas para no perderlas.

## 1. Navegacion libre para editar sin perder el lugar
- Ademas del flujo guiado (siguiente/anterior), una vista de indice o mapa
  (ej. rejilla de los 12 grupos con palomita en los completados) desde donde
  el usuario salta a cualquier grupo o partido ya llenado, lo corrige, y
  vuelve a donde estaba.
- El wizard guia a quien quiere ser guiado, pero no encierra.

## 2. Reseteo (a ceros / default)
- Resetear TODO a ceros: opcion global.
- Resetear POR FASES, respetando el encadenamiento:
  - Las fases dependen unas de otras: el bracket depende de los clasificados
    de grupos, etc.
  - Regla: se puede resetear desde cualquier ronda HACIA ADELANTE, nunca dejar
    hueco en medio. Resetear una ronda intermedia borra TODO lo posterior.
  - Ejemplos: resetear grupos -> borra todo. Resetear desde octavos -> borra
    octavos, cuartos, semis, final, tercer lugar (pero deja grupos y R32).
- IMPORTANTE: al resetear una fase que obliga a borrar las siguientes, AVISAR
  claramente y por escrito que fases se borraran, y pedir CONFIRMACION explicita
  antes de ejecutar. Nada se borra sin que el usuario sepa que pierde.
- El motor de src/logic/ ya entiende fases encadenadas (rondas faltantes quedan
  "pending"), asi que esta feature encaja natural.

## 3. Guardado automatico (localStorage)
- Guardar avance en el navegador mientras se llena, para retomar donde se quedo.
- Aclaracion de alcance: es por dispositivo+navegador. La portabilidad entre
  dispositivos la da el export/import de JSON, no el localStorage.
