import React from 'react';
import { Box, Text, Button } from 'react-drm';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };
import {
  MdArrowBack, MdArrowForward, MdArrowUpward, MdHome,
  MdVisibility, MdVerticalSplit, MdImage,
  MdCreateNewFolder, MdTerminal, MdDelete, MdFolder,
} from 'react-icons/md';
import { useDolphin } from '@/lib/hooks/useDolphin';
import { SELECTED_THEME } from '@/lib/theme';
import { useLayout } from '@/lib/utils/layoutStore';
import { LEFT_BUILT_IN } from '@/lib/utils/layoutSchema';
import { resolveLeftGroup, leftButtonId } from '../leftOrder';

const ACCENT   = SELECTED_THEME.primary;
const DIM      = SELECTED_THEME.textPrimary;
const DISABLED =SELECTED_THEME.textDisabled;
const DEL_CLR  = SELECTED_THEME.error;

const BTN_W  = 56;
const CHIP_W = 140;

export default function DolphinPanel({ width, height }: { width: number; height: number }) {
  const { connected, state, places, trigger, openDir } = useDolphin();
  const layout = useLayout();

  const ICON_SZ = Math.round(height * 0.55);

  if (!connected) {
    return (
      <Box style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, gap: 10 }}>
        <Box style={{ width: 3, height: 34, borderRadius: 10, backgroundColor: ACCENT }} />
        <Text color={DIM} fontSize={14}>
          Dolphin — waiting for D-Bus…
        </Text>
      </Box>
    );
  }

  function Btn({ onClick, enabled = true, children, id }: { onClick: () => void; enabled?: boolean; children: React.ReactNode; id: string }) {
    return (
      <Button
        // Page-qualified identity (dolphin.back, …) for editors.
        id={id}
        // width={BTN_W}
        
        color={SELECTED_THEME.surface}
        activeColor={ SELECTED_THEME.surfaceVariant}
        style={{flex:1, alignItems: 'center', justifyContent: 'center', borderRadius: 10  , borderColor:SELECTED_THEME.border , borderWidth:SELECTED_THEME.borderWidth}}
        onClick={enabled ? onClick : () => {}}
      >
        {children}
      </Button>
    );
  }

  const BUTTONS: Record<string, { action: string; Icon: typeof MdHome; fill: string; enabled?: boolean }> = {
    back:       { action: 'go_back',           Icon: MdArrowBack,       fill: state.canBack ? ACCENT : DISABLED, enabled: state.canBack },
    forward:    { action: 'go_forward',        Icon: MdArrowForward,    fill: state.canForward ? ACCENT : DISABLED, enabled: state.canForward },
    up:         { action: 'go_up',             Icon: MdArrowUpward,     fill: ACCENT },
    home:       { action: 'go_home',           Icon: MdHome,            fill: ACCENT },
    showHidden: { action: 'show_hidden_files', Icon: MdVisibility,      fill: state.hidden ? ACCENT : DIM },
    newFolder:  { action: 'create_dir',        Icon: MdCreateNewFolder, fill: SELECTED_THEME.success },
    trash:      { action: 'movetotrash',       Icon: MdDelete,          fill: DEL_CLR },
  };

  function Sep() {
    return <Box style={{ width: 1, height: height - 16, backgroundColor: SELECTED_THEME.border, marginLeft: 2, marginRight: 2 }} />;
  }

  return (
    <Box style={{ flex: 1, flexDirection: 'row', gap: 4 }}>

      {/* Config-driven order per group (LEFT_LAYOUT.dolphin, live via useLayout).
          Back/forward dim when there is no history; show-hidden lights when on. */}
      {(['nav', 'view', 'files'] as const).map(group => {
        const order = resolveLeftGroup(layout, 'dolphin', group, LEFT_BUILT_IN.dolphin[group]);
        if (order.length === 0) return null;
        return (
          <React.Fragment key={group}>
            {order.map(id => {
              const b = BUTTONS[id];
              return b ? (
                <Btn key={id} id={leftButtonId('dolphin', id)} onClick={() => trigger(b.action)} enabled={b.enabled}>
                  <b.Icon style={{ width: ICON_SZ, height: ICON_SZ }} fill={b.fill} stroke="none" />
                </Btn>
              ) : null;
            })}
            <Sep />
          </React.Fragment>
        );
      })}

      {/* Quick places from KDE's Places sidebar */}
      {places.map(p => (
        <Button
          key={p.path}
          width={CHIP_W}
          color={SELECTED_THEME.surface}
          activeColor={SELECTED_THEME.surfaceVariant}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 8 , borderWidth:SELECTED_THEME.borderWidth , borderColor:SELECTED_THEME.border}}
          onClick={() => openDir(p.path)}
        >
          <MdFolder style={{ width: 18, height: 18 }} fill={SELECTED_THEME.primary} stroke="none" />
          <Text color={SELECTED_THEME.textPrimary} fontSize={13}>{p.title}</Text>
        </Button>
      ))}

    </Box>
  );
}
