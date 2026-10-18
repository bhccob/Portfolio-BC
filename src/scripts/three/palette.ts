/**
 * The device's colours as three.js hex numbers. They are the site's own
 * tokens (src/styles/tokens.css), so the model and the page around it agree.
 */
export const palette = {
  /** Board purple (--board): the back plate. */
  board: 0x1c1030,
  /** The deepest board purple (--board-deep): the screen module and recesses. */
  boardDeep: 0x140a24,
  /** Signal yellow: the power ball and the battery band. */
  yellow: 0xffcf33,
  /** Cream: the controls, the battery and the screws. */
  cream: 0xf1e8d3,
  /** PCB purple: the shell and the board. */
  pcb: 0x4b2a8a,
  /** Gold contacts: pins, traces and tabs. */
  gold: 0xd9a520,
  /** Dim lilac (--dim, the site's quiet text): the empty socket's outline. */
  lilac: 0x9789bb,
  /** Near-black (--split): chip bodies and the screen while it is off. */
  ink: 0x0b0516
} as const;
