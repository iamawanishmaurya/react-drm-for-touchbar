import { meta } from '../state.js';

// Key-capture widget: click, press keys, Enter confirms, Esc cancels.
// Moved verbatim from renderer.ts (behavior unchanged).

export function keyNameFor(code: number): string {
  return meta.codeToKeyName[code] ?? String(code);
}

export function renderKeyCapture(codes: number[], onChange: (codes: number[]) => void): HTMLElement {
  const el = document.createElement('div');
  el.className = 'key-capture';
  el.tabIndex = 0;

  const render = (): void => {
    el.textContent = codes.length ? codes.map(keyNameFor).join(' + ') : '(click to set)';
  };
  render();

  let listening = false;
  let captured: number[] = [];

  el.addEventListener('click', () => {
    listening = true;
    captured = [];
    el.classList.add('listening');
    el.textContent = 'Press keys… (Enter to confirm, Esc to cancel)';
    el.focus();
  });

  el.addEventListener('blur', () => {
    listening = false;
    el.classList.remove('listening');
    render();
  });

  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!listening) return;
    e.preventDefault();
    if (e.key === 'Escape') { listening = false; el.classList.remove('listening'); render(); return; }
    if (e.key === 'Enter') {
      listening = false;
      el.classList.remove('listening');
      if (captured.length) { codes.length = 0; codes.push(...captured); onChange(codes); }
      render();
      return;
    }
    const name = meta.domCodeToKeyName[e.code];
    const code = name ? meta.keyNames[name] : undefined;
    if (code !== undefined && !captured.includes(code)) {
      captured.push(code);
      el.textContent = captured.map(keyNameFor).join(' + ') + ' …';
    }
  });

  return el;
}
