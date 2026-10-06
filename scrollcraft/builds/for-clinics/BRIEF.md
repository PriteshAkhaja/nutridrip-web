# /for-clinics: the price splits as you scroll

**Scope (user, 6 Oct 2026):** GSAP only where required. One section gets a
moment: **"The economics"**. The hero, "What you get", onboarding, the FAQ and the
enquiry form stay as they are (a line drawn through the onboarding weeks would
repeat /how-it-works' thread, so it is not done).

**Peak.** *"The ₹8,400 bar broke into three pieces and each one dropped into its
own row: what the clinic keeps, what the drugs cost, and our share."*

**Device.** A bar for the whole session price is added at the top of the
existing card. As the card comes up the screen (a GSAP timeline scrubbed by
ScrollTrigger), each share slides from its place in the whole bar to its own
row and lands exactly on that row's bar: a share is the same fraction of the
price in both places, so it keeps its width. A share fades to a ghost while it
crosses the rows above, so it never reads as a line through their labels.
The whole bar never empties (user, 6 Oct: an empty bar beside ₹8,400 read as
zero): copies travel, and each share's part of the whole dims while its copy is
on the way and is full again once it lands. The end state is the whole price
over its three parts, the same as the reduced-motion state.
Every figure is the page's existing (indicative, labelled) split. Reduced
motion: the whole bar shows the three shares side by side; the rows as today.
