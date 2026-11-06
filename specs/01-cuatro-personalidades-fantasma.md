# SPEC 01 — Cuatro fantasmas con personalidad propia

> **Estado:** Aprobado
> **Depende de:** —
> **Fecha:** 2026-11-06
> **Objetivo:** Dar al juego cuatro fantasmas con arquetipos de comportamiento distintos —perseguidor agresivo, emboscador, flanqueador y tímido— manteniendo la velocidad y las reglas de movimiento actuales.

## Por qué existe esta spec

Hoy el juego solo tiene dos fantasmas y dos comportamientos: un `hunter` que persigue por distancia Manhattan y un `random` que elige direcciones al azar. El juego necesita cuatro fantasmas con personalidad reconocible y, en particular, uno que persiga de forma agresiva. La spec fija los cuatro arquetipos, sus objetivos y cómo se distinguen en pantalla, sin abrir la puerta a power pellets ni a estados comestibles.

## Alcance

**In:**

- Cuatro entradas en `GHOST_STARTS` con `kind` propio: `chaser`, `ambusher`, `flanker`, `shy`.
- Salida determinista de los cuatro fantasmas desde la pen al empezar la partida.
- Refactor de `decideGhost()` en `ghostTarget()` (elige la celda objetivo) y `chooseGhostDir()` (elige la dirección en el cruce).
- Cuatro objetivos distintos, uno por `kind`, calculados en cada celda alineada.
- Persecución por distancia Manhattan codiciosa, sin invertir el sentido salvo en callejones sin salida.
- Color fijo por personalidad en `GHOST_COLORS`, elegido por `kind` y no por índice del array.

**Fuera del alcance (para futuras specs):**

- Power pellets y cualquier estado comestible o de ojos.
- Respawn de fantasmas con temporizador.
- Fases alternas de persecución y dispersión (scatter/chase).
- Sonido y puntuación extra por comer fantasmas.
- Velocidad distinta por fantasma.
- Nombres de fantasmas en el HUD.
- Cambios en la geometría del laberinto o en el tamaño del canvas.

## Modelo de datos

`src/js/maze.js` pasa a declarar cuatro puntos de salida y una constante con la fila a partir de la cual un fantasma ya está fuera de la pen:

```js
const PEN_EXIT_ROW = 11; // row 11 es el pasillo sobre la puerta (row 12)

const GHOST_STARTS = [
  { x: 13, y: 13, kind: "chaser" }, // rojo, bajo la puerta
  { x: 14, y: 13, kind: "ambusher" }, // rosa, bajo la puerta
  { x: 13, y: 15, kind: "flanker" }, // cian, fondo de la pen
  { x: 14, y: 15, kind: "shy" }, // naranja, fondo de la pen
];
```

Los cuatro empiezan en las columnas 13 y 14, las mismas de la puerta, para que la salida hacia arriba nunca esté bloqueada.

`game.ghosts` conserva la forma actual (`x`, `y`, `dir`, `speed`, `kind`) y se crea con `GHOST_STARTS.map(...)`, así que no cambia su estructura. No se guarda ningún estado nuevo de "saliendo de la pen": la condición se deriva de `g.y > PEN_EXIT_ROW`.

`src/js/render.js` sustituye el array de colores por un mapa por personalidad:

```js
const GHOST_COLORS = {
  chaser: "#ff0000", // rojo
  ambusher: "#ffb8ff", // rosa
  flanker: "#00ffff", // cian
  shy: "#ffb852", // naranja
};
```

### Objetivo de cada personalidad

