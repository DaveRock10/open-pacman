// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
// Orden fijo de desempate: si dos direcciones empatan en distancia, gana la
// primera de esta lista.
const GHOST_DIR_ORDER = [ 'up', 'left', 'down', 'right' ];

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.05;   // 1/20 celda/frame -> alinea cada 20 frames
const FRIGHT_FRAMES = 360;  // 6 s a 60 fps
const FRIGHT_SPEED = 0.025; // 1/40 celda/frame -> alinea cada 40 frames
const EYES_SPEED = 0.1;     // 1/10 celda/frame -> alinea cada 10 frames
const GHOST_POINTS = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    frightFrames: 0, // frames restantes del efecto; > 0 = fantasmas asustados
    eatChain: 0,     // fantasmas comidos con el pellet actual (indice en GHOST_POINTS)
    freezeFrames: 0, // pausa al comer un fantasma
    popups: [],      // { x, y, text } puntos mostrados durante la pausa
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      mode: 'normal', // 'normal' | 'eyes' | 'revived'
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet.
    const cell = grid[ p.y ][ p.x ];
    if ( cell === 2 || cell === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += cell === 4 ? 50 : 10;
      game.dotsRemaining--;
      // Power pellet: reinicia el susto y la cadena, e invierte a los fantasmas.
      if ( cell === 4 ) {
        game.frightFrames = FRIGHT_FRAMES;
        game.eatChain = 0;
        for ( const g of game.ghosts ) {
          // Un nuevo pellet vuelve a asustar tambien a los revividos.
          if ( g.mode === 'revived' ) g.mode = 'normal';
          if ( g.mode === 'normal' ) g.dir = OPPOSITE[ g.dir ];
        }
      }
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Recorta una celda a los limites del grid.
function clampToGrid( x, y, grid ) {
  return {
    x: Math.max( 0, Math.min( grid[ 0 ].length - 1, Math.round( x ) ) ),
    y: Math.max( 0, Math.min( grid.length - 1, Math.round( y ) ) ),
  };
}

// Celda objetivo de un fantasma segun su personalidad. `chaser` (y cualquier
// kind desconocido) apunta directamente a Pac-Man.
function ghostTarget( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const pac = { x: Math.round( p.x ), y: Math.round( p.y ) };

  if ( g.kind === 'ambusher' ) {
    // 4 celdas por delante de Pac-Man, recortadas al grid. Puede ser pared: el
    // objetivo solo se usa para medir distancia Manhattan.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    return clampToGrid( pac.x + d.x * 4, pac.y + d.y * 4, grid );
  }

  if ( g.kind === 'flanker' ) {
    // Formula clasica de Inky: espeja la celda del emboscador respecto a un
    // pivote 2 celdas por delante de Pac-Man. Sin ambusador, persigue a Pac-Man.
    const ambusher = game.ghosts.find( ( other ) => other.kind === 'ambusher' );
    if ( !ambusher ) return pac;
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const pivot = clampToGrid( pac.x + d.x * 2, pac.y + d.y * 2, grid );
    const ambusherCell = clampToGrid( ambusher.x, ambusher.y, grid );
    return clampToGrid(
      2 * pivot.x - ambusherCell.x,
      2 * pivot.y - ambusherCell.y,
      grid
    );
  }

  if ( g.kind === 'shy' ) {
    // Persigue de lejos; a menos de 8 celdas huye a la esquina inferior izquierda.
    const dist =
      Math.abs( Math.round( g.x ) - pac.x ) + Math.abs( Math.round( g.y ) - pac.y );
    return dist < 8 ? { x: 1, y: 29 } : pac;
  }

  return pac;
}

// Elige la direccion en el cruce que mas acerque (Manhattan) a target.
function chooseGhostDir( grid, g, target, allowReverse ) {
  const options = GHOST_DIR_ORDER.filter(
    ( dir ) =>
      ( allowReverse || dir !== OPPOSITE[ g.dir ] ) &&
      canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Direccion aleatoria entre las validas, sin reversa salvo en callejon.
function chooseFrightenedDir( grid, g ) {
  const options = GHOST_DIR_ORDER.filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];
  g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
}

// Celda de salida propia de cada fantasma (se identifica por su kind).
function ghostHome( g ) {
  return GHOST_STARTS.find( ( s ) => s.kind === g.kind ) || GHOST_STARTS[ 0 ];
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    if ( g.mode === 'eyes' ) {
      const home = ghostHome( g );
      if ( g.x === home.x && g.y === home.y ) {
        // Revive normal aunque el efecto siga activo.
        g.mode = game.frightFrames > 0 ? 'revived' : 'normal';
        g.dir = 'up';
      } else {
        // Los ojos pueden revertir para encontrar el camino a la pen.
        chooseGhostDir( grid, g, home, true );
      }
    }

    if ( g.mode !== 'eyes' ) {
      if ( g.y > PEN_EXIT_ROW ) {
        // Dentro de la pen: salida forzada hacia arriba, sin decision codiciosa.
        g.dir = 'up';
      } else if ( game.frightFrames > 0 && g.mode === 'normal' ) {
        chooseFrightenedDir( grid, g );
      } else {
        chooseGhostDir( grid, g, ghostTarget( game, g ) );
      }
    }

    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  let speed = g.speed;
  if ( g.mode === 'eyes' ) speed = EYES_SPEED;
  else if ( game.frightFrames > 0 && g.mode === 'normal' ) speed = FRIGHT_SPEED;

  g.x += d.x * speed;
  g.y += d.y * speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.frightFrames = 0;
  game.eatChain = 0;
  game.freezeFrames = 0;
  game.popups = [];
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.mode = 'normal';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  // Pausa al comer un fantasma: solo corre el temporizador de la pausa.
  if ( game.freezeFrames > 0 ) {
    game.freezeFrames--;
    if ( game.freezeFrames === 0 ) game.popups = [];
    return;
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( g.mode === 'eyes' ) continue; // los ojos atraviesan a Pac-Man
    if ( !collides( game.pacman, g ) ) continue;

    if ( game.frightFrames > 0 && g.mode === 'normal' ) {
      // Fantasma asustado: se come y pasa a ojos.
      const points = GHOST_POINTS[ game.eatChain ];
      game.score += points;
      game.eatChain++;
      g.mode = 'eyes';
      // Reajustar a la rejilla de EYES_SPEED para no romper aligned().
      g.x = Math.round( g.x * 10 ) / 10;
      g.y = Math.round( g.y * 10 ) / 10;
      game.popups.push( { x: g.x, y: g.y, text: points } );
      game.freezeFrames += 45;
    } else {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.frightFrames > 0 ) {
    game.frightFrames--;
    if ( game.frightFrames === 0 ) {
      // Al acabar el efecto, los revividos pasan a normales y se reajusta la
      // posicion a la rejilla de GHOST_SPEED (el cambio de velocidad puede
      // dejar al fantasma a mitad de celda).
      for ( const g of game.ghosts ) {
        if ( g.mode === 'revived' ) g.mode = 'normal';
        if ( g.mode === 'normal' ) {
          g.x = Math.round( g.x * 20 ) / 20;
          g.y = Math.round( g.y * 20 ) / 20;
        }
      }
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
