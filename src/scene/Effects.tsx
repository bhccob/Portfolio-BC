import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing';
import type { BloomEffect, EffectComposer as EffectComposerImpl } from 'postprocessing';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { shoulder } from '~/engine/studio/shoulder';
import { useScene } from '~/state/store';
import { grabNow } from './frameGrab';
import { GAS_SLOT } from './gasPass';
import { ShoulderToneMappingEffect } from './ShoulderToneMapping';
import { LOOK } from './bob/look';

/**
 * The bloom's strength: LOOK's intensity, at full resolution as on the high tier, or at half or less. Its threshold (0.7 in
 * linear HDR: only what glows past it blooms, the engraving's lines, the laser's point and its sparks, the tunnel's light;
 * never a gold specular), smoothing and radius are LOOK's.
 */
const bloomStrength = (scale: number): number => (scale >= 1 ? LOOK.bloom.intensity.high : LOOK.bloom.intensity.medium);

/**
 * The post chain, by tier (QualityGovernor sets it), milestone 1's chain with the numbers of LOOK
 * (src/scene/bob/look.ts):
 *   - high and medium: pmndrs `EffectComposer` (half-float buffers) with the nebula's gas first, in a slot that stands
 *     in the chain from its start and runs the gas once the Void has built it (src/engine/bob/build/volume.ts,
 *     ./gasPass.ts: marched after the scene, each ray stopped at the scene's depth, so it blends into the stack; Bob,
 *     2026-10-29), Bloom (BLOOM), Vignette, Noise (premultiplied, so it never lifts the
 *     blacks), then the shoulder tone mapping last, on the linear buffer, at LOOK.exposure. The renderer's own tone
 *     mapping is off meanwhile, so the shoulder is applied once.
 *   - no composer at all (`composer` off in the store: a page view that started on the low tier): the renderer tone-maps
 *     in every material with the shoulder as its CustomToneMapping at LOOK.exposure (revision 4's path).
 * A page view that started higher keeps the chain to its last step: taking it away means every material in the scene
 * compiling again, seconds of frozen page in the middle of the story. What changes on the way down changes in place
 * (`post`): the MSAA and the bloom's size, neither of which compiles a thing.
 */
export function Effects(): JSX.Element | null {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const composer = useScene((state) => state.composer);
  const post = useScene((state) => state.post);
  // What the chain is built with: later rungs change it in place, and a change of its props would build it all again.
  const [built] = useState(post);
  const chain = useRef<EffectComposerImpl | null>(null);
  const bloom = useRef<BloomEffect | null>(null);
  const shoulderEffect = useMemo(() => new ShoulderToneMappingEffect({ exposure: LOOK.exposure }), []);

  useEffect(() => {
    if (chain.current) chain.current.multisampling = post.samples;
    if (bloom.current) {
      bloom.current.resolution.scale = post.bloom;
      bloom.current.intensity = bloomStrength(post.bloom);
    }
    invalidate();
  }, [post, invalidate]);

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

  if (!composer) return <FrameGrab renders />;
  return (
    <>
      <FrameGrab renders={false} />
      <EffectComposer ref={chain} frameBufferType={THREE.HalfFloatType} multisampling={built.samples}>
        <primitive object={GAS_SLOT} />
        <Bloom
          ref={bloom}
          mipmapBlur
          luminanceThreshold={LOOK.bloom.threshold}
          luminanceSmoothing={LOOK.bloom.smoothing}
          radius={LOOK.bloom.radius}
          intensity={bloomStrength(built.bloom)}
          resolutionScale={built.bloom}
        />
        <Vignette offset={LOOK.vignette.offset} darkness={LOOK.vignette.darkness} />
        <Noise opacity={LOOK.noise} premultiply />
        <primitive object={shoulderEffect} />
      </EffectComposer>
    </>
  );
}

/**
 * The frame grab (./frameGrab.ts, round 14): right after the frame is drawn, while the canvas's buffer still holds it, a
 * grab asked for gets it. After the composer's render (its priority 1); on the low tier, with no composer, it draws the
 * frame itself first, as R3F would (a subscriber with a priority takes R3F's own render over).
 */
function FrameGrab({ renders }: { renders: boolean }): null {
  useFrame(
    ({ gl, scene, camera }) => {
      if (renders) gl.render(scene, camera);
      grabNow(gl.domElement);
    },
    renders ? 1 : 2
  );
  return null;
}
