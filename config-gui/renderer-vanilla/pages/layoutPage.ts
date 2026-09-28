import { store, setPath, markDirty } from '../state.js';
import { move, removeAt, insertAt, orderChanged } from '../dnd/orderModel.js';
import { BAR_LAYOUT_DEFAULT, KNOWN_BAR_BUTTONS } from '../schema.js';
import type { PageDef } from '../schema.js';

// Layout page (Phase 3): drag-and-drop editor for BAR_LAYOUT.rightButtons.
// Bar mockup chips + palette share one order model; every bar chip also has
// up/down/remove buttons (HTML5 DnD is pointer-only). "Revert" restores the
// last-saved snapshot. Replaces the Phase 1 placeholder (CONTEXT D-02).

interface BtnMeta { id: string; label: string }

const META_BY_ID = new Map(KNOWN_BAR_BUTTONS.map(b => [b.id, b]));

function currentOrder(): string[] {
  const v = (store.BAR_LAYOUT as { rightButtons?: string[] } | undefined)?.rightButtons;
  return Array.isArray(v) ? [...v] : [...BAR_LAYOUT_DEFAULT];
}

function writeOrder(order: string[]): void {
  if (!store.BAR_LAYOUT || typeof store.BAR_LAYOUT !== 'object') {
    store.BAR_LAYOUT = { rightButtons: order } as never;
  } else {
    setPath(['BAR_LAYOUT', 'rightButtons'], order);
  }
  markDirty();
}

export function renderLayoutPage(def: PageDef): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'section-panel';
  panel.id = `panel-page-${def.id}`;

  const header = document.createElement('div');
  header.className = 'section-header';
  const h = document.createElement('h2');
  h.className = 'section-title';
  h.textContent = def.label;
  const p = document.createElement('p');
  p.className = 'section-desc';
  p.textContent = 'Drag the buttons to change their order on the bar. Drag from the palette to add, drag a bar chip onto the palette to remove.';
  header.append(h, p);
  panel.appendChild(header);

  const savedSnapshot = currentOrder();

  const barRow = document.createElement('div');
  barRow.className = 'bar-mock';
  panel.appendChild(barRow);

  const paletteLabel = document.createElement('p');
  paletteLabel.className = 'section-desc';
  paletteLabel.textContent = 'Palette — drag onto the bar to add; drag a bar chip here to remove:';
  panel.appendChild(paletteLabel);
  const paletteRow = document.createElement('div');
  paletteRow.className = 'palette-row';
  panel.appendChild(paletteRow);

  const revertBtn = document.createElement('button');
  revertBtn.type = 'button';
  revertBtn.className = 'secondary';
  revertBtn.textContent = 'Revert to saved';
  revertBtn.addEventListener('click', () => { writeOrder([...savedSnapshot]); render(); });
  const controls = document.createElement('div');
  controls.className = 'field-row';
  controls.appendChild(revertBtn);
  panel.appendChild(controls);

  function chipEl(id: string, inBar: boolean): HTMLElement {
    const meta = META_BY_ID.get(id);
    const chip = document.createElement('div');
    chip.className = 'bar-chip';
    chip.draggable = true;
    chip.dataset.id = id;
    chip.textContent = meta?.label ?? id;
    chip.title = id;

    chip.addEventListener('dragstart', e => {
      e.dataTransfer?.setData('text/plain', JSON.stringify({ id, from: inBar ? 'bar' : 'palette', index: currentOrder().indexOf(id) }));
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      document.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    });

    if (inBar) {
      const idx = () => currentOrder().indexOf(id);
      const up = document.createElement('button');
      up.textContent = '▲'; up.className = 'mini-btn'; up.title = 'Move earlier';
      up.addEventListener('click', () => { writeOrder(move(currentOrder(), idx(), idx() - 1)); render(); });
      const down = document.createElement('button');
      down.textContent = '▼'; down.className = 'mini-btn'; down.title = 'Move later';
      down.addEventListener('click', () => { writeOrder(move(currentOrder(), idx(), idx() + 1)); render(); });
      const rm = document.createElement('button');
      rm.textContent = '×'; rm.className = 'mini-btn danger'; rm.title = 'Remove from bar';
      rm.addEventListener('click', () => {
        if (currentOrder().length <= 1) return; // never empty the bar
        writeOrder(removeAt(currentOrder(), idx()));
        render();
      });
      chip.append(up, down, rm);
    }
    return chip;
  }

  function wireDropTarget(el: HTMLElement, mode: 'bar' | 'palette', beforeIndex: number): void {
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-target'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drop-target');
      let payload: { id: string; from: string; index: number };
      try { payload = JSON.parse(e.dataTransfer?.getData('text/plain') ?? ''); } catch { return; }
      if (!payload.id) return;
      let order = currentOrder();
      if (payload.from === 'bar') {
        if (mode === 'bar') order = move(order, payload.index, beforeIndex);
        else if (order.length > 1) order = removeAt(order, payload.index);
      } else if (mode === 'bar') {
        if (!order.includes(payload.id)) order = insertAt(order, beforeIndex, payload.id);
      }
      writeOrder(order);
      render();
    });
  }

  function render(): void {
    const order = currentOrder();
    barRow.innerHTML = '';
    order.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'bar-slot';
      slot.appendChild(chipEl(id, true));
      wireDropTarget(slot, 'bar', i);
      barRow.appendChild(slot);
    });
    const endSlot = document.createElement('div');
    endSlot.className = 'bar-slot bar-slot-end';
    wireDropTarget(endSlot, 'bar', order.length);
    barRow.appendChild(endSlot);
    revertBtn.disabled = !orderChanged(order, savedSnapshot);

    paletteRow.innerHTML = '';
    for (const b of KNOWN_BAR_BUTTONS) {
      if (order.includes(b.id)) continue;
      paletteRow.appendChild(chipEl(b.id, false));
    }
    if (!paletteRow.children.length) {
      const none = document.createElement('span');
      none.className = 'tb-preview-empty';
      none.textContent = 'All buttons are on the bar';
      paletteRow.appendChild(none);
    }
    wireDropTarget(paletteRow, 'palette', 0);
  }

  render();
  return panel;
}
