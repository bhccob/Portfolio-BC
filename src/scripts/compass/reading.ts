import { compassPoseAt, poseAt, type SectionId, type Span } from '../three/Choreography';

/**
 * Where on the scroll a section's words can be read: the choreography fades
 * each section's text in and out inside its section, so a link the keyboard
 * reaches there may be out of sight. CompassStageController moves the scroll
 * to the nearest place its words are shown. Pure, DOM-free.
 */

/** Samples per section, so a range's ends land on the choreography's own fade points (hundredths and twentieths). */
const STEPS = 400;

const ranges = new Map<SectionId, readonly [number, number] | null>();

/**
 * The part of section `id` (locals, 0..1) where its words are fully shown: the first and last sample of the longest
 * run at full opacity. Null where they never are.
 */
export function readingRange(id: SectionId): readonly [number, number] | null {
  if (ranges.has(id)) return ranges.get(id)!;
  let best: [number, number] | null = null;
  let start = -1;
  for (let k = 0; k <= STEPS + 1; k++) {
    const shown = k <= STEPS && poseAt(id, k / STEPS).text[id] >= 1;
    if (shown && start < 0) start = k;
    if (!shown && start >= 0) {
      if (!best || k - 1 - start > (best[1] - best[0]) * STEPS) best = [start / STEPS, (k - 1) / STEPS];
      start = -1;
    }
  }
  ranges.set(id, best);
  return best;
}

/**
 * The scroll progress (0..1, among `spans`) that shows section `id`'s words, from `progress`: `progress` itself where
 * they are shown there, else the point of the section's reading range nearest to it, a little inside the range. Null
 * where the spans lack the section or its words never show.
 */
export function readingProgress(id: SectionId, progress: number, spans: readonly Span[]): number | null {
  const span = spans.find((s) => s.id === id);
  const range = readingRange(id);
  if (!span || !range) return null;
  if (compassPoseAt(progress, spans).text[id] >= 1) return progress;
  const [a, b] = range;
  const inside = Math.min(0.02, (b - a) / 4);
  const local = Math.min(b - inside, Math.max(a + inside, (progress - span.start) / span.length));
  return span.start + local * span.length;
}
