# SPEC 03 — Power pellets y fantasmas comestibles

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-11-10
> **Objetivo:** Añadir los cuatro power pellets clásicos que asustan a los fantasmas —azules, lentos y comestibles durante 6 s— con la cadena de puntos 200/400/800/1600, los ojos volviendo a la pen y una pausa con popup al comerlos.

## Por qué existe esta spec

Hoy tocar un fantasma siempre resta vida: el jugador no tiene contraataque. Las SPEC 01 y SPEC 02 dejaron explícitamente fuera "power pellets y cualquier estado comestible o de ojos". Esta spec añade ese contrapeso completo en una sola pieza: pellets, modo asustado, comer fantasmas, ojos y respawn.

## Alcance

**In:**

- Cuatro power pellets en las esquinas clásicas: filas 3 y 23, columnas 1 y 26.
- Código de celda `4` (`'o'` en `MAZE_STR`), contado en `dotsRemaining` y comestible por 50 puntos.
- Modo asustado global de 360 frames (6 s a 60 fps): fantasmas azules, invierten el sentido al comerse el pellet, giro aleatorio en cruces y velocidad `0.025`.
- Parpadeo azul/blanco en los últimos 120 frames del efecto.
- Comer fantasmas: cadena 200/400/800/1600 que se reinicia con cada pellet.
- Fantasma comido = ojos: vuelve a la pen a `0.1`, atraviesa a Pac-Man sin colisión y revive en su celda de salida.
- Pausa de ~45 frames con popup de puntos al comer un fantasma.
- Comer otro pellet reinicia el temporizador y la cadena.
- Perder una vida limpia el efecto y la cadena.
- Actualizar el comentario de códigos de `src/js/maze.js` y las notas de velocidad de `AGENTS.md`.

**Fuera del alcance (para futuras specs):**

- Sonido.
- Duración decreciente del efecto por pellet o por nivel (no hay niveles).
- Fases scatter/chase con temporizador.
- Fantasmas asustados que huyan de Pac-Man con inteligencia.
- HUD con el tiempo restante del efecto.
- Persistencia de récords, tests, build o gestor de paquetes.
- Cambios en la geometría del laberinto (más allá de los 4 caracteres), el canvas o el CSS.

## Modelo de datos

`src/js/maze.js` cambia cuatro caracteres y `parseTile()` aprende uno nuevo:

```js
// fila 3:  '#o####.#####.##.#####.####o#'  (cols 1 y 26)
// fila 23: '#o..##................##..o#'  (cols 1 y 26)
function parseTile(ch) {
  if (ch === "#") return 1;
  if (ch === ".") return 2;
  if (ch === "o") return 4; // power pellet
  if (ch === "-") return 3;
  return 0;
}
```

`src/js/game.js` gana cuatro constantes; `createGame()` pasa a contar `2` y `4`:

```js
const FRIGHT_FRAMES = 360; // 6 s a 60 fps
const FRIGHT_SPEED = 0.025; // 1/40 celda/frame -> alinea cada 40 frames
const EYES_SPEED = 0.1; // 1/10 celda/frame -> alinea cada 10 frames
const GHOST_POINTS = [200, 400, 800, 1600];
```

Estado nuevo en `game` y un campo nuevo por fantasma:

```js
// game
frightFrames: 0, // frames restantes del efecto; > 0 = fantasmas asustados
eatChain: 0,     // fantasmas comidos con el pellet actual (indice en GHOST_POINTS)
freezeFrames: 0, // pausa al comer un fantasma
popups: [],      // { x, y, text } puntos mostrados durante la pausa

// cada fantasma
mode: 'normal',  // 'normal' | 'eyes'
```

Un fantasma está asustado si `game.frightFrames > 0 && g.mode === 'normal'`; no se guarda un booleano por fantasma. Los ojos nunca se asustan. Al llegar a su celda de `GHOST_STARTS`, `mode` vuelve a `'normal'` y `dir` a `'up'`, aunque quede efecto activo: revive sin susto, como en el arcade.

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda, igual que el resto del juego.
- Las velocidades nuevas son `1/n` (`1/40` y `1/10`), así que la alineación de `aligned()` se mantiene.
- `dotsRemaining` cuenta códigos `2` y `4`: ganar exige comerse también los pellets.

