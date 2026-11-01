# Round 17: the signal loader

Date: 2026-11-01. Branch: `bob-r17`, off `main` at 8e4fade (round 16, live). The sketch is
`.superpowers/r17/index.html` with `loaders.js` (`signal`), drawn in 2D over today's loader stills.

## Why

Bob: "can you come up with an unique loader for my portfolio tailored to my career". Of three sketches (secure boot,
signal, pipeline) he picked "B · Signal". The loader says what he wants to do: embedded work, where a person reads what
a wire says with a logic analyzer.

## What it is

On a first visit, before the compass, one gold line runs across the dark glass, as a logic analyzer draws a wire.
It starts as noise. As the site loads, a cursor sweeps it left to right; behind the cursor the line becomes clean
digital pulses, real UART frames of the bytes of "BOB CHUNG", and under each frame its letter and its code are read
out (`B 42`, `O 4F`, … `G 47`). When the whole name is read, the line flattens onto the glass and curls round into the
circle, the O, exactly where today's laser cuts it. From there the loader goes on as today: the ticks and the outer
ring grow, the iris opens, the compass rises and the camera settles at the home.

## Goals

1. The full loader (a first visit) plays the signal in place of today's laser descent and circle cut.
2. The signal is honest: the pulses are the real UART encoding of the letters (idle high, a start bit, eight data bits
   lowest first, a stop bit), the read-out matches them, and the read keeps pace with the real load, waiting before
   the last letter while the site is still loading.
3. The hand-over is seamless: the curled line becomes the engraving's circle, and everything after it is today's.

## Not in this round

- The quick path (a returning visitor) and the reduced-motion path stay as they are: no engraving, no signal.
- Nothing after the loader changes. The BOB, the tower, the dial and the rest stay.
- No other copy changes.

## Must not happen

- Busy or bright: one thin gold line, small quiet words, the dark kept; the line is the one focal point.
- A loader that feels slower for nothing: a skip still jumps ahead as today.
- A read-out that is wrong: no invented bytes, no letters that don't match the pulses.

## Constraints

- The words are the hero's `name` (`BOB CHUNG`, src/i18n) read out as bytes, and one label, `CH0 · UART`, as an
  analyzer names a channel. Both are the same in Dutch and English.
- Reduced motion keeps today's reduced path. Any input skips, as today (`LOADER.skip`).
- `.impeccable/config.json` is never edited. No subagents. Commit trailer:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Pushing or merging only on Bob's word.
- The proof harness (`tools/proof/needle.mjs`) is updated for what changes and stays green.

## The timing

Today's full script (`src/engine/bob/loaderTimeline.ts`, 24 fps) runs the probe's descent (frames 1-26) and the circle
cut (26-74), then the ticks, ring, iris, light, rise, push-in and settle, home at frame 150 (6.25 s). The signal takes
the place of the descent and the cut:

| span | frames | what happens |
| --- | --- | --- |
| `lineIn` | 1-20 | the world fades up from black; the line comes in as noise, with its label |
| `decode` | 20-92 | the cursor sweeps left to right; behind it the pulses come clean and each letter is read out under its frame |
| `curl` | 92-110 | the read-out goes; the pulses flatten onto the glass and the line curls round into the circle |

Everything after it runs as today, 36 frames later: the ticks, the outer ring, the iris, the light, the rise, the
push-in and the settle, home at frame 186 (7.75 s, 1.5 s longer than today). The circle counts as cut at the end of
`curl`.

The load: today the script holds at 92 % of the circle cut while the site is still loading, the laser creeping on.
The signal holds at 92 % of `decode` instead, the cursor creeping on just short of the last letter, and goes on once
the load lands. A fast load never shortens it, as today.

## How it looks

- **The camera** stands at today's wide shot through the whole signal (its push-in starts after, with the rest).
- **The line** lies along the glass's x axis through the compass's centre, from −3.6 m to +3.6 m: the wide shot fits
  ±4.0 m to the screen's edges on every screen, so the line covers the middle nine tenths of its width (the sketch:
  80 to 1360 of 1440). It is drawn as the engraving's circle is: the
  same gold, the same width, unlit. A high level stands a little above the glass (about 0.2 m), a low level on it, so
  the pulses stand up off the glass in the camera's view.
- **The noise** right of the cursor is a soft, small jitter round the middle level, moving.
- **The cursor** is a thin, faint upright line with a little glow where it meets the line.
- **The frames**: the bytes of `BOB CHUNG`, idle high between them, laid evenly over the line's length (the sketch:
  6 idle bits first, then each byte's 10 bits and 3 idle bits).
- **The read-out**, in the page over the canvas (crisp text, `aria-hidden`), in Martian Mono, small and quiet, in the
  site's gold ink: `CH0 · UART` above the line's left end; under each frame, once the cursor has passed it, a thin
  rounded box with its letter and its code (`B  42`; the space as `␣  20`); and when the last letter is read, the
  name `BOB CHUNG` under the middle. On a phone, a box shows its letter alone if its code does not fit.
- **The curl**: the read-out fades; the pulses flatten to the glass as the line's points move onto the circle
  (`WORDMARK.circle`, the circle the engraving's tube follows), the line's start at the circle's front; at the end
  the line is hidden and the engraving's circle is shown whole.
- **The probe** does not come down on the full path.

## Proof

- The timeline's unit tests: the new spans, the hold at 92 % of `decode`, home at 186 frames, the circle counting as
  cut only at the end of `curl`, the quick and reduced paths unchanged.
- A unit test that the frames are right: each byte's ten bits are a start bit, its code lowest bit first, a stop bit,
  and the read-out's codes are those bytes.
- The harness's loader steps updated for the new script (the stills, the skip, the load held short of the end); a
  still of the read-out half way and one of the curl.
- A review page with the real loader's recording, today's and round 17's, side by side, before Bob is asked to merge.

## Left to the builder

- How the line is drawn in three (a ribbon facing the camera, or a tube rebuilt as it changes), as long as it reads as
  the engraving's stroke.
- The noise's shape, the cursor's glow, and the read-out's exact sizes and placement on each screen.
- Whether the probe's model is still built for the full path or left out of it.
