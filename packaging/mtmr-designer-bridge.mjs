#!/usr/bin/env node
// Bridge between mtmr-designer (https://github.com/josmanvis/mtmr-designer)
// and react-drm-fork's config-driven BAR_LAYOUT.
//
// mtmr-designer edits an MTMR items.json (drag & drop, property editor).
// In bridge mode its server is pointed at a shared bridge file via
// MTMR_CONFIG_PATH; this script converts between that file and the
// rightButtons array in the fork's config.ts / config.blueprint.ts.
//
// Each react-drm button is exposed to the designer as an MTMR `button` item
// whose title is the react-drm button id (back, volume, ...). Any item the
// designer adds that doesn't map to a known react-drm id is dropped on import
// (the bar's renderer drops unknown ids too, see layout.tsx resolveRightButtons).
//
// Usage:
//   node mtmr-designer-bridge.mjs export   # config.ts → bridge items.json
//   node mtmr-designer-bridge.mjs import   # bridge items.json → config.ts (+ restart)
//   node mtmr-designer-bridge.mjs ids      # list known button ids

import { readFile, writeFile } from 'node:fs/promises';

const FORK = new URL('..', import.meta.url).pathname;
// The config.ts the running bar loads (a separate deployed copy, if any).
const LIVE_CONFIG = process.env.MTMR_BRIDGE_LIVE_CONFIG
  ?? (process.env.REACT_DRM_DEPLOY_DIR ? `${process.env.REACT_DRM_DEPLOY_DIR}/linux-touchbar-control-center/config.ts` : `${FORK}linux-touchbar-control-center/config.ts`);
const BLUEPRINT = `${FORK}linux-touchbar-control-center/config.blueprint.ts`;
// Shared file the designer's server reads/writes via MTMR_CONFIG_PATH.
const BRIDGE_ITEMS = process.env.MTMR_CONFIG_PATH ?? `${FORK}packaging/mtmr-bridge-items.json`;

// The ids the bar renderer knows (linux-touchbar-control-center/app/splitted/layout.tsx BASE_BTNS).
const KNOWN_IDS = ['back', 'volume', 'brightness', 'linux', 'playpause', 'screenshot', 'snake'];

// Real-bar icon data: the same react-icons components BASE_BTNS renders, with
// matching colors (textPrimary ≈ #e6e6e6; screenshot/snake have hardcoded
// accent colors in layout.tsx). Extracted from the react-icons GenIcon
// literals so the designer shows real icons, not raw id titles.
const REACT_ICONS_DIR = `${FORK}node_modules/react-icons`;

// Left-panel buttons, keyed by their scene id (`<page>.<action>`, the same id
// app/splitted/<page>/page.tsx puts on the Button). `group` matches the group
// each button belongs to — the config orders buttons *within* a group, it does
// not move them across groups. Icons mirror the page's own components.
const LEFT_BUTTONS = {
  'vscode.run':            { group: 'run',      file: 'vsc', icon: 'VscDebugStart',        color: '#cccccc' },
  'vscode.stop':           { group: 'run',      file: 'vsc', icon: 'VscDebugStop',         color: '#cccccc' },
  'vscode.stepOver':       { group: 'run',      file: 'vsc', icon: 'VscDebugStepOver',     color: '#cccccc' },
  'vscode.stepInto':       { group: 'run',      file: 'vsc', icon: 'VscDebugStepInto',     color: '#cccccc' },
  'vscode.stepOut':        { group: 'run',      file: 'vsc', icon: 'VscDebugStepOut',      color: '#cccccc' },
  'vscode.undo':           { group: 'edit',     file: 'md',  icon: 'MdUndo',               color: '#cccccc' },
  'vscode.redo':           { group: 'edit',     file: 'md',  icon: 'MdRedo',               color: '#cccccc' },
  'vscode.find':           { group: 'edit',     file: 'md',  icon: 'MdSearch',             color: '#cccccc' },
  'vscode.commandPalette': { group: 'commands', file: 'md',  icon: 'MdKeyboardCommandKey', color: '#cccccc' },
  'vscode.settings':       { group: 'commands', file: 'vsc', icon: 'VscGear',              color: '#cccccc' },
};
const LEFT_PAGES = ['vscode'];
const ICON_DEFS = {
  back:       { file: 'fa6', icon: 'FaChevronLeft',    color: '#cccccc' },
  volume:     { file: 'md',  icon: 'MdVolumeUp',       color: '#cccccc' },
  brightness: { file: 'md',  icon: 'MdWbSunny',        color: '#cccccc' },
  linux:      { file: 'ci',  icon: 'CiWavePulse1',     color: '#cccccc' },
  playpause:  { file: 'bs',  icon: 'BsWindowDock',     color: '#cccccc' },
  screenshot: { file: 'fa6', icon: 'FaCamera',         color: '#fbbf24' },
  snake:      { file: 'md',  icon: 'MdSportsEsports',  color: '#4ade80' },
};