## Plan de implementación

1. En `src/js/maze.js`, cambiar a `'o'` los caracteres de las filas 3 y 23 en las columnas 1 y 26, añadir la rama `4` en `parseTile()` y actualizar el comentario de códigos del encabezado. En `src/js/game.js`, contar `v === 4` en `dotsRemaining` y comer el pellet en `movePacman()` como un dot (`grid = 0`, `+50`, `dotsRemaining--`). En `src/js/render.js`, dibujar el código `4` como un dot de radio 6 que alterna visible/invisible cada 10 frames. Prueba manual: los cuatro pellets se ven más grandes y parpadean; comerlos suma 50 y la partida se puede ganar.
2. En `src/js/game.js`, añadir `FRIGHT_FRAMES`, `FRIGHT_SPEED` y los campos nuevos a `createGame()`. Al comer el pellet: `frightFrames = 360`, `eatChain = 0` y cada fantasma `normal` invierte su `dir`. En `moveGhost()`, un fantasma asustado usa `FRIGHT_SPEED` y elige dirección aleatoria entre las válidas sin reversa (reversa solo en callejón). En `update()`, descontar `frightFrames`; en `resetPositions()` ponerlo a `0`. En `src/js/render.js`, cuerpo azul `#2121ff` con ojos blancos y boca zigzag mientras dura el efecto. Prueba manual: al comer el pellet los cuatro se ponen azules, invierten el sentido y deambulan más despacio; a los 6 s recuperan su color; perder una vida durante el efecto los devuelve normales. (Nota: hasta el paso 3, chocar con un fantasma azul todavía quita vida.)
3. En `src/js/game.js`, en el bucle de colisiones de `update()`: los ojos se ignoran; un fantasma asustado se come (`score += GHOST_POINTS[ eatChain ]`, `eatChain++`, `g.mode = 'eyes'`, popup con los puntos); un fantasma normal quita vida como hoy. Los ojos usan `EYES_SPEED` y `chooseGhostDir()` hacia su propia celda de `GHOST_STARTS` permitiendo la reversa; al llegar a esa celda vuelven a `mode = 'normal'` y `dir = 'up'`. Prueba manual: comer fantasmas suma 200, 400, 800 y 1600; el comido vuelve a la pen como ojos y sale de nuevo; en modo ojos atraviesa a Pac-Man sin que pase nada.
4. En `src/js/render.js`, en los últimos 120 frames del efecto alternar el cuerpo entre azul y casi blanco cada 10 frames. Prueba manual: al final del efecto los fantasmas intermiten azul/blanco antes de recuperar su color.
5. En `src/js/game.js`, al comer un fantasma: `freezeFrames += 45` y `popups.push( { x: g.x, y: g.y, text: puntos } )`; mientras `freezeFrames > 0`, `update()` solo descuenta la pausa. En `src/js/render.js`, dibujar los popups en blanco sobre la posición del fantasma durante la pausa. Prueba manual: al comer un fantasma el juego se frena un instante con el número de puntos visible y luego sigue.
6. Actualizar `AGENTS.md`: añadir el código `4` a la lista de celdas y documentar `FRIGHT_SPEED = 0.025` (alinea cada 40 frames) y `EYES_SPEED = 0.1` (cada 10). Prueba manual: releer las notas y comprobar que constan el código y las dos velocidades nuevas.

## Criterios de aceptación

