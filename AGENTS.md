# AGENTS.md

Static Pac-Man clone: vanilla JS + canvas, no dependencies, no build/test/lint tooling, no package manager, no CI.

## Run

- Open `src/index.html` directly (works over `file://`), or serve it: `python3 -m http.server -d src`.
- There is no dev server, watcher, build step, or test command. Do not add npm scaffolding unless asked.

## Code layout and loading

- `src/index.html` loads four classic (non-module) scripts in a fixed order: `maze.js` -> `game.js` -> `render.js` -> `main.js`.
- Files share state through globals attached to `window` (`MAZE`, `createGame`, `update`, `draw`, `DIRS`, constants). There are no `import`/`export` statements. Adding a JS file requires adding its `<script>` tag in the right order in `index.html`.
- Responsibilities: `maze.js` = static maze data and spawn points; `game.js` = state/rules; `render.js` = canvas drawing; `main.js` = rAF loop, keyboard, overlay screens.

## Maze and movement model

- Maze is 28x31 cells written as 31 strings of exactly 28 chars; cell codes: `0` empty, `1` wall, `2` dot, `3` ghost-pen door, `4` power pellet. Keep rows same length and vertically symmetric (see comments in `maze.js`).
- `MAZE` is pristine. `createGame()` deep-copies it to `game.grid`; mutate only `game.grid` so restarts work. Never write into `MAZE`.
- Actors move in continuous cell coordinates at `PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.05`, `FRIGHT_SPEED = 0.025` and `EYES_SPEED = 0.1` cells/frame. Turns/ghost decisions happen only on whole cells via `aligned()`; these speeds were chosen to align every 8/20/40/10 frames respectively, so changing them can break cornering and collision behavior. Frightened ghosts use `FRIGHT_SPEED`; eaten ghosts (eyes) use `EYES_SPEED` to return to the pen.
- Pac-Man cannot enter door cells (`3`); ghosts can. Tunnel wrapping applies only on `TUNNEL_ROW`.
- `render.js` draws from `game.grid` (eaten dots disappear), not `MAZE`.

## Canvas

- Canvas is `560x620` = 28*20 x 31*20; `TILE = 20` in `render.js` must match. Update canvas attributes and the CSS `#game-wrap` dimensions together if resizing.
- Walls are drawn as lines between centers of adjacent wall cells, not filled tiles.

## Conventions

- UI text, comments, and README are in Spanish; keep new user-facing strings Spanish.
- Code style: 2-space indent, spaces inside parentheses (`function f( x )`), single quotes in JS, `const`/arrow functions in newer files. Match surrounding style.
- No external assets: no image files, no fonts loaded (CSS falls back to Courier New), everything is drawn on canvas.
