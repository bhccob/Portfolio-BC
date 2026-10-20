/**
 * The eleven parts of the compass, in the order the dissect takes them apart
 * (docs/art-direction.md § Copy budget, "Compass parts"): the lid comes off first,
 * the housing, which becomes the hard drive, last. Their names and lines are
 * `needle.parts` in the dictionaries.
 */
export const PART_IDS = ['lid', 'rim', 'crystal', 'strings', 'bagua', 'degrees', 'dial', 'jewel', 'needle', 'plate', 'housing'] as const;

export type PartId = (typeof PART_IDS)[number];
