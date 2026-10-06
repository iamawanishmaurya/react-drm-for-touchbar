import { useEffect, useRef, type PointerEvent } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { bar } from '@/lib/bar.ts';
import { useBarState } from '@/lib/useBar.ts';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

/**
 * The real Touch Bar: every frame the sandbox renders, painted at the bar's
 * native resolution and scaled to fit. Pointer input becomes touches in bar
 * pixels, so taps, long-presses, slider drags and swipes behave as on the
 * hardware. `interactive={false}` makes it a view-only preview.
 */
export default function LiveBar({ interactive = true, compact = false }: { interactive?: boolean; compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hasFrame, status } = useBarState();
  const pressed = useRef(false);

  useEffect(() => {
    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      if (c.width !== bar.frame.width || c.height !== bar.frame.height) {
        c.width = bar.frame.width;
        c.height = bar.frame.height;
      }
      c.getContext('2d')!.drawImage(bar.frame, 0, 0);
    };
    draw();
    return bar.onFrameDrawn(draw);
  }, []);

  const toBar = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) / r.width) * bar.frame.width),
      y: Math.round(((e.clientY - r.top) / r.height) * bar.frame.height),
    };
  };
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pressed.current = true;
    bar.touch({ type: 'touchstart', ...toBar(e) });
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (pressed.current) bar.touch({ type: 'touchmove', ...toBar(e) });
  };
  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!pressed.current) return;
    pressed.current = false;
    bar.touch({ type: 'touchend', ...toBar(e) });
  };

  return (
    <div className={cn('relative rounded-xl border bg-card shadow-sm', compact ? 'p-1.5' : 'p-2.5')}>
      <canvas
        ref={canvasRef}
        aria-label="Live Touch Bar"
        className={cn('bar-canvas block aspect-[2008/60] w-full rounded-md', interactive && 'cursor-pointer')}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      {!hasFrame && (
        <div className="absolute inset-2.5 flex items-center justify-center gap-2 rounded-md bg-background text-sm text-muted-foreground">
          {status.sandbox === 'error' ? (
            <>
              <TriangleAlertIcon className="text-destructive" />
              <span className="truncate">{status.detail || 'The Touch Bar sandbox failed to start.'}</span>
            </>
          ) : (
            <>
              <Spinner />
              Starting the Touch Bar…
            </>
          )}
        </div>
      )}
    </div>
  );
}