| `kind`     | Objetivo                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chaser`   | La celda actual de Pac-Man.                                                                                                                         |
| `ambusher` | La celda 4 posiciones por delante de Pac-Man según su `dir`, recortada a los límites del grid. Si cae en pared, usa la celda de Pac-Man.            |
| `flanker`  | `2 * pivote - celdaDelChaser`, donde `pivote` es la celda 2 posiciones por delante de Pac-Man. Ambas recortadas al grid. Sin `chaser`, usa Pac-Man. |
| `shy`      | Si la distancia Manhattan al fantasma es `>= 8`, la celda de Pac-Man. Si es `< 8`, la celda inferior izquierda `(1, 29)`.                           |

Convenciones:

- Coordenadas en celdas, origen arriba-izquierda, igual que el resto del juego.
- Las celdas de destino se recortan con `clampToGrid( x, y, grid )` y pueden ser paredes; solo se usan para medir distancia.
- La decisión ocurre solo en celdas alineadas, como ya hace `aligned()`.
- Orden de desempate fijo: `up`, `left`, `down`, `right`. Si dos direcciones empatan en distancia, gana la primera de esa lista.

## Plan de implementación

1. En `src/js/maze.js`, reemplazar `GHOST_STARTS` por las cuatro entradas y añadir `PEN_EXIT_ROW = 11` con su export en `window`. Prueba manual: abrir `src/index.html` y ver cuatro fantasmas dentro de la pen; el juego sigue arrancando y Pac-Man se mueve.
2. En `src/js/game.js`, dentro de `moveGhost()`, si la celda está alineada y `g.y > PEN_EXIT_ROW`, forzar `g.dir = 'up'` y no llamar a `decideGhost()`. Prueba manual: al empezar la partida, los cuatro fantasmas salen de la pen hacia el pasillo de la fila 11.
3. En `src/js/game.js`, sustituir `decideGhost()` por `chooseGhostDir( grid, g, target )` y `ghostTarget( game, g )`. Implementar solo el objetivo de `chaser` (celda de Pac-Man) y usar ese objetivo como respaldo temporal para los otros tres `kind`. Prueba manual: con Pac-Man quieto, el rojo lo alcanza y baja una vida; el resto también persigue.
4. En `src/js/game.js`, implementar el objetivo de `ambusher`: 4 celdas por delante de Pac-Man, recortado al grid y con respaldo a la celda de Pac-Man si el destino es pared. Prueba manual: moviendo a Pac-Man en línea recta, el rosa se adelanta a su posición actual.
5. En `src/js/game.js`, implementar el objetivo de `flanker` a partir de la celda del `chaser` y del pivote a 2 celdas por delante de Pac-Man. Prueba manual: al cambiar la ruta del rojo, el cian cambia la suya.
6. En `src/js/game.js`, implementar el objetivo de `shy`: perseguir a distancia `>= 8` y dirigirse a `(1, 29)` a distancia `< 8`. Prueba manual: acercarse al naranja y ver que se aleja hacia la esquina inferior izquierda.
7. En `src/js/render.js`, cambiar `GHOST_COLORS` al mapa por `kind` y dibujar con `GHOST_COLORS[ g.kind ] || '#ff0000'`. Prueba manual: los cuatro fantasmas se ven rojo, rosa, cian y naranja, y conservan su color al reiniciar.

## Criterios de aceptación

- [ ] `src/index.html` carga sin errores en la consola.
- [ ] Al empezar la partida se ven exactamente cuatro fantasmas.
- [ ] Los cuatro fantasmas tienen colores distintos y fijos: rojo, rosa, cian y naranja.
- [ ] Los cuatro fantasmas salen de la pen y ninguno se queda atrapado dentro al empezar la partida.
- [ ] Con Pac-Man quieto, el fantasma rojo llega a colisionar con él y las vidas bajan de 3 a 2.
- [ ] Con Pac-Man moviéndose en línea recta, el fantasma rosa se dirige a una celda situada por delante de él.
- [ ] Al cambiar la posición del fantasma rojo, la ruta del fantasma cian cambia en el siguiente cruce.
- [ ] Con el fantasma naranja a 8 o más celdas de Pac-Man, se acerca; a menos de 8 celdas, se aleja hacia la esquina inferior izquierda.
- [ ] Los cuatro fantasmas se mueven a `GHOST_SPEED = 0.1` celdas/frame y ningún cruce los deja desalineados.
- [ ] Los fantasmas no atraviesan paredes y siguen usando la puerta de la pen cuando corresponde.
- [ ] Al perder una vida o reiniciar, los cuatro vuelven a la pen y salen de nuevo.
- [ ] Marcador, dots, vidas, teclado y pantallas de victoria/derrota siguen funcionando igual.

## Decisiones tomadas y descartadas

- **Sí:** los cuatro arquetipos clásicos de Pac-Man (persecución directa, emboscada, flanqueo y tímido). Dan personalidades reconocibles y cubren el requisito de un perseguidor agresivo.
- **Sí:** Manhattan codicioso en cada cruce en vez de BFS. Es fiel al arcade, barato de calcular y deja margen de escape; BFS haría al perseguidor casi imposible de esquivar.
- **Sí:** mantener `GHOST_SPEED = 0.1` para los cuatro. `AGENTS.md` avisa de que las velocidades están calibradas con la alineación de celdas; cambiarlas puede romper esquinas y colisiones.
- **Sí:** salida inmediata y forzada hacia arriba mientras `g.y > PEN_EXIT_ROW`. Evita que un objetivo codicioso haga dar vueltas a un fantasma dentro de la pen.
- **Sí:** comportamiento fijo, sin ciclos scatter/chase. Los temporizadores de fase añaden estado y merecen su propia spec.
- **Sí:** `kind` con nombres de comportamiento (`chaser`, `ambusher`, `flanker`, `shy`) en vez de nombres propios del arcade. El código se explica solo.
- **Sí:** color por `kind` en un mapa y no por índice. Reordenar `GHOST_STARTS` no cambia los colores.
- **Sí:** desempate fijo `up`, `left`, `down`, `right`. Hace la decisión determinista y sigue el orden clásico.
- **No:** replicar el bug de Pinky en el arcade cuando Pac-Man mira hacia arriba. Aquí el emboscador apunta siempre 4 celdas en la dirección real.
- **No:** power pellets, fantasmas comestibles, ojos, respawn y sonido. Quedan para otra spec.
- **No:** nombres en el HUD. El color ya identifica a cada fantasma y evita tocar la interfaz.

## Riesgos

| Riesgo                                                         | Mitigación                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Un fantasma queda atrapado en la pen por su objetivo codicioso | Salida forzada hacia arriba mientras `g.y > PEN_EXIT_ROW`.                                      |
| El perseguidor entra en un bucle alrededor de una manzana      | Se acepta como comportamiento clásico; recalcula el objetivo en cada celda alineada.            |
| Los cuatro fantasmas comparten solo dos columnas al salir      | Empiezan con 2 celdas de separación y a la misma velocidad, así que mantienen la distancia.     |
| El rosa (`#ffb8ff`) se confunde con la puerta de la pen        | La puerta es una línea fina en la fila 12; se acepta el parecido con el color clásico de Pinky. |
| Cuatro fantasmas hacen el juego demasiado difícil              | La dificultad se ajusta en otra spec; aquí no se toca la velocidad ni la puntuación.            |

## Qué **no** entra en esta spec

- Power pellets y puntuación por comer fantasmas.
- Estados comestible, ojos y respawn.
- Fases scatter/chase con temporizador.
- Sonido.
- Nombres o etiquetas en el HUD.
- Cambios en el laberinto, el canvas o el CSS.

Cada uno de esos puntos, si llega, va en su propia spec.
