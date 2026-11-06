# SPEC 02 — Corrección de personalidades y velocidad de los fantasmas

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-11-06
> **Objetivo:** Corregir los objetivos del emboscador y del impredecible y reducir a la mitad la velocidad de los cuatro fantasmas sin cambiar sus personalidades, colores ni las reglas de movimiento.

## Por qué existe esta spec

La SPEC 01 dejó cuatro `kind`, pero dos no se comportan como su nombre promete:

- El `ambusher` apunta 4 celdas por delante de Pac-Man y, si ese punto cae en pared, vuelve a apuntar a la celda actual de Pac-Man. En la práctica se convierte en otro perseguidor.
- El `flanker` calcula su objetivo a partir de la celda del `chaser`, no de la del emboscador. El jugador espera que el impredecible combine la posición de Pac-Man con la del emboscador.
- Los cuatro fantasmas se mueven a `GHOST_SPEED = 0.1`, demasiado rápido para distinguir sus rutas. El jugador pide la mitad.

El `chaser` y el `shy` ya cumplen lo que describe la SPEC 01. Esta spec los deja igual y solo verifica que sigan funcionando.

La SPEC 01 sigue siendo válida como contexto histórico. Esta spec sustituye únicamente su criterio de velocidad y los detalles de objetivo del emboscador y del impredecible.

## Alcance

**In:**

- `ambusher`: apuntar siempre a 4 celdas por delante de Pac-Man, recortadas al grid, aunque el destino sea pared.
- `flanker` (el impredecible): calcular el objetivo con la fórmula clásica de Inky usando la celda actual del emboscador y un pivote 2 celdas por delante de Pac-Man.
- `chaser`: mantener la celda actual de Pac-Man como objetivo.
- `shy`: mantener el umbral de 8 celdas y la esquina inferior izquierda `(1, 29)`.
- Bajar `GHOST_SPEED` de `0.1` a `0.05` celdas/frame para los cuatro fantasmas.
- Mantener `PACMAN_SPEED = 0.125` sin cambios.
- Mantener colores por `kind`, salida forzada de la pen, desempate fijo y prohibición de giro de 180 salvo en callejones sin salida.
- Actualizar la nota de velocidad en `AGENTS.md` y el comentario de `GHOST_SPEED` en `src/js/game.js`.

**Fuera del alcance (para futuras specs):**

- Renombrar el `kind` `flanker` a `unpredictable` o a cualquier otro nombre.
- Añadir, quitar o renombrar personalidades.
- Power pellets, fantasmas comestibles, ojos, respawn o sonido.
- Fases alternas de persecución y dispersión (scatter/chase).
- Velocidad distinta por fantasma.
- Nombres o etiquetas de fantasmas en el HUD.
- Cambios en el laberinto, el canvas, el CSS o la puntuación.
- Reequilibrar la dificultad más allá de la velocidad.
- Añadir tests, `package.json`, build o cualquier herramienta de desarrollo.

## Modelo de datos

Esta spec no introduce estructuras nuevas. Reutiliza el modelo de la SPEC 01: `GHOST_STARTS` con cuatro `kind` y `game.ghosts` con `x`, `y`, `dir`, `speed` y `kind`.

El único valor que cambia es la constante de velocidad:

```js
const GHOST_SPEED = 0.05; // 1/20 celda/frame -> alinea cada 20 frames
```

`createGame()` sigue copiando `GHOST_SPEED` en el campo `speed` de cada fantasma, así que no hay que tocar la creación del estado.

### Objetivo de cada personalidad

| `kind`     | Objetivo                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `chaser`   | La celda actual de Pac-Man. Sin cambios.                                                                                                                                                                                 |
| `ambusher` | La celda 4 posiciones por delante de Pac-Man según su `dir`, recortada al grid. Puede ser pared: el objetivo solo se usa para medir distancia Manhattan.                                                                 |
| `flanker`  | `2 * pivote - celdaEmboscador`, donde `pivote` es la celda 2 posiciones por delante de Pac-Man y `celdaEmboscador` es la celda actual del `ambusher`. Ambas recortadas al grid. Sin `ambusher`, usa la celda de Pac-Man. |
| `shy`      | Si la distancia Manhattan al fantasma es `>= 8`, la celda de Pac-Man. Si es `< 8`, la celda `(1, 29)`. Sin cambios.                                                                                                      |

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda, igual que el resto del juego.
- Las celdas de destino se recortan con `clampToGrid( x, y, grid )` y pueden ser paredes; solo se usan para medir distancia.
- La decisión ocurre solo en celdas alineadas, como ya hace `aligned()`.
- Orden de desempate fijo: `up`, `left`, `down`, `right`.
- Un fantasma no invierte el sentido salvo que no tenga otra salida.
- Mientras `g.y > PEN_EXIT_ROW`, la salida de la pen sigue siendo forzada hacia arriba.

