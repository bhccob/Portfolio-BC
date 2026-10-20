import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { type JSX, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { COMPASS_STUDIO, shoulder } from '~/engine/studio/CompassStudio';
import { useScene } from '~/state/store';
import { ShoulderToneMappingEffect } from './ShoulderToneMapping';

/**
 * The post chain, by tier (QualityGovernor sets it):
 *   - high and medium: pmndrs `EffectComposer` (half-float buffers) with Bloom (threshold 0.85, intensity 0.6;
 *     mipmap blur, half resolution on medium), Vignette, Noise (opacity 0.03, premultiplied, so it never lifts the
 *     blacks), then the shoulder tone mapping last, on the linear buffer. The renderer's own tone mapping is off
 *     meanwhile, so the shoulder is applied once.
 *   - low: no composer at all; the renderer tone-maps in every material with the shoulder as its CustomToneMapping
 *     (revision 4's path). Depth of field arrives in M2.
 */
export function Effects(): JSX.Element | null {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const tier = useScene((state) => state.tier);
  const composer = tier !== 'low';
  const shoulderEffect = useMemo(() => new ShoulderToneMappingEffect({ exposure: COMPASS_STUDIO.exposure }), []);

  // A primitive is not R3F's to dispose.
  useEffect(() => () => shoulderEffect.dispose(), [shoulderEffect]);

  useEffect(() => {
    if (composer) {
      gl.toneMapping = THREE.NoToneMapping;
    } else {
      shoulder();
      gl.toneMapping = THREE.CustomToneMapping;
      gl.toneMappingExposure = COMPASS_STUDIO.exposure;
    }
    invalidate();
  }, [composer, gl, invalidate]);

  if (!composer) return null;
  return (
    <EffectComposer frameBufferType={THREE.HalfFloatType} multisampling={tier === 'high' ? 4 : 2}>
      <Bloom mipmapBlur luminanceThreshold={0.85} luminanceSmoothing={0.12} intensity={0.6} radius={0.6} resolutionScale={tier === 'high' ? 1 : 0.5} />
      <Vignette offset={0.3} darkness={0.65} />
      <Noise opacity={0.03} premultiply />
      <primitive object={shoulderEffect} />
    </EffectComposer>
  );
}
