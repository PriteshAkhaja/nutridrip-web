# /about: the mission lights up as you read it

**Scope (user, 6 Oct 2026):** GSAP only where required. One section gets a
moment: **"A procedure, not a treat"** (the mission statement). Everything else on
the page stays as it is.

**Peak.** *"The mission statement lit up word by word as I read it."* The page's
quietest moment, on purpose: it is a page about who we are.

**Device.** The paragraph is editable copy (`about.mission`), so its words are
wrapped at run time, whatever an admin writes. Each turns from the muted ink
(`--color-ink-3`, 4.6:1 on mist, readable before it lights) to full ink in
reading order as the paragraph crosses the screen (a GSAP stagger, scrubbed).
The text never changes, so screen readers read one sentence. Reduced motion:
the paragraph in full ink, as today.
