import { Environment, OrbitControls } from '@react-three/drei';
import { Avatar } from './Avatar';
import { Message } from '../types/message.types';
import { getAvatarProfile } from '../utils/avatarProfiles';

interface ExperienceProps {
  currentMessage: Message | null;
  onAudioEnd: () => void;
  avatarId: string;
}

export function Experience({ currentMessage, onAudioEnd, avatarId }: ExperienceProps) {
  const profile = getAvatarProfile(avatarId);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Environment */}
      <Environment preset="apartment" />

      {/* Avatar */}
      <Avatar
        profile={profile}
        audio={currentMessage?.audio}
        playId={currentMessage?.playId}
        facialExpression={currentMessage?.facialExpression || 'smile'}
        onAudioEnd={onAudioEnd}
      />

      {/* Camera Controls */}
      <OrbitControls
        target={[0, 0.75, 0]}
        enablePan={false}
        minDistance={0.8}
        maxDistance={2}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}