### Fórmula del impredecible

Con Pac-Man en `pac` y su dirección en `p.dir`:

```js
pivote = clampToGrid(pac.x + 2 * d.x, pac.y + 2 * d.y, grid);
celdaEmboscador = clampToGrid(ambusher.x, ambusher.y, grid);
objetivo = clampToGrid(
  2 * pivote.x - celdaEmboscador.x,
  2 * pivote.y - celdaEmboscador.y,
  grid,
);
```

Si no existe un fantasma con `kind === 'ambusher'`, el objetivo vuelve a ser la celda de Pac-Man. Es la misma fórmula que usa Inky en el arcade, pero referenciada al emboscador en vez de al perseguidor.

## Plan de implementación

1. En `src/js/game.js`, cambiar `GHOST_SPEED` de `0.1` a `0.05` y actualizar su comentario a `1/20 celda/frame -> alinea cada 20 frames`. Prueba manual: abrir `src/index.html`, ver que los cuatro fantasmas se mueven a mitad de velocidad, siguen saliendo de la pen y, con Pac-Man quieto, el rojo tarda aproximadamente el doble en alcanzarlo y las vidas bajan de 3 a 2.
2. En `src/js/game.js`, dentro de `ghostTarget()`, cambiar la rama `ambusher`: eliminar el respaldo a Pac-Man cuando el destino es pared y devolver siempre `clampToGrid( pac.x + d.x * 4, pac.y + d.y * 4, grid )`. Prueba manual: con Pac-Man moviéndose hacia una pared, el rosa se mantiene adelantado y no se pega a la celda actual de Pac-Man.
3. En `src/js/game.js`, dentro de `ghostTarget()`, cambiar la rama `flanker`: buscar el fantasma con `kind === 'ambusher'`, calcular `pivote` a 2 celdas por delante de Pac-Man y devolver `clampToGrid( 2 * pivote.x - ambusherCell.x, 2 * pivote.y - ambusherCell.y, grid )`; si no hay ambusador, devolver la celda de Pac-Man. Actualizar el comentario de la rama. Prueba manual: en la consola del navegador, `ghostTarget( game, game.ghosts[ 2 ] )` cambia al mover al emboscador; en pantalla, el cian deja de seguir al rojo y reacciona a la posición del rosa.
4. Actualizar `AGENTS.md` para que documente `GHOST_SPEED = 0.05` y la alineación cada 20 frames. Prueba manual: leer la nota y comprobar que ya no dice `0.1` ni "cada 10 frames".

## Criterios de aceptación

- [ ] `src/index.html` carga sin errores en la consola.
- [ ] `GHOST_SPEED` vale `0.05`; cada fantasma avanza `0.05` celdas/frame.
- [ ] `PACMAN_SPEED` sigue valiendo `0.125` celdas/frame.
- [ ] Con Pac-Man quieto, el fantasma rojo llega a colisionar con él y las vidas bajan de 3 a 2.
- [ ] `ghostTarget( game, game.ghosts[ 0 ] )` devuelve la celda actual de Pac-Man.
- [ ] `ghostTarget( game, game.ghosts[ 1 ] )` devuelve una celda 4 posiciones por delante de Pac-Man, recortada al grid, aunque sea pared; no vuelve a la celda de Pac-Man.
- [ ] `ghostTarget( game, game.ghosts[ 2 ] )` cumple `2 * pivote - celdaEmboscador`, con `pivote` 2 celdas por delante de Pac-Man.
- [ ] `ghostTarget( game, game.ghosts[ 3 ] )` devuelve Pac-Man cuando la distancia Manhattan es `>= 8` y `(1, 29)` cuando es `< 8`.
- [ ] Los cuatro fantasmas siguen saliendo de la pen y ninguno se queda atrapado dentro al empezar la partida.
- [ ] Los cuatro conservan su `kind` y sus colores: rojo, rosa, cian y naranja.
- [ ] Los fantasmas no atraviesan paredes y siguen usando la puerta de la pen cuando corresponde.
- [ ] El túnel de la fila 14 sigue funcionando para Pac-Man y para los fantasmas.
- [ ] En cada cruce la decisión sigue ocurriendo solo en celdas alineadas y ningún fantasma queda desalineado.
- [ ] Al perder una vida o reiniciar, los cuatro vuelven a la pen y salen de nuevo.
- [ ] Marcador, dots, vidas, teclado y pantallas de victoria/derrota siguen funcionando igual.
- [ ] `AGENTS.md` documenta `GHOST_SPEED = 0.05`.

