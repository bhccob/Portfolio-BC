# BOB · the end of the scroll: questions and a message

*2026-10-24. This document builds on the BOB compass design (`2026-10-21-bob-compass-design.md`), especially §2.3, "The scroll's stretches" and "The pace", and §2.4. Everything that one says still holds unless this one says otherwise.*

## Intent

Bob, 2026-10-24:
- "at the end of viewing the project just make it smooth transition to a normal page 2D of Q&A and the email me page"
- "they just reach the end of the website where there's Q&A about myself, put placeholder questions for now"

Today the home's scroll ends on the last project bead, Cookies Clicker, and simply stops. A visitor who has seen the work has nowhere to go next. The end of the site should be a calm, ordinary page: questions about Bob, then a way to send him a message. Scrolling on past the last bead should arrive there.

**Approved look.** Bob picked way **A, "into the night"**, from the mock-ups in `bob-end-page.html` on the companion (2026-10-24):
- **Start:** resting at Cookies Clicker.
- **Middle:** the void sinks into the site's night while the page rises from below.
- **End:** a normal page on the night, with the 3D asleep behind it.

The same mock-up shows the page itself on a laptop and on a phone.

## Goals

1. **One more stop after Cookies Clicker: the end page.** The scroll's stops become:
   - 0: home
   - 1: BOB from above
   - 2: the overview
   - 3–5: the three beads
   - 6: the end page

   The spec's "six stops in all" becomes seven.
   - The move from Cookies Clicker to the end page is way A. It is damped and never a jump. It takes about as long as a move between beads (about 2.5 s), and it turns back at once when the visitor reverses, as every move in the void now does.
   - Scrolling back up from the top of the end page reverses the move to Cookies Clicker.
   - Every input reaches it as it reaches the beads: the wheel, the keys (an arrow, Page Down and Space step to it, End goes to it, Home goes back to 0), and a swipe on a phone.
2. **At the end page the page is a normal 2D page.**
   - It scrolls like any web page: the wheel, the trackpad, the keys, a swipe, the scrollbar, find-in-page and screen readers all work as they do anywhere.
   - The 3D scene is asleep behind it: it draws nothing while the page is read.
   - The header stays as it is.
