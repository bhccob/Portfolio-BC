import { describe, expect, it } from 'vitest';
import { readingProgress, readingRange } from '../../src/scripts/compass/reading';
import { compassPoseAt, nominalSpans, poseAt, SECTIONS } from '../../src/scripts/three/Choreography';

const spans = nominalSpans();
const spanOf = (id: string) => spans.find((s) => s.id === id)!;

describe('readingRange', () => {
  it('finds where each section shows its words whole', () => {
    expect(readingRange('funcial')).toEqual([0.4, 0.85]);
    expect(readingRange('next')).toEqual([0.45, 0.85]);
    expect(readingRange('offduty')).toEqual([0.55, 0.8]);
    expect(readingRange('qa')).toEqual([0, 1]);
    expect(readingRange('hello')).toEqual([0.7, 1]);
  });

  it('gives every section a range in which its words are fully shown', () => {
    for (const { id } of SECTIONS) {
      const range = readingRange(id);
      expect(range, id).not.toBeNull();
      const [a, b] = range!;
      for (const local of [a, (a + b) / 2, b]) expect(poseAt(id, local).text[id], `${id} ${local}`).toBe(1);
    }
  });
});

describe('readingProgress', () => {
  it('leaves a progress that already shows the section alone', () => {
    const span = spanOf('jontai-energy');
    const progress = span.start + 0.6 * span.length;
    expect(readingProgress('jontai-energy', progress, spans)).toBe(progress);
  });

  it('brings a section whose words are out to just inside its range, from above and from below', () => {
    for (const [from, id] of [['hero', 'funcial'], ['qa', 'cookies-clicker'], ['offduty', 'qa'], ['qa', 'hello']] as const) {
      const at = spanOf(from).start + 0.5 * spanOf(from).length;
      const progress = readingProgress(id, at, spans)!;
      const pose = compassPoseAt(progress, spans);
      expect(pose.section, `${from} → ${id}`).toBe(id);
      expect(pose.text[id], `${from} → ${id}`).toBe(1);
      const [a, b] = readingRange(id)!;
      // Near the end it came from: the start of the range coming down the page, its end coming back up.
      expect(Math.abs(pose.local - (spanOf(from).start < spanOf(id).start ? a : b)), `${from} → ${id}`).toBeLessThan(0.03);
    }
  });

  it('answers null for a section the spans lack', () => {
    expect(readingProgress('qa', 0.5, spans.filter((s) => s.id !== 'qa'))).toBeNull();
  });
});