## Decisiones tomadas y descartadas

- **Sí:** fórmula clásica de Inky con el emboscador como referencia. Es la forma más directa de cumplir "combina la posición de Pac-Man y la del emboscador" sin inventar una personalidad nueva.
- **No:** renombrar `flanker` a `unpredictable`. El jugador prefiere conservar el `kind` actual; el comentario y la spec dejan claro que `flanker` es el impredecible.
- **Sí:** permitir que el objetivo del emboscador caiga en pared. El objetivo solo se usa para medir distancia; el respaldo a Pac-Man lo convertía en un segundo perseguidor.
- **Sí:** mantener las 4 celdas de anticipación del emboscador. Ya están en la SPEC 01 y son las del arcade.
- **Sí:** mantener el umbral de 8 celdas y la esquina `(1, 29)` del tímido. Ya funcionan y el jugador no pidió cambiarlos.
- **Sí:** bajar `GHOST_SPEED` a `0.05` para los cuatro. Es exactamente la mitad pedida; `0.05` es `1/20`, así que la alineación de celdas se mantiene cada 20 frames.
- **Sí:** dejar `PACMAN_SPEED` en `0.125`. El pedido afecta solo a los fantasmas y cambiar a Pac-Man alteraría todo el ritmo del juego.
- **Sí:** mantener Manhattan codicioso, el desempate `up`, `left`, `down`, `right` y la prohibición de giro de 180. No son la causa del comportamiento erróneo y cambiarlos abriría otra spec.
- **Sí:** actualizar `AGENTS.md`. Si la memoria del proyecto sigue diciendo `0.1`, el próximo agente partirá de un dato falso.
- **No:** editar la SPEC 01. Se conserva como registro histórico; esta spec documenta lo que la sustituye.
- **No:** tests automatizados. El proyecto no tiene tooling y añadirlo queda fuera del alcance.

## Riesgos

| Riesgo                                                            | Mitigación                                                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `0.05` rompe la alineación de celdas o las esquinas               | `0.05` es `1/20`; `aligned()` tolera `1e-3` y se redondea en cada celda. Verificar que ningún fantasma se quede entre celdas.                |
| Los fantasmas quedan demasiado lentos y el juego se hace aburrido | Es el cambio pedido. La dificultad se puede reequilibrar en otra spec sin tocar esta lógica.                                                 |
| El objetivo del emboscador cae fuera de la zona jugable           | `clampToGrid()` lo recorta al grid. El objetivo solo se usa para medir distancia; el movimiento sigue respetando paredes.                    |
| El impredecible depende de un emboscador que aún está en la pen   | El objetivo se recalcula en cada celda alineada; el desfase se resuelve cuando los dos salen de la pen. Si falta el emboscador, usa Pac-Man. |
| Los cuatro fantasmas se agrupan al compartir velocidad            | Ya empiezan separados 2 celdas y mantienen la distancia; es el comportamiento clásico.                                                       |
| La verificación por consola depende de globals                    | `ghostTarget` y `game` son declaraciones de nivel superior en scripts clásicos y son accesibles desde la consola del navegador.              |

## Qué **no** entra en esta spec

- Renombrar `flanker` o añadir personalidades nuevas.
- Power pellets, fantasmas comestibles, ojos, respawn o sonido.
- Fases scatter/chase con temporizador.
- Velocidad distinta por fantasma.
- Nombres o etiquetas en el HUD.
- Cambios en el laberinto, el canvas, el CSS o la puntuación.
- Tests automatizados, build o gestor de paquetes.

Cada uno de esos puntos, si llega, va en su propia spec.
