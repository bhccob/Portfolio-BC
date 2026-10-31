# The way out (round 14)

Bob, 2026-10-31, after the mock-ups in `.superpowers/r14/` (served on 4475): "the blueprint C looks hella nice",
"into the stars", "yes the q1 is nice", "i like through the end … slightly more seamless and put everything
together", then on `all.html`: "Yes, build it".

## What it is

The end of the projects becomes one piece, built into the site exactly as `.superpowers/r14/all.html` plays it:

1. **The blueprint.** From the last floor's stop, one scroll: the tower turns into a gold line drawing of itself
   (the edges of the very frame on the screen), the scene goes dark under it, and the lines fly off as sparks.
   Half the sparks become the Q&A's stars and half build the Q&A's panel, which comes in with question 1 open.
2. **The Q&A in the stars.** The tower is gone. Gold stars twinkle over the dark, the list stands where it stands
   now (the dark panel with gold corners, the light down its line), and a gold circle round the middle of the
   screen closes a little with each question: (k + 1) / 7 of it at question k + 1, drawn counter-clockwise from
   the top, a mark for each question and one for the end, lit once passed, its head a bright star.
3. **Through the ring.** From question 6, one scroll: the list drifts toward the camera and blurs away, its light
   flies to the circle's head and runs round the rest, and the camera flies through the circle, one sky, stars
   streaking and then slowing to a drift. A thin ring grows round Bob's mark as it slows.
4. **The new end.** In the middle of the calm sky: Bob's chbc mark (white, 52 px, no effect on the mark itself),
   "Einde van de site", "Stuur een bericht." in gold capitals, Bob's line, and the two buttons as gold pills,
   each coming in a little after the one above.

Back up from the end goes to question 6; up from question 1 goes back to the last floor (each played back, faster).

## Goals and anti-goals

- The mock-up's look and timing, numbers for numbers (its clock: the blueprint 6.4 s, the flight 4.8 s).
- Dark, calm, one focal point; nothing bright behind the words.
- Anti-goals: the logo glowing or recoloured; the tower or the 3D ring showing in the Q&A; a stuck step (a scroll
  that does nothing); the end's words unreadable on a phone.

## Decisions (mine, from the mock-up and the site)

- The look back (LOOK) and the 3D gold ring, its stars and its drift go: the blueprint takes their place. The
  Q&A's door is the last floor's stop: a scroll down there plays the blueprint as one step, as the questions step.
- The blueprint and the flight are steps of the Q&A, the turn's eased place inverted to the mock-up's clock, so
  each plays as the mock-up did and plays back when the scroll goes up (2.4 s back). Input waits while either plays.
- The sky is one 2D canvas over the scene (as the mock-up drew it), drawn from the scroll's place each frame; the
  stars twinkle on the world's clock (still with reduced motion). The edges come from the frame on the screen,
  grabbed once after the render when the blueprint first needs them, Sobel in gold.
- The 3D scene holds the last floor under the sky; the floor's own words (its caption, dots, skip, names) fade as
  the drawing takes over, and nothing in the scene can be pointed at past the door.
- The end's words move out of the panel to the middle of the screen; the dark veil and the CSS circle of round 4
  go (the flight is the end's circle now). The ring round the mark is its own element, never the mark.
- Phone: the circle smaller and higher, the panel where it stands now; stars and sparks by the screen's area, half
  on the low tier.
- Reduced motion: steps jump (no blueprint or flight played), the stars still, the end's words without blur.
