import { Environment, OrbitControls } from '@react-three/drei';
import { Avatar } from './Avatar';
import { Message } from '../types/message.types';

interface ExperienceProps {
  currentMessage: Message | null;
  onAudioEnd: () => void;
}

export function Experience({ currentMessage, onAudioEnd }: ExperienceProps) {
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
        modelUrl="/models/avatar.glb"
        audio={currentMessage?.audio}
        lipsync={currentMessage?.lipsync}
        facialExpression={currentMessage?.facialExpression || 'smile'}
        onAudioEnd={onAudioEnd}
        position={[0, -1.5, 0]}
        scale={1.5}
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
