/**
 * Side-effect guard for sandbox previews.
 *
 * On the real bar every action runs. In a sandbox (REACT_DRM_SANDBOX=1, driven
 * by touchbar-control) actions that reach outside the bar — injected keys,
 * focusing windows, launching apps — are *simulated* by default: recorded and
 * reported instead of performed. Otherwise previewing "Firefox" and tapping
 * close-tab would close a real tab (likely the editor's own).
 */
import { createLogger } from 'react-drm';

const log = createLogger('sandbox-actions');
const MAX_RECENT = 30;

let realActions = process.env.REACT_DRM_SANDBOX !== '1';
let seq = 0;
const recent: { seq: number; at: number; what: string }[] = [];

/** True when the action should really run; otherwise records it. */
export function allowAction(what: string): boolean {
  if (realActions) return true;
  recent.push({ seq: ++seq, at: Date.now(), what });
  if (recent.length > MAX_RECENT) recent.shift();
  log.info(`simulated: ${what}`);
  return false;
}

/** For helpers that are part of an action already recorded (e.g. focusing the
 *  window a key combo is aimed at): allowed or not, without a second entry. */
export function actionsAreReal(): boolean {
  return realActions;
}

export function setRealActions(on: boolean): void {
  realActions = on;
}

export function getActionsState(): { real: boolean; recent: typeof recent } {
  return { real: realActions, recent: [...recent] };
}
