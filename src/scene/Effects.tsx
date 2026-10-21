import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import { type JSX, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { shoulder } from '~/engine/studio/shoulder';
import { useScene } from '~/state/store';
import { ShoulderToneMappingEffect } from './ShoulderToneMapping';
import { LOOK } from './v3/look';

/**
 * Bloom by tier, milestone 1's resolutions with LOOK's numbers: mipmap blur, a threshold of 1 in linear HDR (only what
 * is emissive past it glows: the laser's point, the power-on pins, a pointed star; never a gold specular), LOOK's
 * smoothing and radius, and LOOK's intensity at full resolution on high and at half on medium.
 */
const BLOOM = {
  high: { intensity: LOOK.bloom.high, resolutionScale: 1 },
  medium: { intensity: LOOK.bloom.medium, resolutionScale: 0.5 },
} as const;

/**
 * The post chain, by tier (QualityGovernor sets it), milestone 1's chain with the v3 numbers of LOOK
 * (src/scene/v3/look.ts):
 *   - high and medium: pmndrs `EffectComposer` (half-float buffers) with Bloom (BLOOM), Vignette, Noise (premultiplied,
 *     so it never lifts the blacks), then the shoulder tone mapping last, on the linear buffer, at LOOK.exposure. The
 *     renderer's own tone mapping is off meanwhile, so the shoulder is applied once.
 *   - low: no composer at all; the renderer tone-maps in every material with the shoulder as its CustomToneMapping at
 *     LOOK.exposure (revision 4's path).
 */
export function Effects(): JSX.Element | null {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const tier = useScene((state) => state.tier);
  const composer = tier !== 'low';
  const shoulderEffect = useMemo(() => new ShoulderToneMappingEffect({ exposure: LOOK.exposure }), []);

  // A primitive is not R3F's to dispose.
  useEffect(() => () => shoulderEffect.dispose(), [shoulderEffect]);

  useEffect(() => {
    if (composer) {
      gl.toneMapping = THREE.NoToneMapping;
    } else {
      shoulder();
      gl.toneMapping = THREE.CustomToneMapping;
      gl.toneMappingExposure = LOOK.exposure;
    }
    invalidate();
  }, [composer, gl, invalidate]);

  if (!composer) return null;
  const bloom = BLOOM[tier];
  return (
    <EffectComposer frameBufferType={THREE.HalfFloatType} multisampling={tier === 'high' ? 4 : 2}>
      <Bloom
        mipmapBlur
        luminanceThreshold={LOOK.bloom.threshold}
        luminanceSmoothing={LOOK.bloom.smoothing}
        radius={LOOK.bloom.radius}
        intensity={bloom.intensity}
        resolutionScale={bloom.resolutionScale}
      />
      <Vignette offset={LOOK.vignette.offset} darkness={LOOK.vignette.darkness} />
      <Noise opacity={LOOK.noise} premultiply />
      <primitive object={shoulderEffect} />
    </EffectComposer>
  );
}
