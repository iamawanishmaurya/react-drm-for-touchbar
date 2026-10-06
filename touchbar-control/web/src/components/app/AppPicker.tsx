import { AppWindowIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Editor } from '@/lib/useEditor.ts';

const REAL = '__real__';

/**
 * "Preview as": the app the sandbox pretends is focused, so the bar shows
 * exactly what you'd get with that app in front — its panel, its keys, its
 * accents. In Use mode you can also follow the real focus.
 */
export default function AppPicker({ editor }: { editor: Editor }) {
  const value = editor.mode === 'edit' ? (editor.app?.id ?? REAL) : (editor.previewApp ?? REAL);
  return (
    <div className="flex items-center gap-2">
      <Select value={value} onValueChange={v => editor.setPreviewApp(v === REAL ? null : v)} disabled={!editor.apps.length}>
        <SelectTrigger className="min-w-52" aria-label="Preview as app" data-app-picker>
          <AppWindowIcon />
          <SelectValue placeholder="Preview as…" />
        </SelectTrigger>
        <SelectContent position="popper">
          {editor.mode === 'use' && (
            <>
              <SelectGroup>
                <SelectItem value={REAL}>Real focus (follow my windows)</SelectItem>
              </SelectGroup>
              <SelectSeparator />
            </>
          )}
          <SelectGroup>
            <SelectLabel>Preview as app</SelectLabel>
            {editor.apps.map(a => (
              <SelectItem key={a.id} value={a.id} data-app={a.id}>{a.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {editor.app && <Badge variant="outline" data-panel={editor.panel}>{editor.panel === 'index' ? 'default panel' : `${editor.panel} panel`}</Badge>}
    </div>
  );
}
