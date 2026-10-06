import React, { useEffect, useRef, useState } from 'react';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = { animation: 'fade' };
import { Box, Button, Text } from 'react-drm';
import {
  MdChevronLeft, MdChevronRight, MdZoomIn, MdZoomOut,
  MdRotateLeft, MdRotateRight, MdSlideshow, MdDelete, MdCheck,
} from 'react-icons/md';
import { useGwenview } from '@/lib/hooks/useGwenview';
import { SELECTED_THEME } from '@/lib/theme';
import { useLayout } from '@/lib/utils/layoutStore';
import { LEFT_BUILT_IN } from '@/lib/utils/layoutSchema';
import { resolveLeftGroup, leftButtonId } from '../leftOrder';

const DIM = SELECTED_THEME.textPrimary;
const TRASH_CLR = SELECTED_THEME.error

const GROUP_GAP = 12;
const BTN_W = 100;
const ICON_SZ = 30;
const TRASH_CONFIRM_MS = 3000; // same window BrowserPanel uses for its close-tab confirm

export default function GwenviewPanel({ width, height }: { width: number; height: number }) {
  const {
    filename, prev, next, zoomIn, zoomOut, rotateLeft, rotateRight, slideshow, trash,
  } = useGwenview();

  const layout = useLayout();
  const [confirmTrash, setConfirmTrash] = useState(false);
  const trashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (trashTimer.current) clearTimeout(trashTimer.current);
  }, []);

  function armTrash() {
    if (confirmTrash) {
      if (trashTimer.current) clearTimeout(trashTimer.current);
      trashTimer.current = null;
      setConfirmTrash(false);
      trash();
      return;
    }

    setConfirmTrash(true);
    trashTimer.current = setTimeout(() => {
      trashTimer.current = null;
      setConfirmTrash(false);
    }, TRASH_CONFIRM_MS);
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
        // Page-qualified identity (gwenview.zoomIn, …) for editors.
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
    prev, next, zoomIn, zoomOut, rotateLeft, rotateRight, slideshow, trash: armTrash,
  };
  const ICON: Record<string, React.ReactNode> = {
    prev: icon(MdChevronLeft), next: icon(MdChevronRight),
    zoomIn: icon(MdZoomIn), zoomOut: icon(MdZoomOut),
    rotateLeft: icon(MdRotateLeft), rotateRight: icon(MdRotateRight),
    slideshow: icon(MdSlideshow),
    // Trash is two-step: first tap arms it (red "TRASH?"), second tap trashes.
    trash: confirmTrash ? (
      <Box style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <MdCheck style={{ width: 24, height: 24 }} fill={SELECTED_THEME.textPrimary} stroke="none" />
        <Text color={SELECTED_THEME.textPrimary} fontSize={14}>TRASH?</Text>
      </Box>
    ) : icon(MdDelete, TRASH_CLR),
  };

  // Config-driven order per group (LEFT_LAYOUT.gwenview, live via useLayout).
  function Group({ group, builtIn }: { group: string; builtIn: readonly string[] }) {
    const order = resolveLeftGroup(layout, 'gwenview', group, builtIn);
    if (order.length === 0) return null;
    return (
      <Box style={{ flexDirection: 'row', gap: SELECTED_THEME.borderWidth , backgroundColor:SELECTED_THEME.border  , borderWidth:SELECTED_THEME.borderWidth, borderColor:SELECTED_THEME.border , borderRadius:10}}>
        {order.map((id, i) => (
          <Btn
            key={id}
            id={leftButtonId('gwenview', id)}
            onClick={ON_CLICK[id] ?? (() => {})}
            color={id === 'trash' && confirmTrash ? '#7f1d1d' : undefined}
            activeColor={id === 'trash' && confirmTrash ? '#991b1b' : undefined}
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
      <Group group="nav" builtIn={LEFT_BUILT_IN.gwenview.nav} />
      <Group group="view" builtIn={LEFT_BUILT_IN.gwenview.view} />
      <Group group="actions" builtIn={LEFT_BUILT_IN.gwenview.actions} />

      {/* Status: current filename */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
        <Text color={DIM} fontSize={12}>
          {filename || '…'}
        </Text>
      </Box>
    </Box>
  );
}
