import React from 'react';
import { Box, Button } from 'react-drm';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };
import { MdUndo, MdRedo, MdSearch, MdKeyboardCommandKey } from 'react-icons/md';
import {
  VscDebugStart, VscDebugStop, VscDebugStepOver, VscDebugStepInto, VscDebugStepOut, VscGear,
} from 'react-icons/vsc';
import { useActiveWindow } from '@/lib/hooks/useActiveWindow';
import { useVsCodeKeys } from '@/lib/hooks/useVsCodeKeys';
import { resolveLeftGroup, leftButtonId } from '../leftOrder';
import { useLayout } from '@/lib/utils/layoutStore';
import { LEFT_BUILT_IN } from '@/lib/utils/layoutSchema';
import { SELECTED_THEME } from '@/lib/theme';

const DIM = SELECTED_THEME.textPrimary;
const GROUP_GAP = 12;
const BTN_W = 100;
const ICON_SZ = 30;

// Plain gray, matching BrowserPanel/KonsolePanel/DolphinPanel/VlcPanel — every
// other panel in this app uses the same uniform button color, so this stays
// consistent rather than being the one panel with per-group accent tinting.
// Start/Stop keep their own semantic green/red (not decorative — the same
// green=go/red=stop convention every IDE's debug toolbar uses); STOP_CLR
// matches the danger color BrowserPanel already uses for its close button.
const BTN_BG        = SELECTED_THEME.surface;
const BTN_ACTIVE_BG = SELECTED_THEME.surfaceVariant;
const GROUPS = {
  run:      { color: BTN_BG, activeColor: BTN_ACTIVE_BG },
  edit:     { color: BTN_BG, activeColor: BTN_ACTIVE_BG },
  commands: { color: BTN_BG, activeColor: BTN_ACTIVE_BG },
};
const START_CLR = { color: BTN_BG, activeColor: BTN_ACTIVE_BG };
const STOP_CLR  = { color: BTN_BG, activeColor: BTN_ACTIVE_BG };

export default function VsCodePanel({ width, height }: { width: number; height: number }) {
  const { class: windowClass } = useActiveWindow();
  const layout = useLayout();
  const {
    run, stop, stepOver, stepInto, stepOut, undo, redo, find, commandPalette, settings,
  } = useVsCodeKeys(windowClass);

  function Btn({
    onClick,
    children,
    group,
    color,
    activeColor,
    radiusLeft = false,
    radiusRight = false,
    id,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    group: keyof typeof GROUPS;
    color?: string;
    activeColor?: string;
    radiusLeft?: boolean;
    radiusRight?: boolean;
    id: string;
  }) {
    return (
      <Button
        // Page-qualified identity — inert on the panel, emitted as data-id by
        // sceneToSvg() so the designer can address this exact button.
        id={id}
        color={color ?? GROUPS[group].color}
        activeColor={activeColor ?? GROUPS[group].activeColor}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          width: BTN_W -( SELECTED_THEME.borderWidth *2),
          height: height -( SELECTED_THEME.borderWidth *2),
          marginVertical:SELECTED_THEME.borderWidth,
          marginLeft:radiusLeft?SELECTED_THEME.borderWidth:0,
          marginRight:radiusRight?SELECTED_THEME.borderWidth:0,
          borderTopLeftRadius: radiusLeft ? 10 : 0,
          borderBottomLeftRadius: radiusLeft ? 10 : 0,
          borderTopRightRadius: radiusRight ? 10 : 0,
          borderBottomRightRadius: radiusRight ? 10 : 0,
        }}
        onClick={onClick}
      >
        {children}
      </Button>
    );
  }

  // Config-driven order per group (LEFT_LAYOUT.vscode, live via useLayout).
  // Buttons keep their group — the layout orders them within it; hiding is
  // BAR_LAYOUT.hidden (`vscode.<id>`).
  const { run: RUN_BUILT_IN, edit: EDIT_BUILT_IN, commands: CMD_BUILT_IN } = LEFT_BUILT_IN.vscode;

  const ICON: Record<string, React.ReactNode> = {
    run:            <VscDebugStart style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    stop:           <VscDebugStop style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    stepOver:       <VscDebugStepOver style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    stepInto:       <VscDebugStepInto style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    stepOut:        <VscDebugStepOut style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    undo:           <MdUndo style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    redo:           <MdRedo style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    find:           <MdSearch style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    commandPalette: <MdKeyboardCommandKey style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
    settings:       <VscGear style={{ width: ICON_SZ, height: ICON_SZ }} fill={DIM} stroke="none" />,
  };

  const ON_CLICK: Record<string, () => void> = {
    run, stop, stepOver, stepInto, stepOut,
    undo, redo, find, commandPalette, settings,
  };

  function Group({ group, builtIn }: { group: keyof typeof GROUPS; builtIn: readonly string[] }) {
    const order = resolveLeftGroup(layout, 'vscode', group, builtIn);
    if (order.length === 0) return null;
    return (
      <Box style={{ flexDirection: 'row', gap: SELECTED_THEME.borderWidth , backgroundColor:SELECTED_THEME.border  , borderWidth:SELECTED_THEME.borderWidth, borderColor:SELECTED_THEME.border , borderRadius:10}}>
        {order.map((id, i) => (
          <Btn
            key={id}
            id={leftButtonId('vscode', id)}
            onClick={ON_CLICK[id] ?? (() => {})}
            group={group}
            color={id === 'run' ? START_CLR.color : id === 'stop' ? STOP_CLR.color : undefined}
            activeColor={id === 'run' ? START_CLR.activeColor : id === 'stop' ? STOP_CLR.activeColor : undefined}
            radiusLeft={i === 0}
            radiusRight={i === order.length - 1}
          >
            {ICON[id]}
          </Btn>
        ))}
      </Box>
    );
  }

  return (
    <Box style={{ flex: 1, flexDirection: 'row', gap: GROUP_GAP  }}>
      <Group group="run" builtIn={RUN_BUILT_IN} />
      <Group group="edit" builtIn={EDIT_BUILT_IN} />
      <Group group="commands" builtIn={CMD_BUILT_IN} />
    </Box>
  );
}
