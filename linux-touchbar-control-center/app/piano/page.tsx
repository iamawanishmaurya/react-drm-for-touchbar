// PIANO — the upstream Touch Bar piano (others/piano.tsx), wired in as a
// root-level layer reachable from the games menu.
import React from 'react';
import { Box } from 'react-drm';
import { BackButton } from '@/components/BackButton';
import { Piano } from '@/others/piano';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = {
  leaving:  { outAnim: 'fade' },
  entering: { inAnim: 'slide-left' },
};

const BACK_W = 60;

export default function PianoPage({ width, height }: { width: number; height: number }) {
  const w   = Math.floor(width / 2) - BACK_W;
  const centerX = BACK_W + Math.floor((width - BACK_W - w) / 2);
  return (
    <Box style={{ flex: 1, flexDirection: 'row' }}>
      <BackButton to="games" animation="slide-right" />
      <Box x={centerX} y={0} width={w} height={height}>
        <Piano width={w} height={height} />
      </Box>
    </Box>
  );
}
