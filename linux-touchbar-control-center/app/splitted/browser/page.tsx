import React, { useEffect, useRef, useState } from 'react';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };
import { Box, Button, Text } from 'react-drm';
import {
  MdArrowBack, MdArrowForward, MdRefresh, MdHome,
  MdAdd, MdCheck, MdClose, MdChevronLeft, MdChevronRight,
} from 'react-icons/md';
import { useActiveWindow } from '@/lib/hooks/useActiveWindow';
import { useBrowserKeys } from '@/lib/hooks/useBrowserKeys';
import { SELECTED_THEME } from '@/lib/theme';
import { useLayout } from '@/lib/utils/layoutStore';
import { LEFT_BUILT_IN } from '@/lib/utils/layoutSchema';
import { resolveLeftGroup, leftButtonId } from '../leftOrder';

const DIM       = SELECTED_THEME.textPrimary;
const CLOSE_CLR = SELECTED_THEME.error;
const CLOSE_CONFIRM_MS = 3000;
const GROUP_GAP = 12;
const BTN_W = 130;

export default function BrowserPanel({ width, height }: { width: number; height: number }) {
  const { class: windowClass } = useActiveWindow();
  const { back, forward, reload, home, newTab, closeTab, prevTab, nextTab } = useBrowserKeys(windowClass);
  const layout = useLayout();
  const [confirmClose, setConfirmClose] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ICON_SZ = 32;

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function armClose() {
    if (confirmClose) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
      setConfirmClose(false);
      closeTab();
      return;
    }

    setConfirmClose(true);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setConfirmClose(false);
    }, CLOSE_CONFIRM_MS);
  }

  function Btn({
    onClick,
    children,
    color = SELECTED_THEME.surface,
    activeColor = SELECTED_THEME.surfaceVariant,
    radiusLeft = false,
    radiusRight = false,
    id,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    color?: string;
    activeColor?: string;
    radiusLeft?: boolean;
    radiusRight?: boolean;
    id: string;
  }) {
    return (
      <Button
        // Page-qualified identity (browser.back, …) — inert on the panel,
        // exposed to editors via the scene (data-id / sceneBoxes).
        id={id}
        color={color}
        activeColor={activeColor}
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

  const icon = (C: React.ComponentType<{ style?: object; fill?: string; stroke?: string }>, fill = DIM) =>
    <C style={{ width: ICON_SZ, height: ICON_SZ }} fill={fill} stroke="none" />;

  const ON_CLICK: Record<string, () => void> = {
    back, forward, reload, home, prevTab, nextTab, newTab, closeTab: armClose,
  };
  const ICON: Record<string, React.ReactNode> = {
    back:    icon(MdArrowBack),
    forward: icon(MdArrowForward),
    reload:  icon(MdRefresh),
    home:    icon(MdHome),
    prevTab: icon(MdChevronLeft),
    nextTab: icon(MdChevronRight),
    newTab:  icon(MdAdd),
    // Close is two-step: first tap arms it (red "CLOSE?"), second tap closes.
    closeTab: confirmClose ? (
      <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <MdCheck style={{ width: 24, height: 24 }} fill={DIM} stroke="none" />
        <Text color={DIM} fontSize={14}>CLOSE?</Text>
      </Box>
    ) : icon(MdClose, CLOSE_CLR),
  };

  // Config-driven order per group (LEFT_LAYOUT.browser, live via useLayout).
  function Group({ group, builtIn }: { group: string; builtIn: readonly string[] }) {
    const order = resolveLeftGroup(layout, 'browser', group, builtIn);
    if (order.length === 0) return null;
    return (
      <Box style={{ flexDirection: 'row', gap: SELECTED_THEME.borderWidth , backgroundColor:SELECTED_THEME.border  , borderWidth:SELECTED_THEME.borderWidth, borderColor:SELECTED_THEME.border , borderRadius:10}}>
        {order.map((id, i) => (
          <Btn
            key={id}
            id={leftButtonId('browser', id)}
            onClick={ON_CLICK[id] ?? (() => {})}
            color={id === 'closeTab' && confirmClose ? '#7f1d1d' : undefined}
            activeColor={id === 'closeTab' && confirmClose ? '#991b1b' : undefined}
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
    <Box style={{ flex: 1, flexDirection: 'row', gap: GROUP_GAP }}>
      <Group group="nav" builtIn={LEFT_BUILT_IN.browser.nav} />
      <Group group="tabs" builtIn={LEFT_BUILT_IN.browser.tabs} />
    </Box>
  );
}
