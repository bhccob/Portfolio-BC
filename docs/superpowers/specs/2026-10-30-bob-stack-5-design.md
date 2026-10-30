# Stack round 5: the tower 25% nearer

Bob, 2026-10-30, after round 4 went live (1b4c104):

> nice but now can the tower be a bit z oomed in in general?

He was shown the tower at its four rests (the world's stop, a board, the look back, the questions) on a laptop and a
phone, now, 12% nearer and 25% nearer (a throwaway copy of the site with the zoom read from the page's storage,
`.superpowers/zoom-review/`), told that on a phone the tower already fills the screen and nearer crops its top and
bottom, and answered "25% closer".

## What changes

- `TOWER_ZOOM` = 1.25 (src/scene/bob/worldPath.ts): every view of the tower, on every screen, comes in along its own
  line to 1/1.25 of the distance its fit gives, the field of view unchanged: the world's stop, each board's stop, the
  look back and the ring's view through the questions. The landing's close view on the light coming in is not a view of
  the tower and stays; the pull back from it ends at the nearer world's stop.
- The fits themselves (the mock-up's boxes) are unchanged; `makeWorldPath(aspect, chapters, { zoom: 1 })` gives them,
  and the framing tests still hold them.
- A project's name on the world keeps its words wholly inside the screen when its object stands near the edge the
  words run back from (src/ui/nameLine.ts), as its end always was: with the tower nearer, a board with three projects
  on a phone put one name 27 px past the right edge.
- The proof harness reads the Q&A's end mark at rest (its dark up and its circle drawn, 3.4 s), as its stills step
  already did; half a second in it read the fade halfway (0.298, then 0.278 with the tower nearer, against a floor of
  0.3; 0.642 at rest).
