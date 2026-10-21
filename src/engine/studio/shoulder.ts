import * as THREE from 'three';

/**
 * The renderer's CustomToneMapping: Khronos PBR Neutral (three's
 * NeutralToneMapping) without its toe. Below 0.8 a colour is drawn as it is,
 * so a lacquer lit to its own colour renders as that colour, deep purples
 * included; above, the highlights roll off and desaturate as Neutral's do.
 * Exported for the post chain's last effect (src/scene/ShoulderToneMapping),
 * which runs this very source on the composer's linear buffer.
 *
 * It lived in milestone 1's CompassStudio, since removed; the tone mapping is
 * the one part of that studio the v3 stage still uses, so it stands alone
 * here, byte for byte.
 */
export const SHOULDER = /* glsl */ `vec3 CustomToneMapping( vec3 color ) {
	const float StartCompression = 0.8;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}`;

/** Puts SHOULDER in three's tone mapping chunk (once), for every program compiled after. */
export function shoulder(): void {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  const plain = 'vec3 CustomToneMapping( vec3 color ) { return color; }';
  if (chunk.includes(plain)) THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(plain, SHOULDER);
}
