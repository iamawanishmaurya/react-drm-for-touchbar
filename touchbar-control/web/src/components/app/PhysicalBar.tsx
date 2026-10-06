import { useEffect, useState } from 'react';
import { RadioIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Editor } from '@/lib/useEditor.ts';

/**
 * What the physical Touch Bar is showing right now — its own frame, fetched
 * from the running service — while "Live on Touch Bar" is on. Refreshed
 * shortly after every edit and every few seconds.
 */
export default function PhysicalBar({ editor }: { editor: Editor }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const enabled = editor.live.enabled;

  useEffect(() => {
    if (!enabled) { setSrc(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/live/snapshot?t=${Date.now()}`);
        if (!res.ok) throw new Error(String(res.status));
        const url = URL.createObjectURL(await res.blob());
        if (cancelled) { URL.revokeObjectURL(url); return; }
        setSrc(old => { if (old) URL.revokeObjectURL(old); return url; });
        setFailed(false);
      } catch { if (!cancelled) setFailed(true); }
    };
    // After an edit the bar needs a moment to re-render (and animate).
    const soon = window.setTimeout(load, 700);
    const every = window.setInterval(load, 3000);
    return () => { cancelled = true; window.clearTimeout(soon); window.clearInterval(every); };
  }, [enabled, editor.layout]);

  if (!enabled) return null;
  return (
    <div className="flex flex-col gap-2" data-physical-bar>
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <RadioIcon className="size-4 text-destructive" />
        Your physical Touch Bar
        <Badge variant="destructive">live</Badge>
      </h3>
      <div className="rounded-xl border bg-card p-1.5 shadow-sm">
        {src ? (
          <img src={src} alt="What the physical Touch Bar shows" className="block aspect-[2008/60] w-full rounded-md bg-black" />
        ) : (
          <Skeleton className="aspect-[2008/60] w-full" />
        )}
      </div>
      {failed && <p className="text-xs text-muted-foreground">Couldn't read the physical bar just now — retrying.</p>}
    </div>
  );
}
