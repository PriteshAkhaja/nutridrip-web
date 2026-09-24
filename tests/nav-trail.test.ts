import { describe, expect, it } from "vitest";
import { backFor, recordVisit } from "@/lib/nav-trail";

const TODAY = { href: "/nurse", label: "Back to today" };

describe("back buttons", () => {
  it("goes back to where the page was opened from", () => {
    const t = recordVisit({}, "/nurse/schedule?day=2026-09-25", "/nurse/session/b1/report");
    expect(backFor(t, "/nurse/session/b1/report", TODAY)).toEqual({ href: "/nurse/schedule?day=2026-09-25", label: "Back to the schedule" });
  });

  it("keeps the way in when coming back from one of the page's own screens", () => {
    let t = recordVisit({}, "/nurse/schedule", "/nurse/session/b1");
    t = recordVisit(t, "/nurse/session/b1", "/nurse/session/b1/vitals");
    t = recordVisit(t, "/nurse/session/b1/vitals", "/nurse/session/b1");
    expect(backFor(t, "/nurse/session/b1", TODAY).href).toBe("/nurse/schedule");
    expect(backFor(t, "/nurse/session/b1/vitals", TODAY)).toEqual({ href: "/nurse/session/b1", label: "Back to the checklist" });
  });

  it("the latest way in wins", () => {
    let t = recordVisit({}, "/nurse/schedule", "/nurse/session/b1/report");
    t = recordVisit(t, "/nurse", "/nurse/session/b1/report");
    expect(backFor(t, "/nurse/session/b1/report", TODAY).href).toBe("/nurse");
  });

  it("falls back to the usual parent when opened fresh, or from outside the app", () => {
    expect(backFor({}, "/nurse/session/b1/report", TODAY)).toEqual(TODAY);
    const t = recordVisit({}, "/app/sessions", "/nurse/session/b1/report");
    expect(backFor(t, "/nurse/session/b1/report", TODAY)).toEqual(TODAY);
  });

  it("works the same in the patient app", () => {
    const t = recordVisit({}, "/app", "/app/report/b1");
    expect(backFor(t, "/app/report/b1", { href: "/app/sessions", label: "Back to sessions" })).toEqual({ href: "/app", label: "Back to home" });
  });
});
