# Stack round 4: the slow power-on, and Jontai Energy's redesign

Bob, 2026-10-30, after round 3 went live (3eac0fc):

> when the light falls and reaches the tower make it so when it reach the cpu chip it slowqly powers (light on) the
> tower and also the picture of jontai energy should be changed to new one

and, on what the power-on should be:

> i just want the light thta flalls down when it reach the chip it then slowly power and lights up the tower whille
> slowly zooming out

He was shown a mock-up (a throwaway copy of the site, `.superpowers/power-on-review/`, frames side by side with the
live site) and answered "Yes, build it"; for Jontai Energy he was shown the redesign's first screen and answered
"Yes, and update its text".

## 1. The slow power-on

Before: within about four scroll notches of the light reaching the CPU, the tower opened, the camera pulled back, the
rings and the nebula came in and the power ran down the boards, all at once; the boards never looked switched off.

Now (the mock-up's values, built test first):

- The land is `LAND_DROP` (1.26, unchanged) to the hit and 2.2 units after it, where it had 1.17; every later stop is
  1.03 units further on, the world's stop 1.0 (it stands 1.9 units after the hit, where it stood 0.9).
- The tower is dark until the light is in the CPU: a board's body keeps `PLATE_LOOK.dark` (0.22) of its light with no
  power, and its power, the rings and the spine's light are 0 through the hit.
- The power runs over 1.6 units (`POWER`, 0.05 to 1.65 after the hit; was 0.72), board by board from the top, each
  board starting as the one above it is half lit (`POWER_LAG` 0.5, was 0.32).
- The power's front runs out over each board brighter (3.0 where it was 1.3, with a faint ring of its own) and the
  copper just behind it surges and settles, so the light is seen running out from the CPU.
- The stack opens over the power's middle (`EXPLODE` 0.45 to 1.5 after the hit); the flash is gone 0.4 after it; the
  names come in once the last board is lit (1.65).
- The camera's pull back from the light in the CPU to the whole machine runs from the hit to the world's stop, 1.9
  units, so it is still moving while the boards light.

## 2. Jontai Energy

Bob's Jontai-Energy repository (github.com/bhccob/Jontai-Energy) is now a concept redesign of the store's website
(Next.js; "one day of Aruban sun"); the portfolio described the old static site (HTML, Tailwind, three languages,
sixteen pages).

- The picture: the redesign's first screen at dawn, 1440x900, run from a scratch copy of its last commit (9546f43) once
  the sunrise has played; its "Concept redesign, not the official Jontai Energy site" notice is in the picture.
- The words, tools and test points from the redesign's own PRODUCT.md, design spec and package.json, nothing added: a
  concept website redesign and a personal project; the day film, the product panels with figures only from
  manufacturer documents, the 3000 K to 6500 K bulb slider, the quote request; Next.js, React, TypeScript, GSAP, Lenis,
  Blender. No live link (the redesign is not published, and jontaienergy.com is not Bob's build).
- Kept: the solar module object, its palette and motion; the role ("Design & front-end development"); the old
  screenshot `jontai-energy.png` and its alt text, which no page shows.
