/**
 * Thin line-art icons on a 24×24 grid, drawn with `currentColor` strokes.
 * Maths, tech and sports, kept deliberately minimal.
 */
export const icons = {
  pi: '<path d="M4.5 7.5h15M9 7.5v11M15 7.5v8.4c0 1.6.9 2.6 2.4 2.6"/>',
  sigma: '<path d="M17.5 5H6.5l6.5 7-6.5 7h11"/>',
  integral: '<path d="M16.5 4.2c-.4-.9-1.4-1.4-2.4-1-1.3.5-1.8 1.9-1.8 3.8v10c0 1.9-.5 3.3-1.8 3.8-1 .4-2-.1-2.4-1"/>',
  sqrt: '<path d="M2.5 13h3l3 7 5-16h8"/>',
  infinity:
    '<path d="M12 12c-2-2.6-3.6-4-5.6-4a4 4 0 1 0 0 8c2 0 3.6-1.4 5.6-4zm0 0c2 2.6 3.6 4 5.6 4a4 4 0 1 0 0-8c-2 0-3.6 1.4-5.6 4z"/>',
  sine: '<path d="M2 12c1.7-4.6 3.3-4.6 5 0s3.3 4.6 5 0 3.3-4.6 5 0 3.3 4.6 5 0"/>',
  chip:
    '<rect x="6" y="6" width="12" height="12" rx="1.6"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9 2.5V6M12 2.5V6M15 2.5V6M9 18v3.5M12 18v3.5M15 18v3.5M2.5 9H6M2.5 12H6M2.5 15H6M18 9h3.5M18 12h3.5M18 15h3.5"/>',
  braces:
    '<path d="M8.5 4C6.6 4 6 5 6 6.8v2.4C6 10.6 5 12 3.8 12 5 12 6 13.4 6 14.8v2.4C6 19 6.6 20 8.5 20M15.5 4c1.9 0 2.5 1 2.5 2.8v2.4c0 1.4 1 2.8 2.2 2.8-1.2 0-2.2 1.4-2.2 2.8v2.4c0 1.8-.6 2.8-2.5 2.8"/>',
  binary:
    '<rect x="3" y="4" width="4" height="7" rx="2"/><path d="M11 4v7M16 4v7M20.5 4v7M5 13v7M10 13v7"/><rect x="13" y="13" width="4" height="7" rx="2"/><path d="M20.5 13v7"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  plate: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="1.5 2"/><circle cx="12" cy="12" r="1.8"/>',
  paddle: '<circle cx="10" cy="10" r="6.5"/><path d="M14.6 14.6l5.2 5.2"/><circle cx="19" cy="5" r="1.6"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.6M10 2.5h4M12 2.5V6M18.2 7.3l1.4-1.4"/>',
  controller:
    '<path d="M7.2 8.5h9.6a4.2 4.2 0 0 1 4.2 4.2v1.6a2.7 2.7 0 0 1-4.8 1.7L14.8 14H9.2l-1.4 2a2.7 2.7 0 0 1-4.8-1.7v-1.6a4.2 4.2 0 0 1 4.2-4.2z"/><path d="M7.6 10.8v3M6.1 12.3h3"/><circle cx="15.6" cy="11.6" r=".6"/><circle cx="17.4" cy="13.2" r=".6"/>',
  shoe: '<path d="M3 9.5l4.5-2.7 1.8.8 2-1.6 2.6 4.6 5.2 1.4c1 .3 1.9 1.2 1.9 2.3a2.2 2.2 0 0 1-2.2 2.2H3z"/><path d="M3 19.5h18M9.5 10.5l1.2 1.5M12 9.8l1.2 1.5"/>',
  arrow: '<path d="M7 17L17 7M8 7h9v9"/>'
} as const;

export type IconName = keyof typeof icons;