- [ ] `src/index.html` carga sin errores en la consola.
- [ ] Se ven exactamente cuatro power pellets parpadeando en (1, 3), (26, 3), (1, 23) y (26, 23).
- [ ] Comer un power pellet suma 50 puntos.
- [ ] Ganar exige comer los cuatro pellets (`dotsRemaining` los cuenta).
- [ ] Al comer el pellet los cuatro fantasmas se vuelven azules e invierten su sentido.
- [ ] Asustados, giran al azar en los cruces y avanzan a `0.025` celdas/frame.
- [ ] El efecto dura 6 s y los últimos 2 s parpadean azul/blanco.
- [ ] Comer fantasmas suma 200, 400, 800 y 1600 con el mismo pellet; la cadena se reinicia con el siguiente.
- [ ] Comer otro pellet con el efecto activo reinicia el temporizador a 6 s.
- [ ] El fantasma comido se convierte en ojos, vuelve a la pen a `0.1`, revive en su celda y sale de nuevo.
- [ ] Los ojos atraviesan a Pac-Man sin colisión y no se pueden comer.
- [ ] El fantasma revivido sale de la pen con su color normal aunque el efecto siga activo.
- [ ] Al comer un fantasma el juego se pausa ~0.75 s y muestra los puntos en su posición.
- [ ] Perder una vida durante el efecto lo cancela: tras el reset los fantasmas están normales.
- [ ] Los cuatro fantasmas conservan personalidades, colores y `GHOST_SPEED` base al acabar el efecto.
- [ ] Marcador, dots, vidas, teclado, túnel y pantallas de victoria/derrota siguen funcionando igual.
- [ ] Al reiniciar, los cuatro pellets reaparecen (`MAZE` sigue intacto).
- [ ] `AGENTS.md` documenta el código `4`, `FRIGHT_SPEED` y `EYES_SPEED`.

## Decisiones tomadas y descartadas

- **Sí:** duración fija de 6 s (360 frames). Clásico del nivel 1; sin niveles no hay decrecimiento que copiar.
- **No:** duración decreciente por pellet o "hasta comer los 4". Añaden estado sin beneficio con un solo nivel.
- **Sí:** reversa inmediata + giro aleatorio en cruces. Es el comportamiento clásico y el más legible para cazarlos.
- **No:** huir de Pac-Man con inteligencia. Convierte el susto en una persecución inversa casi imposible de cazar.
- **Sí:** ojos que vuelven a la pen a `0.1`. Mantiene al fantasma en juego y `1/10` no rompe la alineación.
- **No:** respawn con retardo ni eliminado hasta reiniciar. El primero necesita un temporizador extra que no aporta; el segundo rompe el equilibrio del final de partida.
- **Sí:** cadena 200/400/800/1600 con reinicio por pellet. Valores del arcade.
- **Sí:** pellets como código `4` con carácter `'o'`. El estado vive en el grid copiado, como los dots; sin listas que sincronizar.
- **Sí:** los pellets cuentan en `dotsRemaining`. Hoy esas celdas son dots; no contarlos permitiría ganar sin comerlos.
- **Sí:** revivir normal aunque quede efecto activo. Como en el arcade, y evita re-comer al mismo fantasma.
- **Sí:** pausa de ~45 frames con popup. Es el latido clásico del arcade y aclara de dónde salen los puntos.
- **Sí:** `FRIGHT_SPEED = 0.025` y `EYES_SPEED = 0.1`. Ambas `1/n`; `AGENTS.md` exige exactamente eso.
- **No:** sonido, HUD del temporizador, scatter/chase, récord, tests o build. Cada uno va en su propia spec si llega.

## Riesgos

| Riesgo                                                       | Mitigación                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Las velocidades nuevas rompen la alineación de celdas        | Ambas son `1/n` (1/40 y 1/10); `aligned()` redondea en cada celda.                            |
| El giro aleatorio deja a un fantasma dando vueltas sin rumbo | Mismo filtro de direcciones válidas que hoy; la reversa solo en callejón.                     |
| Los ojos orbitan una manzana sin llegar a la pen             | Los ojos eligen con la reversa permitida; verificar las cuatro rutas manualmente.             |
| Comer varios fantasmas en el mismo frame                     | Cada uno suma su popup y su pausa; el acumulado sigue siendo jugable.                         |
| Olvidar contar el código `4` en `dotsRemaining`              | El paso 1 lo cubre; la victoria exige comer los pellets.                                      |
| Un fantasma asustado sigue dentro de la pen                  | La salida forzada hacia arriba (`g.y > PEN_EXIT_ROW`) se mantiene; el azar solo aplica fuera. |

## Qué **no** entra en esta spec

- Sonido.
- Duración decreciente del susto o niveles.
- Fases scatter/chase.
- Fantasmas que huyen con inteligencia.
- HUD del tiempo restante.
- Cambios de laberinto, canvas o CSS, récord, tests, build.

Cada uno de esos puntos, si llega, va en su propia spec.
