import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  hrefWith,
  pageInfo,
  pageMeta,
  pageWindow,
  parsePaging,
  stableSort,
} from "@/lib/pagination";

describe("parsePaging", () => {
  it("defaults to the first page of the default size", () => {
    expect(parsePaging({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0 });
    expect(parsePaging()).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0 });
  });

  it("reads numbers and numeric strings — a query string is always strings", () => {
    expect(parsePaging({ page: "3", pageSize: "10" })).toEqual({ page: 3, pageSize: 10, skip: 20 });
    expect(parsePaging({ page: 3, pageSize: 10 })).toEqual({ page: 3, pageSize: 10, skip: 20 });
  });

  it("makes anything unusable a first page rather than throwing", () => {
    for (const bad of [0, -1, -999, "0", "-2", "abc", "", "  ", NaN, Infinity, null, undefined, {}, [], true]) {
      expect(parsePaging({ page: bad }).page, String(bad)).toBe(1);
    }
  });

  it("rounds a fraction down", () => {
    expect(parsePaging({ page: "2.9" }).page).toBe(2);
    expect(parsePaging({ pageSize: "10.9" }).pageSize).toBe(10);
  });

  it("never lets one request ask for more than the maximum", () => {
    expect(parsePaging({ pageSize: 99999 }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(parsePaging({ pageSize: "1000000" }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(parsePaging({ pageSize: MAX_PAGE_SIZE }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("falls back to the default for a size that is not a size", () => {
    for (const bad of [0, -5, "abc", "", NaN]) {
      expect(parsePaging({ pageSize: bad }).pageSize, String(bad)).toBe(DEFAULT_PAGE_SIZE);
    }
  });

  it("caps the page, so a huge skip cannot make the database walk the collection", () => {
    const p = parsePaging({ page: 999_999_999 });
    expect(p.page).toBeLessThanOrEqual(100_000);
    expect(Number.isSafeInteger(p.skip)).toBe(true);
  });

  it("honours a list's own default and maximum", () => {
    expect(parsePaging({}, { defaultPageSize: 50 }).pageSize).toBe(50);
    expect(parsePaging({ pageSize: 80 }, { maxPageSize: 30 }).pageSize).toBe(30);
    // A default larger than the maximum cannot escape it.
    expect(parsePaging({}, { defaultPageSize: 500, maxPageSize: 100 }).pageSize).toBe(100);
  });

  it("computes the skip from the page and the size", () => {
    expect(parsePaging({ page: 4, pageSize: 25 }).skip).toBe(75);
    expect(parsePaging({ page: 1, pageSize: 100 }).skip).toBe(0);
  });
});

describe("pageMeta", () => {
  it("describes a middle page", () => {
    expect(pageMeta(137, 2, 25)).toEqual({
      page: 2, pageSize: 25, total: 137, totalPages: 6, from: 26, to: 50, hasPrev: true, hasNext: true,
    });
  });

  it("describes a short last page", () => {
    const m = pageMeta(137, 6, 25);
    expect(m.from).toBe(126);
    expect(m.to).toBe(137);
    expect(m.hasNext).toBe(false);
    expect(m.hasPrev).toBe(true);
  });

  it("does not make an empty last page when the total is an exact multiple", () => {
    const m = pageMeta(100, 4, 25);
    expect(m.totalPages).toBe(4);
    expect(m.to).toBe(100);
    expect(pageMeta(100, 5, 25).page).toBe(4);
  });

  it("is one empty page for nothing at all", () => {
    expect(pageMeta(0, 1, 25)).toEqual({
      page: 1, pageSize: 25, total: 0, totalPages: 1, from: 0, to: 0, hasPrev: false, hasNext: false,
    });
  });

  it("pulls a page past the end back to the last one", () => {
    expect(pageMeta(30, 99, 10).page).toBe(3);
    expect(pageMeta(30, 99, 10).from).toBe(21);
  });

  it("copes with a total that is not a usable number", () => {
    for (const bad of [-5, NaN, Infinity]) {
      const m = pageMeta(bad, 1, 25);
      expect(m.total, String(bad)).toBe(m.total >= 0 ? m.total : 0);
      expect(m.from).toBeGreaterThanOrEqual(0);
    }
    expect(pageMeta(-5, 1, 25).total).toBe(0);
    expect(pageMeta(NaN, 1, 25).total).toBe(0);
  });

  it("shows a single row as 1 to 1 of 1", () => {
    const m = pageMeta(1, 1, 25);
    expect([m.from, m.to, m.total, m.totalPages]).toEqual([1, 1, 1, 1]);
  });

  it("agrees with the skip that parsePaging computed, for every page", () => {
    // The footer's 'Showing 26-50' and the query's skip(25) must be the same rows.
    for (const page of [1, 2, 3, 6]) {
      const p = parsePaging({ page, pageSize: 25 });
      const m = pageMeta(137, p.page, p.pageSize);
      expect(m.from).toBe(p.skip + 1);
    }
  });
});

describe("pageWindow", () => {
  it("lists every page when there are few", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("hides the middle of a long list behind gaps, keeping the first and last", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap-start", 9, 10, 11, "gap-end", 20]);
  });

  it("keeps the strip the same length near the start", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap-end", 20]);
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, 5, "gap-end", 20]);
  });

  it("keeps the strip the same length near the end", () => {
    expect(pageWindow(20, 20)).toEqual([1, "gap-start", 16, 17, 18, 19, 20]);
    expect(pageWindow(18, 20)).toEqual([1, "gap-start", 16, 17, 18, 19, 20]);
  });

  it("always contains the current page, the first and the last", () => {
    for (const total of [8, 9, 20, 137, 5000]) {
      for (const page of [1, 2, Math.ceil(total / 2), total - 1, total]) {
        const w = pageWindow(page, total);
        expect(w, `${page}/${total}`).toContain(page);
        expect(w[0]).toBe(1);
        expect(w[w.length - 1]).toBe(total);
      }
    }
  });

  it("is strictly ascending, with a gap only where pages were skipped", () => {
    for (const total of [8, 9, 12, 20, 137]) {
      for (let page = 1; page <= total; page++) {
        const w = pageWindow(page, total);
        const nums = w.filter((x): x is number => typeof x === "number");
        expect([...nums].sort((a, b) => a - b)).toEqual(nums);
        expect(new Set(nums).size).toBe(nums.length);
        // A gap must actually hide at least two pages.
        w.forEach((item, i) => {
          if (typeof item !== "string") return;
          const before = w[i - 1] as number;
          const after = w[i + 1] as number;
          expect(after - before, `${page}/${total}`).toBeGreaterThan(2);
        });
      }
    }
  });

  it("clamps a page outside the range", () => {
    expect(pageWindow(0, 20)).toEqual(pageWindow(1, 20));
    expect(pageWindow(99, 20)).toEqual(pageWindow(20, 20));
  });

  it("widens with more siblings", () => {
    expect(pageWindow(10, 30, 2)).toEqual([1, "gap-start", 8, 9, 10, 11, 12, "gap-end", 30]);
  });
});

describe("hrefWith", () => {
  it("keeps the other filters and changes only what it is told", () => {
    expect(hrefWith("/admin/users", { role: "nurse", status: "active" }, { page: 3 })).toBe(
      "/admin/users?role=nurse&status=active&page=3"
    );
  });

  it("leaves the first page and the default size out, so the clean URL stays clean", () => {
    expect(hrefWith("/admin/users", { role: "nurse", page: "4" }, { page: 1 })).toBe("/admin/users?role=nurse");
    expect(hrefWith("/admin/users", {}, { page: 1, pageSize: DEFAULT_PAGE_SIZE })).toBe("/admin/users");
  });

  it("keeps a page size that is not the default", () => {
    expect(hrefWith("/admin/users", {}, { pageSize: 50 })).toBe("/admin/users?pageSize=50");
  });

  it("drops a filter cleared with null, undefined or an empty string", () => {
    expect(hrefWith("/x", { a: "1", b: "2", c: "3" }, { a: null, b: undefined, c: "" })).toBe("/x");
  });

  it("takes the first of a repeated query parameter", () => {
    expect(hrefWith("/x", { tag: ["a", "b"] })).toBe("/x?tag=a");
  });

  it("encodes what needs encoding", () => {
    expect(hrefWith("/x", { q: "a b&c" })).toBe("/x?q=a+b%26c");
  });

  it("does not mutate what it was given", () => {
    const params = { role: "nurse" };
    hrefWith("/x", params, { page: 2 });
    expect(params).toEqual({ role: "nurse" });
  });
});

describe("stableSort", () => {
  it("appends _id so a tie has one answer, in the direction of the sort", () => {
    expect(stableSort({ createdAt: -1 })).toEqual({ createdAt: -1, _id: -1 });
    expect(stableSort({ name: 1 })).toEqual({ name: 1, _id: 1 });
  });

  it("follows the LAST key when there are several", () => {
    expect(stableSort({ status: 1, createdAt: -1 })).toEqual({ status: 1, createdAt: -1, _id: -1 });
  });

  it("leaves a sort that already has _id alone", () => {
    expect(stableSort({ at: -1, _id: -1 })).toEqual({ at: -1, _id: -1 });
  });

  it("does not mutate the sort it was given", () => {
    const s = { createdAt: -1 as const };
    stableSort(s);
    expect(s).toEqual({ createdAt: -1 });
  });
});

describe("pageInfo", () => {
  it("is what an API sends beside its rows", () => {
    expect(pageInfo(pageMeta(137, 2, 25))).toEqual({
      page: 2, pageSize: 25, total: 137, totalPages: 6, from: 26, to: 50, hasPrev: true, hasNext: true,
    });
  });
});