3. **The page holds, in order:**
   - **A label and a title** in the style of the site's other pages: the label "Vragen" / "Questions", and the title "VRAGEN OVER MIJ." / "QUESTIONS ABOUT ME.", with the heavy gold first part and the light second part, as on the contact page.
   - **Six questions that open and close.** One is open at a time, and a closed one shows only its question. The placeholder questions (Bob's real ones come later) are:

     | NL | EN |
     | --- | --- |
     | Wie ben je? | Who are you? |
     | Wat studeer je, en waar? | What do you study, and where? |
     | Welke rol zoek je? | What role are you looking for? |
     | Met welke talen en tools werk je het liefst? | Which languages and tools do you like working with most? |
     | Hoe werk je het liefst? | How do you like to work? |
     | Ben je beschikbaar voor een stage of een baan? | Are you available for an internship or a job? |

     Each answer is missing for now. A missing answer shows "Antwoord volgt." / "Answer to follow." in the dim secondary colour, with a small "placeholder" tag beside it. When Bob sends an answer, it replaces the placeholder with no other change.
   - **The message part**, under the title "STUUR EEN BERICHT." / "SEND A MESSAGE.":
     - the contact page's intro line, its form and its direct links (GitHub, Instagram, email);
     - the same form component and the same sending as `/contact/`, so a message goes where it goes today.
4. **Both languages.** NL at `/` and EN at `/en/`, with every word in the dictionaries.
5. **The page is in the HTML.** The questions, the placeholders and the form are server-rendered into the home's prerendered page, so they exist without JavaScript and for crawlers, like the home's project links.
6. **The page is reachable when the scene cannot take the visitor there.**
   - **3D switched off, no WebGL, or the fallback card.** These all put the site in its 3D-off state, where the home scrolls natively. The end page's content sits in the normal flow of the home, after the project links that `.home-nav` shows then.
   - **The void's files failing while 3D is on.** Here the scroll holds at BOB from above and `.home-nav` stands fixed at the foot of the screen. That nav gains one more link, "Vragen & contact" / "Questions & contact", which takes the visitor to the end page by the step fade (out, the story placed at the end page, in), never by a camera move through a void that is not there. Back up from the end page then returns to BOB from above, by the same fade.
7. **Reduced motion.** The step fade replaces the move, both in and out, as it does for every stop.

## Non-goals

- **The real questions and answers.** Bob sends these later. The placeholders are built so his text drops in.
- **Changes elsewhere.** `/contact/`, the header's links, the Lite page, and the project pages stay as they are.
- **Anything new in the scene.** The end page only puts the void to sleep behind it.
- **The project interiors (M3), Lite (M5) and sound.**

## Anti-goals

These would make it a failure even if it worked:
- **An answer that invents a fact about Bob.** Until he sends one, an answer is a plainly marked placeholder.
- **A busy or bright moment.** The move is calm, and the page is the one focal point. Nothing animates behind the text while it is read.
- **A trap.**
  - A visitor who cannot scroll the page.
  - A visitor who cannot get back up to the beads.
  - A scroll that fights the visitor at the seam between the page and the void, for example by bouncing, jumping, or taking over the scroll while the page is being read.
- **The message form behaving differently** from the contact page's form.

## Constraints

Everything binding on M2b still binds here:
- the strict CSP
- the luma gate for the home's stills, and the end page's stills are judged as page stills
- NL as the default
- formal copy
- the Cookies Clicker classmate is never named
- the pace rules (§2.3 "The pace")
- the scroll's one shot writer
- the one pose per frame
- the hold while the void loads
- the harness passing in full

## Decided by Bob

- The end page exists and sits after the last bead.
- It holds the Q&A first, then the message part.
- It uses placeholder questions for now.
- The way in is A, "into the night".

## My calls (Bob may change any)

- **Six placeholder questions.** The wording is in the table above. They are ordinary questions a visitor might ask, and no answer is given.
- **One open at a time, none on arrival.** Only one question is open at a time, and none is open when the page arrives (the mock-up's full-page frame opened the first only to show what an answer looks like).
- **The placeholder tag shows while an answer is missing.** The site is not live, and the tag keeps a placeholder from reading as a real answer.
- **No intro line** under the title until Bob writes one. The mock-up showed a placeholder line there; leaving it out shows one fewer placeholder.
- **The header and `/contact/` are unchanged.** The header's Contact link still opens `/contact/`.
- **The message part reuses the contact page's form and links.** It is not a second form. The real form wins over the mock-up: it keeps its own "Jouw bericht" heading, the optional subject and the privacy line.
- **A failed void reaches the end page by a link and a fade** (goal 6). It is the cheapest way that never shows an empty void.
- **The arrival keeps a faint, still trace of the void at the top.** It is about 14 % strong and fades into the night over the top third, as the mock-up's end frame shows, so the page reads as standing over the scene. The scene is asleep and draws nothing new.

## The visual reference

The approved mock-up is `.superpowers/brainstorm/2211-1792824374/content/bob-end-page.html` in the main checkout. It is git-excluded, and its stills `end-cookies-1440.png` and `end-cookies-390.png` sit beside it. It defines the page's column, the rows of questions (hairlines between them, a gold + and −, the pill-shaped placeholder tag) and the three frames of way A. Where it differs from this document, this document and the real `ContactForm` win.

## Left to the builder

- How scrolling hands over at the seam between the scroll input and the browser's own page scroll, in both directions, within the anti-goals.
- What the camera does during the move and at the end page, within way A (for example, it holds Cookies Clicker's shot as the void sinks).
- The DOM and the components.
- How the questions open (for example `<details>`, or buttons with `aria-expanded`), as long as it is accessible and one is open at a time.
- The chapter and stop structure in code.
- The exact durations within the pace rule.
- The harness steps that prove it: reaching the end by real input at the three sizes, scrolling the page, coming back up, 3D off, the void failing, reduced motion, and EN.
