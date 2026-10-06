import { KeyInjector, KEY } from 'react-drm';
import { allowAction } from './sandboxActions';

const injector = new KeyInjector();

// Human-readable reports for simulated keys: "Press Ctrl+R", "Hold Fn".
const KEY_NAME = new Map<number, string>(Object.entries(KEY).map(([name, code]) => [code as number, name]));
const PRETTY: Record<string, string> = {
  LEFTCTRL: 'Ctrl', RIGHTCTRL: 'Ctrl', LEFTSHIFT: 'Shift', RIGHTSHIFT: 'Shift',
  LEFTALT: 'Alt', RIGHTALT: 'AltGr', LEFTMETA: 'Super', RIGHTMETA: 'Super', ESC: 'Esc',
};
const keyLabel = (code: unknown): string => {
  if (typeof code !== 'number') return String(code);
  const name = KEY_NAME.get(code) ?? String(code);
  return PRETTY[name] ?? name.replace(/^KEY_/, '').replace(/^(\w)(\w*)$/, (_m, a: string, b: string) => a + b.toLowerCase());
};
const VERB: Record<string, string> = { pressCombo: 'Press', pressKey: 'Press', keyDown: 'Hold', keyUp: 'Release', pressF: 'Press F', pressIndex: 'Press F-key' };
const describe = (method: string, args: unknown[]): string => {
  if (method === 'pressF') return `Press F${String(args[0])}`;
  const keysPressed = (Array.isArray(args[0]) ? args[0] : args).map(keyLabel);
  return `${VERB[method] ?? method} ${keysPressed.join('+')}`;
};

/**
 * The shared uinput key injector. In a sandbox preview key events are
 * simulated (see sandboxActions.ts) — they'd otherwise land in whatever real
 * window has focus. keyUp is always let through when its keyDown was, so a
 * held key can't get stuck.
 */
const held = new Set<number>();
export const keys = new Proxy(injector, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      const name = String(prop);
      if (name === 'keyUp' && held.has(args[0] as number)) {
        held.delete(args[0] as number);
        return value.apply(target, args);
      }
      if (!allowAction(describe(name, args))) return undefined;
      if (name === 'keyDown') held.add(args[0] as number);
      return value.apply(target, args);
    };
  },
});
