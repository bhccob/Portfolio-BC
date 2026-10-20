import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';

declare global {
  interface Window {
    /** How many times the Stage has mounted; the proof harness expects 1 across navigation. */
    __needleMounts?: number;
  }
}

export default function Stage() {
  useEffect(() => {
    window.__needleMounts = (window.__needleMounts ?? 0) + 1;
  }, []);

  return (
    <Canvas dpr={[1, 2]} frameloop="demand" gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#0b0614']} />
    </Canvas>
  );
}
