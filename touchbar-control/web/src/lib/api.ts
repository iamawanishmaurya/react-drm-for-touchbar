import type { ActionsState, BarLayout, ConfigBackup, LayoutSchema, LiveState, SavedPreset, ScreenState } from '../../../shared/types.ts';

export interface ApplyResult { ok: boolean; message: string; backup: ConfigBackup }

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${url} → HTTP ${res.status}`);
  return data as T;
}

export const api = {
  schema: () => call<LayoutSchema>('GET', '/api/schema'),
  layout: () => call<BarLayout>('GET', '/api/layout'),
  setLayout: (patch: Partial<BarLayout>) => call<BarLayout>('POST', '/api/layout', patch),
  applied: () => call<BarLayout>('GET', '/api/applied'),
  apply: () => call<ApplyResult>('POST', '/api/apply'),
  backups: () => call<ConfigBackup[]>('GET', '/api/backups'),
  restoreBackup: (id: string) => call<ApplyResult>('POST', '/api/backups/restore', { id }),
  screen: () => call<ScreenState>('GET', '/api/screen'),
  live: () => call<LiveState>('GET', '/api/live'),
  setLive: (enabled: boolean) => call<LiveState>('POST', '/api/live', { enabled }),
  goScreen: (to: string) => call<ScreenState>('POST', '/api/screen', { to }),
  restartSandbox: () => call<{ ok: boolean }>('POST', '/api/sandbox/restart'),
  presets: () => call<SavedPreset[]>('GET', '/api/presets'),
  savePreset: (name: string, layout: BarLayout) => call<SavedPreset[]>('PUT', '/api/presets', { name, layout }),
  setActiveWindow: (w: { class: string; title: string } | null) => call<unknown>('POST', '/api/active-window', w),
  actions: () => call<ActionsState>('GET', '/api/actions'),
  setActions: (real: boolean) => call<ActionsState>('POST', '/api/actions', { real }),
  deletePreset: (name: string) => call<SavedPreset[]>('DELETE', `/api/presets?name=${encodeURIComponent(name)}`),
};
