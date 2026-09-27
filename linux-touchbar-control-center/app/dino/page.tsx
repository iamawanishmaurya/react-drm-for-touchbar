// DINO — the upstream chrome-dino-style game (others/dino.tsx), wired in as
// a root-level layer reachable from the games menu.
import React from 'react';
import { Box } from 'react-drm';
import { BackButton } from '@/components/BackButton';
import { DinoGame } from '@/others/dino';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = {
  leaving:  { outAnim: 'fade' },
  entering: { inAnim: 'slide-left' },
};

const BACK_W = 60;

export default function DinoPage({ width, height }: { width: number; height: number }) {
  const gameW   = Math.floor(width / 2) - BACK_W;
  const centerX = BACK_W + Math.floor((width - BACK_W - gameW) / 2);
  return (
    <Box style={{ flex: 1, flexDirection: 'row' }}>
      <BackButton to="games" animation="slide-right" />
      <Box x={centerX} y={0} width={gameW} height={height}>
        <DinoGame width={gameW} height={height} />
      </Box>
    </Box>
  );
}
