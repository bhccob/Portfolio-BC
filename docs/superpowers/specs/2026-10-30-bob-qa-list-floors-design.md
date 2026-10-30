# Round 10: the Q&A as one list, and the projects by floor

Bob, 2026-10-30, after round 9 went live (c50dea4):

> do you have better idea for the Q&A ? i find when the tower close is nice but i want you to suggest me other maybe thats
> more simple to just go through it
>
> also maybe so the camera doesnt go to the project and camera just sort of go close to the tower each floor only and
> project glows so users know where to hover theior mouse over

Shown mock-ups over the real site (`.superpowers/r10/qa-options.png`, `.superpowers/r10/floor-options.png`), he picked
**A · One list** for the Q&A, and for the projects **"Yes, but open the full page"**: floor stops only, the projects
glowing, their name on hover, and a click opens the project's full page as now, without the camera flying in.

## Today

- **The Q&A**: a gold ring round the closed stack with a mark for each of the six questions and one for the end. The
  scroll turns the ring mark by mark, seven stops, the camera close to the tower; beside it the answer of the mark it
  stands at (`src/ui/QaRing.tsx`, `src/scene/bob/qaScene.ts`, the QA units in `src/state/chapters.ts`). The last mark
  is the end: the dark comes up and the gold circle draws round "Stuur een bericht".
- **The projects**: the scroll stops at each floor (an AREA unit per category, the camera close to that board). A click
  on a project flies the camera into it, and its full page (`src/ui/ProjectView.tsx`) shows under it.

## Goals

1. **The Q&A in one stop.** The camera comes close to the tower, as today's first mark, and rests there, the ring
   turning slowly. Beside the tower (to the right on a laptop, under it on a phone) stands one list of all six
   questions; the first is open with its answer under it. A click (or Enter, Space, a tap) on a question opens its
   answer and closes the one that was open; the ring turns to that question's mark, so the tower answers the list. One
   scroll stop for the whole Q&A, then the end as today.
2. **The end as today**: the next stop after the list; the dark, the gold circle, "Stuur een bericht", its two buttons.
3. **Projects glow on their floor.** At a floor's stop its projects glow softly (a slow pulse of light round each), so a
   visitor sees where to point. Pointing at one (hover) shows its number, name and "Klik om te openen" beside it, and the
   project brightens.
4. **A click opens the full page, the camera stays.** The project's full page opens as now, over the floor, which stays
   in view behind it, dimmed; nothing flies in. "Terug naar de stack" closes the page back to the same floor.

## Non-goals

- No change to the home, the light dive, the storm, the tower's look, the rings, the end's look, the contact page or the
  light (Lite) version's Q&A.
- No new words: the questions, answers, names and buttons are the site's own (NL and EN).

## Anti-goals

- A list that hides the tower: the tower close stays the focal point; the list is quiet text beside it.
- Glow that turns the floor busy or bright: a soft pulse, under the dark gate (a still's mean luma at most 0.11).
- Losing a way in: every question and every project reachable by keyboard and by touch, as today.

## My calls

- On a phone a tap on a project opens its page straight away (there is no hover); the glow alone shows where to tap.
- The ring turning to the opened question's mark reuses today's ring and its marks; the marks' own buttons go (the list
  is the way to choose).
- The list keeps today's count line ("Q&A · 01 / 06") as its title, and the questions in their order.
- Reduced motion: the ring jumps to the opened mark, the glow stands still.

## Proof

- Unit tests for the scroll's new stops (one Q&A stop, the end after it), the list's open and close (one open at a time,
  keyboard), the ring following the opened question, the glow's levels and pulse, the hover label, and the camera staying
  at the floor while a project's page is open.
- The proof harness's Q&A, keyboard, end and project-page steps rewritten for the new flow; the full harness and the
  suite green; a review page with the site's own stills on a laptop and a phone before anything is merged.

## Left to the builder

The list's exact place and width, the glow's colour, size and pulse speed, how dim the floor goes behind a project's
page, and the ring's turning speed, all against the mock-ups and the dark gate.
