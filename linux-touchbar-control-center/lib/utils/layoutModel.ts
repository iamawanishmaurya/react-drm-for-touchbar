/**
 * The bar's editable layout as plain data, plus the pure rules for applying it.
 *
 * Deliberately import-free (no config, no React) so it can be unit-tested and
 * shared by the live store (layoutStore.ts), the sandbox control endpoint, and
 * every panel that orders its buttons from it.
 */

export interface BarLayout {
  /** Right cluster order (BAR_LAYOUT.rightButtons). Empty → built-in order. */
  rightButtons: string[];
  /** Scene ids hidden anywhere on the bar: right keys (`volume`) and
   *  page-qualified left ids (`vscode.run`). */
  hidden: string[];
  /** Left panel order per page, per group (LEFT_LAYOUT). */
  left: Record<string, Record<string, string[]>>;
  /** Sandbox only: force this left panel instead of following window focus. */
  pinnedLeft: string | null;
}

/**
 * Resolves a group's order from its configured list:
 *   - ids are matched against the built-ins; unknown ids and duplicates drop
 *   - built-ins missing from the list are appended in built-in order, so a
 *     partial config never loses a button
 *   - an empty/missing list means the built-in order
 *   - anything in `hidden` (compared via `idOf`) is removed last
 */
export function resolveOrder(
  configured: unknown,
  builtIn: readonly string[],
  hidden: ReadonlySet<string> = new Set(),
  idOf: (key: string) => string = k => k,
): string[] {
  let order: string[];
  if (!Array.isArray(configured) || configured.length === 0) {
    order = [...builtIn];
  } else {
    const known = new Set(builtIn);
    const seen = new Set<string>();
    order = [];
    for (const id of configured) {
      if (typeof id === 'string' && known.has(id) && !seen.has(id)) { order.push(id); seen.add(id); }
    }
    for (const id of builtIn) if (!seen.has(id)) order.push(id);
  }
  return hidden.size ? order.filter(k => !hidden.has(idOf(k))) : order;
}

/** Scene id for a left-panel button: page-qualified so it can't collide with a
 *  right-cluster id (`back`, `volume`, …) when both appear in one scene. */
export function leftButtonId(page: string, action: string): string {
  return `${page}.${action}`;
}

const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const MAX_IDS = 128;

function idList(v: unknown, what: string): string[] {
  if (!Array.isArray(v)) throw new Error(`${what} must be an array`);
  if (v.length > MAX_IDS) throw new Error(`${what} has too many entries`);
  for (const id of v) {
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new Error(`${what} contains an invalid id`);
  }
  return [...v] as string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates an untrusted layout patch (the sandbox's POST /layout body). Only
 * the fields present are returned; anything malformed throws with a message
 * fit for a 400 response. Unknown button ids are allowed here — resolveOrder
 * drops them — but they must at least look like ids.
 */
export function parseLayoutPatch(body: unknown): Partial<BarLayout> {
  if (!isRecord(body)) throw new Error('layout must be an object');
  const out: Partial<BarLayout> = {};
  if ('rightButtons' in body) out.rightButtons = idList(body.rightButtons, 'rightButtons');
  if ('hidden' in body) out.hidden = idList(body.hidden, 'hidden');
  if ('left' in body) {
    if (!isRecord(body.left)) throw new Error('left must be an object');
    const left: Record<string, Record<string, string[]>> = {};
    for (const [page, groups] of Object.entries(body.left)) {
      if (!ID_RE.test(page)) throw new Error('left has an invalid page name');
      if (!isRecord(groups)) throw new Error(`left.${page} must be an object`);
      left[page] = {};
      for (const [group, ids] of Object.entries(groups)) {
        if (!ID_RE.test(group)) throw new Error(`left.${page} has an invalid group name`);
        left[page][group] = idList(ids, `left.${page}.${group}`);
      }
    }
    out.left = left;
  }
  if ('pinnedLeft' in body) {
    const p = body.pinnedLeft;
    if (p !== null && (typeof p !== 'string' || !ID_RE.test(p))) throw new Error('pinnedLeft must be a page name or null');
    out.pinnedLeft = p;
  }
  return out;
}

/** Builds the initial layout from the config sections (either may be absent
 *  in an older config.ts — REL-03). */
export function layoutFromConfig(barLayout: unknown, leftLayout: unknown): BarLayout {
  const bar = isRecord(barLayout) ? barLayout : {};
  const safe = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const left: Record<string, Record<string, string[]>> = {};
  if (isRecord(leftLayout)) {
    for (const [page, groups] of Object.entries(leftLayout)) {
      if (!isRecord(groups)) continue;
      left[page] = {};
      for (const [group, ids] of Object.entries(groups)) left[page][group] = safe(ids);
    }
  }
  return { rightButtons: safe(bar.rightButtons), hidden: safe(bar.hidden), left, pinnedLeft: null };
}
