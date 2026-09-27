import { spawn, type ChildProcess } from 'node:child_process';
import * as net from 'node:net';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { BrowserWindow } from 'electron';
import { defaultConfigPaths } from './configEngine';

// Preview instance manager (Phase 2, D-04): owns a react-drm preview process
// — starts it with the GUI, kills it on exit, reports state to the renderer.

let child: ChildProcess | null = null;
let port = 0;
let desired = false; // true while the GUI wants the preview running
let retryTimer: NodeJS.Timeout | null = null;
let retryCount = 0;

export function previewState(): { running: boolean; port: number } {
  return { running: child !== null && child.exitCode === null, port };
}

function pushState(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('preview:state', previewState());
  }
}

function freePort(): Promise<number> {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(p));
    });
  });
}

/**
 * Spawns the preview instance in the deployed linux-touchbar-control-center
 * tree with the same env the real service uses (session bus, XDG runtime,
 * production mode) — otherwise the renderer crashes on D-Bus and renders the
 * splash forever (see research PITFALLS #6).
 */
async function startChild(): Promise<void> {
  port = await freePort();
  const uid = os.userInfo().uid;
  const paths = defaultConfigPaths();
  const cwd = path.dirname(paths.configPath);
  if (!fs.existsSync(cwd)) return;

  // nvm node first on PATH (tsx runs via npx), mirroring react-drm.service.
  const home = os.homedir();
  const nvmBin = fs.existsSync(`${home}/.nvm/versions/node/v26.10.0/bin`)
    ? `${home}/.nvm/versions/node/v26.10.0/bin:`
    : '';
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${nvmBin}${process.env.PATH}`,
    REACT_DRM_BACKEND: 'preview',
    REACT_DRM_PREVIEW_PORT: String(port),
    NODE_ENV: 'production',
    DBUS_SESSION_BUS_ADDRESS: `unix:path=/run/user/${uid}/bus`,
    XDG_RUNTIME_DIR: `/run/user/${uid}`,
  };

  child = spawn('npx', ['tsx', 'index.tsx'], { cwd, env, stdio: 'ignore', detached: false });
  child.on('exit', () => {
    child = null;
    pushState();
    if (desired) scheduleRetry();
  });
  pushState();
}

function scheduleRetry(): void {
  if (retryTimer || retryCount >= 3) return;
  retryCount += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (desired && !child) void startChild();
  }, 30000);
}

export async function startPreview(): Promise<{ running: boolean; port: number }> {
  desired = true;
  retryCount = 0;
  if (!child) await startChild();
  return previewState();
}

export function stopPreview(): void {
  desired = false;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (child) {
    child.removeAllListeners('exit');
    child.kill('SIGTERM');
    child = null; // detached: false — SIGTERM to the group root is enough; on('exit') removed so no retry
  }
  pushState();
}
