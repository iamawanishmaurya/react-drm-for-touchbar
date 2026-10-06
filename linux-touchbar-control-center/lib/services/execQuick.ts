import { execFileSync, type ExecFileSyncOptions } from 'child_process';
import fs from 'fs';
import path from 'path';

// Upper bound for a synchronous helper command. The bar's render loop runs on
// the same thread, so a hung helper (e.g. wpctl while WirePlumber is stuck)
// would freeze the whole bar.
export const EXEC_TIMEOUT_MS = Number(process.env.REACT_DRM_EXEC_TIMEOUT_MS) || 1500;

// execFileSync with a hard timeout (SIGKILL) and stderr discarded. Throws on
// timeout, non-zero exit or a missing binary — callers fall back.
export function execQuick(cmd: string, args: string[], opts: ExecFileSyncOptions = {}): string {
  return execFileSync(cmd, args, {
    timeout: EXEC_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    stdio: ['ignore', 'pipe', 'ignore'],
    ...opts,
    encoding: 'utf8',
  }) as string;
}

// True when `cmd` is an executable on PATH — checked without running it, so a
// hung daemon at startup can't make us pick the wrong backend for good.
export function commandExists(cmd: string, envPath = process.env.PATH ?? ''): boolean {
  return envPath.split(path.delimiter).some(dir => {
    if (!dir) return false;
    try { fs.accessSync(path.join(dir, cmd), fs.constants.X_OK); return true; }
    catch { return false; }
  });
}
