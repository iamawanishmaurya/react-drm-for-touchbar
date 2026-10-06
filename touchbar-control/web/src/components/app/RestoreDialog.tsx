import { useEffect, useState } from 'react';
import { HistoryIcon, RotateCcwIcon } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfigBackup } from '../../../../shared/types.ts';
import type { Editor } from '@/lib/useEditor.ts';

/** Every config.ts kept before an Apply or a restore; put any of them back. */
export default function RestoreDialog({ open, onOpenChange, editor }: {
  open: boolean; onOpenChange: (open: boolean) => void; editor: Editor;
}) {
  const [backups, setBackups] = useState<ConfigBackup[] | null>(null);
  const [pending, setPending] = useState<ConfigBackup | null>(null);

  useEffect(() => {
    if (!open) return;
    setBackups(null);
    editor.listBackups().then(setBackups).catch(() => setBackups([]));
  }, [open, editor.listBackups]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Restore an earlier config</DialogTitle>
            <DialogDescription>
              A copy of <code>config.ts</code> is kept before every Apply and every restore (the last 30).
              Restoring one restarts your Touch Bar with it.
            </DialogDescription>
          </DialogHeader>
          {backups === null ? (
            <div className="flex flex-col gap-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
          ) : backups.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><HistoryIcon /></EmptyMedia>
                <EmptyTitle>No earlier configs yet</EmptyTitle>
                <EmptyDescription>One is saved the first time you Apply a layout.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <ul className="flex flex-col gap-2 pr-3" data-backups>
                {backups.map(b => (
                  <li key={b.id} className="flex items-center gap-3 rounded-lg border p-3" data-backup={b.id}>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{new Date(b.at).toLocaleString()}</span>
                        <Badge variant="outline">{b.reason === 'before-apply' ? 'before Apply' : 'before restore'}</Badge>
                      </div>
                      <span className="truncate text-sm text-muted-foreground">
                        Right: {b.layout.rightButtons.length ? b.layout.rightButtons.filter(id => !b.layout.hidden.includes(id)).join(' · ') : 'built-in order'}
                        {b.layout.hidden.length > 0 && ` — ${b.layout.hidden.length} hidden`}
                      </span>
                    </div>
                    <Button variant="outline" disabled={editor.applying} onClick={() => setPending(b)}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pending} onOpenChange={o => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this config?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && <>The config from <b>{new Date(pending.at).toLocaleString()}</b> replaces the current one (which is kept too) and your Touch Bar restarts.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pending) { void editor.restoreBackup(pending); onOpenChange(false); } }}>
              Restore and restart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
