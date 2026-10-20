import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { type JSX, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { COMPASS_STUDIO, shoulder } from '~/engine/studio/CompassStudio';
import { useScene } from '~/state/store';
import { ShoulderToneMappingEffect } from './ShoulderToneMapping';

/**
 * Bloom as docs/art-direction.md § 2 sets it (Ruling 22): a threshold of 1.0 in linear HDR, so only what is emissive
 * (the needle's tip, the dust, the sun) glows and a brass specular never does; mipmap blur, smoothing 0.12, radius
 * 0.6; intensity 0.7 at full resolution on high, 0.5 at half resolution on medium.
 */
const BLOOM = {
  luminanceThreshold: 1,
  luminanceSmoothing: 0.12,
  radius: 0.6,
  high: { intensity: 0.7, resolutionScale: 1 },
  medium: { intensity: 0.5, resolutionScale: 0.5 },
} as const;

/**
 * The post chain, by tier (QualityGovernor sets it):
 *   - high and medium: pmndrs `EffectComposer` (half-float buffers) with Bloom (BLOOM), Vignette, Noise (opacity 0.03,
 *     premultiplied, so it never lifts the blacks), then the shoulder tone mapping last, on the linear buffer. The
 *     renderer's own tone mapping is off meanwhile, so the shoulder is applied once.
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
  const bloom = BLOOM[tier];
  return (
    <EffectComposer frameBufferType={THREE.HalfFloatType} multisampling={tier === 'high' ? 4 : 2}>
      <Bloom
        mipmapBlur
        luminanceThreshold={BLOOM.luminanceThreshold}
        luminanceSmoothing={BLOOM.luminanceSmoothing}
        radius={BLOOM.radius}
        intensity={bloom.intensity}
        resolutionScale={bloom.resolutionScale}
      />
      <Vignette offset={0.3} darkness={0.65} />
      <Noise opacity={0.03} premultiply />
      <primitive object={shoulderEffect} />
    </EffectComposer>
  );
}
