import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Everything the server touches lives in the react-drm install: the sandbox
// runs that app (built native addon, node_modules), Apply writes its config.ts,
// and its service is the one restarted. By default that's the repo this folder
// sits in (touchbar-control/..) — what install.sh sets up. REACT_DRM_DIR points
// elsewhere, e.g. a separate deployed copy of a development fork.
export const REACT_DRM_DIR = process.env.REACT_DRM_DIR
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APP_DIR = path.join(REACT_DRM_DIR, 'linux-touchbar-control-center');
export const CONFIG_PATH = path.join(APP_DIR, 'config.ts');
export const BLUEPRINT_PATH = path.join(APP_DIR, 'config.blueprint.ts');
/** config-gui's format-preserving config.ts engine, reused for Apply. */
export const CONFIG_ENGINE = path.join(REACT_DRM_DIR, 'config-gui', 'main', 'configEngine.ts');

/** The website. 3001 is mtmr-designer's; 8787/8796 are other preview instances. */
export const PORT = Number(process.env.PORT) || 3100;
export const HOST = process.env.HOST ?? '127.0.0.1';
/** The sandbox preview instance this server owns. */
export const SANDBOX_PORT = Number(process.env.TBC_SANDBOX_PORT) || 8797;

export const SANDBOX_LOG = process.env.TBC_SANDBOX_LOG ?? '/tmp/touchbar-control-sandbox.log';
/** Stop the sandbox after this long with no page connected. */
export const SANDBOX_IDLE_MS = 3 * 60 * 1000;

/** Where touchbar-control keeps its own state (presets, config backups). */
export function userConfigDir(): string {
  return process.env.TBC_CONFIG_DIR
    ?? path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'touchbar-control');
}
