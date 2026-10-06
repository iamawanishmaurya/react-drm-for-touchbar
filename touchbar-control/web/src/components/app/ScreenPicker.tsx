import { LayersIcon } from 'lucide-react';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Editor } from '@/lib/useEditor.ts';

/** Jump the sandbox bar to any of its screens (dock, games, sliders, F-keys…)
 *  instead of tapping your way there. Shows the screen currently up. */
export default function ScreenPicker({ editor }: { editor: Editor }) {
  const { screens, current } = editor.screen;
  const groups = [...new Set(screens.map(s => s.group))];
  return (
    <Select value={current ?? ''} onValueChange={v => void editor.goScreen(v)} disabled={!screens.length}>
      <SelectTrigger className="min-w-48" aria-label="Go to screen" data-screen-picker>
        <LayersIcon />
        <SelectValue placeholder="Screen…" />
      </SelectTrigger>
      <SelectContent position="popper">
        {groups.map(g => (
          <SelectGroup key={g}>
            <SelectLabel>{g}</SelectLabel>
            {screens.filter(s => s.group === g).map(s => (
              <SelectItem key={s.id} value={s.id} data-screen={s.id}>{s.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