async function extractIconSvg({ file, icon, color }) {
  const src = await readFile(`${REACT_ICONS_DIR}/${file}/index.mjs`, 'utf8');
  const re = new RegExp(`export function ${icon} \\(props\\) \\{\\n  return GenIcon\\((\\{.*?\\})\\)\\(props\\);`, 's');
  const m = src.match(re);
  if (!m) throw new Error(`icon ${icon} not found in react-icons/${file}`);
  const tree = JSON.parse(m[1]);
  const paint = (v) => (v === 'currentColor' ? color : v);
  const render = (node) => {
    const attrs = { ...node.attr };
    for (const k of Object.keys(attrs)) attrs[k] = paint(attrs[k]);
    // Accent color unless the icon explicitly wants no fill (react-icons
    // pads md/bs icons with a fill:'none' background rect).
    if (node.tag !== 'svg' || node.attr.fill !== 'none') attrs.fill = paint(node.attr.fill) === 'none' ? 'none' : color;
    // SVGs with only a viewBox have no intrinsic size and collapse the
    // designer's <img> to 0×0 — give the root svg explicit dimensions.
    if (node.tag === 'svg') { attrs.xmlns = 'http://www.w3.org/2000/svg'; attrs.width = attrs.width ?? 32; attrs.height = attrs.height ?? 32; }
    const inner = (node.child ?? []).map(render).join('');
    const attrStr = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${node.tag} ${attrStr}>${inner}</${node.tag}>`;
  };
  return render(tree);
}

// MTMR item shown in the designer for a react-drm button. `staticButton` is
// the type the designer renders as a titled button; the title carries the
// react-drm id through the round trip. `image.base64` (SVG markup, see the
// TouchBarItem image patch) makes the designer show the real bar icon.
async function toMtmrItem(id) {
  // The right cluster is the bar's right-hand cluster, the left buttons sit on
  // the left — align decides which side the designer renders them on.
  const isLeft = id.includes('.');
  const item = { type: 'staticButton', title: id, align: isLeft ? 'left' : 'right' };
  const def = isLeft ? LEFT_BUTTONS[id] : ICON_DEFS[id];
  // Left buttons carry their tile so the editor can render the same three
  // grouped tiles the bar does (LEFT_LAYOUT.<page>.<group>).
  if (def?.group) item.group = def.group;
  if (def) {
    try {
      item.image = { base64: Buffer.from(await extractIconSvg(def)).toString('base64') };
    } catch (e) {
      console.warn(`icon for ${id} unavailable: ${e.message}`);
    }
  }
  return item;
}

function parseRightButtons(source) {
  const m = source.match(/BAR_LAYOUT\s*=\s*\{[^}]*rightButtons\s*:\s*\[([^\]]*)\]/s);
  if (!m) throw new Error('BAR_LAYOUT.rightButtons not found in config');
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

// LEFT_LAYOUT.vscode.<group> arrays, in config order per group.
function parseLeftLayout(source) {
  const pageBlock = source.match(/LEFT_LAYOUT\s*=\s*\{[^}]*vscode\s*:\s*\{([\s\S]*?)\}\s*,?\s*\}/);
  if (!pageBlock) return [];
  const out = [];
  for (const [, group, list] of pageBlock[1].matchAll(
    /(\w+)\s*:\s*\[([^\]]*)\]/g)) {
    for (const id of list.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)) {
      out.push(`vscode.${id}`);
    }
  }
  return out;
}

async function readJson() {
  try {
    const raw = await readFile(BRIDGE_ITEMS, 'utf8');
    return JSON.parse(raw);
  } catch {
    return []; // missing/unparsable → start empty
  }
}

// Rewrite LEFT_LAYOUT.<page> group arrays in place. Only the groups present
// in `groups` are touched; anything the designer didn't reorder keeps its text.
async function patchLeftLayout(path, groups) {
  const src = await readFile(path, 'utf8');
  const m = src.match(/LEFT_LAYOUT\s*=\s*\{[^}]*vscode\s*:\s*\{/);
  if (!m) throw new Error('LEFT_LAYOUT.vscode not found in config');
  const openIdx = m.index + m[0].length;
  let out = src;
  for (const [group, ids] of Object.entries(groups)) {
    const list = ids.map(id => `'${id}'`).join(', ');
    // Match the group's array within the page block that follows.
    const after = out.slice(openIdx);
    const gm = new RegExp(`(${group}\\s*:\\s*)\\[[^\\]]*\\]`).exec(after);
    if (!gm) continue;
    const start = openIdx + gm.index;
    const end = start + gm[0].length;
    out = out.slice(0, start) + gm[1] + '[' + list + ']' + out.slice(end);
  }
  if (out === src) return false;
  await writeFile(path, out);
  return true;
}

async function patchConfig(path, ids) {
  const src = await readFile(path, 'utf8');
  const list = ids.map(id => `'${id}'`).join(', ');
  const next = src.replace(
    /(BAR_LAYOUT\s*=\s*\{[^}]*rightButtons\s*:\s*\[)[^\]]*(\])/s,
    `$1${list}$2`,
  );
  // Already up to date — not an error (blueprint and config.ts can differ).
  if (next === src) return false;
  await writeFile(path, next);
  return true;
}

const cmd = process.argv[2];

if (cmd === 'ids') {
  console.log(KNOWN_IDS.join('\n'));
} else if (cmd === 'export') {
  const src = await readFile(LIVE_CONFIG, 'utf8');
  const right = parseRightButtons(src);
  // Left buttons come from config when present; otherwise fall back to the
  // registry's own order so the designer still shows them.
  const configuredLeft = parseLeftLayout(src);
  const left = configuredLeft.length
    ? configuredLeft
    : Object.keys(LEFT_BUTTONS);
  const ids = [...left, ...right];
  await writeFile(BRIDGE_ITEMS, JSON.stringify(await Promise.all(ids.map(toMtmrItem)), null, 2) + '\n');
  console.log(`exported ${ids.length} buttons (${left.length} left, ${right.length} right) → ${BRIDGE_ITEMS}`);
} else if (cmd === 'import') {
  const items = await readJson();
  const titles = items
    .filter(it => it && typeof it === 'object')
    .map(it => (typeof it.title === 'string' ? it.title.trim() : ''));

  // Right cluster: the ids the bar renderer knows.
  const right = [...new Set(titles.filter(t => KNOWN_IDS.includes(t)))];
  // Left panel: page-qualified ids, kept in designer order per group.
  const leftByGroup = new Map();
  for (const t of titles) {
    const def = LEFT_BUTTONS[t];
    if (!def) continue;
    if (!leftByGroup.has(def.group)) leftByGroup.set(def.group, []);
    if (!leftByGroup.get(def.group).includes(t.split('.')[1])) {
      leftByGroup.get(def.group).push(t.split('.')[1]);
    }
  }

  if (right.length === 0 && leftByGroup.size === 0) {
    throw new Error('no known react-drm button ids found in bridge items — nothing to import');
  }

  if (right.length > 0) {
    await patchConfig(BLUEPRINT, right);
    await patchConfig(LIVE_CONFIG, right);
    console.log(`imported ${right.length} buttons → BAR_LAYOUT.rightButtons: ${right.join(', ')}`);
  }

  if (leftByGroup.size > 0) {
    for (const target of [BLUEPRINT, LIVE_CONFIG]) {
      await patchLeftLayout(target, Object.fromEntries(leftByGroup));
    }
    const summary = [...leftByGroup].map(([g, ids]) => `${g}: ${ids.join(', ')}`).join(' | ');
    console.log(`imported left buttons → LEFT_LAYOUT.vscode — ${summary}`);
  }

  console.log('restart react-drm (systemctl restart react-drm) to apply');
} else {
  console.error('usage: mtmr-designer-bridge.mjs export|import|ids');
  process.exit(1);
}
