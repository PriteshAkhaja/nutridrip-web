# /how-it-works: a thread through the seven people

**Scope (user, 6 Oct 2026):** GSAP only where required. `/how-it-works` is a Full
page with no moment of its own; one section gets one: **"One session, start to
finish"** (the seven steps). The hero, "Inside the session" and the close stay as
they are. The home page's "How it works" uses the same component and stays in
its plain mode.

**Peak.** *"A line drew itself down through the seven steps as I read, and the
picture beside it changed with it."*

**Device.** A thread in a gutter beside the steps grows (scaleY) from the first
numbered circle to the last as a reading line at mid-screen moves through the
list (GSAP ScrollTrigger, 0.4 s scrub). Circles above the line are ringed in the
accent, the one being read is filled. The sticky picture cross-dissolves into
the next over the last 18% of each step and settles (scale 1.05 to 1) while its
step is read; the bars under it follow. The gutter layout is server-rendered for
this page, so nothing moves when the script starts. No pin; different from
/safety (no ticked rows, no segment bars). Reduced motion: the thread is drawn,
the pictures swap as today.
