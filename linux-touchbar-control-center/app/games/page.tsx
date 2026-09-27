// GAMES menu — entry point behind the gamepad button on the main bar.
// Lists every game: Snake (ours) plus the upstream Dino, Piano and Pong
// games (layers/gamesLayer.tsx, previously unwired).
import React from 'react';
import { Box, Button, Text } from 'react-drm';
import { MdSportsEsports, MdPiano, MdSportsTennis } from 'react-icons/md';
import { BackButton } from '@/components/BackButton';
import { useLayers } from '@/layers';
import type { LayerConfig } from '@/lib/routes/loadRoutes';

export const layerConfig: LayerConfig = {
  leaving:  { outAnim: 'fade' },
  entering: { inAnim: 'slide-left' },
};

function GameBtn({ label, color, icon, onClick }: {
  label: string; color: string; icon: React.ReactNode; onClick: () => void;
}) {
  return (
    <Button
      color="#1a1a2e"
      activeColor="#16213e"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10 }}
      onClick={onClick}
    >
      {icon}
      <Text color={color} fontSize={16} fontFamily="IosevkaTerm Nerd Font">{label}</Text>
    </Button>
  );
}

export default function GamesPage({ width, height }: { width: number; height: number }) {
  const { go } = useLayers();
  return (
    <Box style={{ flex: 1, gap: 6 }}>
      <BackButton to="splitted" animation="slide-right" />

      <GameBtn label="SNAKE" color="#4ade80" onClick={() => go('snake', 'slide-left')}
        icon={<MdSportsEsports style={{ width: 28, height: 28 }} fill="#4ade80" stroke="none" />} />
      <GameBtn label="DINO" color="#4ade80" onClick={() => go('dino', 'slide-left')}
        icon={<MdSportsEsports style={{ width: 28, height: 28 }} fill="#facc15" stroke="none" />} />
      <GameBtn label="PIANO" color="#a78bfa" onClick={() => go('piano', 'slide-left')}
        icon={<MdPiano style={{ width: 28, height: 28 }} fill="#a78bfa" stroke="none" />} />
      <GameBtn label="PONG" color="#38bdf8" onClick={() => go('pong', 'slide-left')}
        icon={<MdSportsTennis style={{ width: 28, height: 28 }} fill="#38bdf8" stroke="none" />} />
    </Box>
  );
}
