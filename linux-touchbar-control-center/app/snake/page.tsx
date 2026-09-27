// SNAKE — playable on the Touch Bar. Arrows (↑↓←→ on the physical keyboard)
// steer; tap the board to play/pause. Grid is horizontal (the bar is wide):
// CELL 15px → 133 cols × 4 rows at 2008×60.
import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, Button } from 'react-drm';
import { useKeyPressed } from 'react-drm';
import { BackButton } from '@/components/BackButton';
import { SELECTED_THEME } from '@/lib/theme';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = {
  leaving:  { outAnim: 'fade' },
  entering: { inAnim: 'fade' },
};

const CELL = 15;
const ROWS = 4;
const TICK_MS = 130;

interface Pt { c: number; r: number }
type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: Record<Dir, Pt> = {
  up:    { c: 0,  r: -1 },
  down:  { c: 0,  r: 1  },
  left:  { c: -1, r: 0  },
  right: { c: 1,  r: 0  },
};
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export default function SnakePage({ width, height }: { width: number; height: number }) {
  const COLS = Math.max(20, Math.floor(width / CELL));
  const boardW = COLS * CELL;
  const boardH = ROWS * CELL;
  const boardY = Math.floor((height - boardH) / 2);

  // ── state ──
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [dead, setDead] = useState(false);
  const [snake, setSnake] = useState<Pt[]>([{ c: 3, r: 1 }, { c: 2, r: 1 }, { c: 1, r: 1 }]);
  const [food, setFood] = useState<Pt>({ c: 10, r: 2 });

  // refs for the tick loop (avoid stale closures)
  const dirRef      = useRef<Dir>('right');
  const nextDirRef  = useRef<Dir>('right');
  const snakeRef    = useRef(snake);
  const foodRef     = useRef(food);
  const runningRef  = useRef(running);
  snakeRef.current   = snake;
  foodRef.current    = food;
  runningRef.current = running;

  function spawnFood(body: Pt[]): Pt {
    let p: Pt;
    do {
      p = { c: Math.floor(Math.random() * COLS), r: Math.floor(Math.random() * ROWS) };
    } while (body.some(s => s.c === p.c && s.r === p.r));
    return p;
  }

  function startGame() {
    const body = [{ c: 3, r: 1 }, { c: 2, r: 1 }, { c: 1, r: 1 }];
    setSnake(body);
    dirRef.current = nextDirRef.current = 'right';
    setFood(spawnFood(body));
    setScore(0);
    setDead(false);
    setRunning(true);
  }

  // ── tick ──
  useEffect(() => {
    if (!running || dead) return;
    const id = setInterval(() => {
      dirRef.current = nextDirRef.current;
      const d = DIRS[dirRef.current];
      const head = snakeRef.current[0];
      const next: Pt = { c: head.c + d.c, r: head.r + d.r };
      const body = snakeRef.current;
      const hitWall = next.c < 0 || next.c >= COLS || next.r < 0 || next.r >= ROWS;
      const hitSelf = body.some((s, i) => i < body.length - 1 && s.c === next.c && s.r === next.r);
      if (hitWall || hitSelf) {
        setRunning(false);
        setDead(true);
        setBest(b => Math.max(b, body.length - 3));
        return;
      }
      const ate = next.c === foodRef.current.c && next.r === foodRef.current.r;
      const grown = [next, ...body];
      if (!ate) grown.pop();
      else setScore(s => s + 1);
      setSnake(grown);
      if (ate) setFood(spawnFood(grown));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running, dead, COLS]);

  // ── arrow keys: edge-triggered direction changes ──
  const up    = useKeyPressed('up');
  const down  = useKeyPressed('down');
  const left  = useKeyPressed('left');
  const right = useKeyPressed('right');
  const prev  = useRef({ up: false, down: false, left: false, right: false });

  function steer(d: Dir) {
    if (d === OPPOSITE[dirRef.current]) return; // no 180° reversal
    nextDirRef.current = d;
    if (!running && !dead) setRunning(true);    // arrows also start the game
  }
  useEffect(() => {
    if (up    && !prev.current.up)    steer('up');
    if (down  && !prev.current.down)  steer('down');
    if (left  && !prev.current.left)  steer('left');
    if (right && !prev.current.right) steer('right');
    prev.current = { up, down, left, right };
  }, [up, down, left, right]);

  // ── render ──
  function renderSnake() {
    return snake.map((s, i) => (
      <Box
        key={`${i}-${s.c}-${s.r}`}
        x={s.c * CELL + 1}
        y={boardY + s.r * CELL + 1}
        width={CELL - 2}
        height={CELL - 2}
        style={{ backgroundColor: i === 0 ? '#4ade80' : '#22c55e', borderRadius: 3 }}
      />
    ));
  }

  return (
    <Box style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
      <BackButton to="splitted" animation="slide-right" />

      {/* board — tap to play/pause/restart */}
      <Button
        width={boardW}
        height={boardH}
        color="#0a0f0a"
        activeColor="#101810"
        style={{ borderRadius: 8, borderWidth: 1, borderColor: '#1f2b1f' }}
        onClick={() => (dead ? startGame() : setRunning(r => !r))}
      >
        {food.c * CELL >= 0 && !dead && (
          <Box
            x={food.c * CELL + 2}
            y={food.r * CELL + 2}
            width={CELL - 4}
            height={CELL - 4}
            style={{ backgroundColor: '#ef4444', borderRadius: 7 }}
          />
        )}
        {renderSnake()}
        {(!running || dead) && (
          <Box
            x={0}
            y={0}
            width={boardW}
            height={boardH}
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 14 }}
          >
            <Text color={dead ? '#f87171' : '#4ade80'} fontSize={26} fontFamily="IosevkaTerm Nerd Font">
              {dead ? `GAME OVER  ·  ${score}` : running ? 'PAUSED' : 'SNAKE — TAP TO PLAY'}
            </Text>
            <Text color={SELECTED_THEME.textSecondary} fontSize={16}>
              {dead ? 'tap to restart' : 'arrows steer · tap to pause'}
            </Text>
          </Box>
        )}
      </Button>

      {/* scoreboard */}
      <Box style={{ flexDirection: 'column', gap: 2, paddingHorizontal: 10 }}>
        <Text color="#4ade80" fontSize={18} fontFamily="IosevkaTerm Nerd Font">SCORE {score}</Text>
        <Text color={SELECTED_THEME.textSecondary} fontSize={14}>BEST {best}</Text>
      </Box>
    </Box>
  );
}
