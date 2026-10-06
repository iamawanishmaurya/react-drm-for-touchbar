import { ActivityIcon, ShieldCheckIcon, ZapIcon } from 'lucide-react';
import LiveBar from '@/components/bar/LiveBar.tsx';
import AppPicker from './AppPicker.tsx';
import ScreenPicker from './ScreenPicker.tsx';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import type { Editor } from '@/lib/useEditor.ts';

/** Use mode: the live bar, large, with app preview and the action switch. */
export default function UseView({ editor }: { editor: Editor }) {
  const recent = [...editor.actions.recent].reverse().slice(0, 8);
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Your Touch Bar</CardTitle>
          <CardDescription className="text-base">
            {editor.app
              ? <>Previewing it as if <b>{editor.app.label}</b> is in front — click, hold and drag on it like a finger.</>
              : <>Following your real windows — click, hold and drag on it like a finger.</>}
          </CardDescription>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <ScreenPicker editor={editor} />
            <AppPicker editor={editor} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <LiveBar />
        </CardContent>
        <CardFooter className="justify-between gap-6">
          <Field orientation="horizontal" className="w-auto">
            <Switch id="real-actions" checked={editor.actions.real} onCheckedChange={v => void editor.setRealActions(v)} data-real-actions />
            <FieldContent>
              <FieldLabel htmlFor="real-actions">Real actions</FieldLabel>
              <FieldDescription>
                {editor.actions.real
                  ? 'Taps press real keys in the focused window and launch real apps.'
                  : 'Taps that would press keys or launch apps are only simulated and listed below.'}
              </FieldDescription>
            </FieldContent>
          </Field>
          <Badge variant={editor.actions.real ? 'destructive' : 'secondary'}>
            {editor.actions.real ? <ZapIcon /> : <ShieldCheckIcon />}
            {editor.actions.real ? 'Real' : 'Safe preview'}
          </Badge>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Simulated actions</CardTitle>
          <CardDescription>What the bar would have done — nothing was pressed or launched.</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <Empty className="py-6">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ActivityIcon /></EmptyMedia>
                <EmptyTitle>Nothing yet</EmptyTitle>
                <EmptyDescription>Tap a button that sends keys or opens something, e.g. a browser button while previewing Firefox.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2" data-activity>
              {recent.map(r => (
                <li key={r.seq} className="flex items-center gap-3 text-sm">
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">{new Date(r.at).toLocaleTimeString()}</span>
                  <code className="truncate">{r.what}</code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
