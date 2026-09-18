import { describe, expect, it } from "vitest";
import { csvCell, csvRow, CSV_BOM } from "@/lib/data/csv";

describe("csvCell", () => {
  it("leaves an ordinary value alone", () => {
    expect(csvCell("Dr. Sarah Menon")).toBe("Dr. Sarah Menon");
    expect(csvCell("ND-4421")).toBe("ND-4421");
    expect(csvCell(42)).toBe("42");
  });

  it("wraps anything holding a separator, a quote or a newline", () => {
    expect(csvCell("Menon, Sarah")).toBe('"Menon, Sarah"');
    expect(csvCell('He said "no"')).toBe('"He said ""no"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("wraps edge whitespace, which a reader would otherwise lose", () => {
    expect(csvCell(" padded")).toBe('" padded"');
    expect(csvCell("padded ")).toBe('"padded "');
  });

  it("writes nothing for an absent value", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    // But not for a real zero or a real false.
    expect(csvCell(0)).toBe("0");
    expect(csvCell(false)).toBe("false");
  });

  it("neutralises a cell Excel would execute", () => {
    // The attack: content typed into any form field in the app ends up in the
    // trail, and the trail gets exported and opened by an admin.
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+1234")).toBe("'+1234");
    expect(csvCell("@SUM(A1:A9)")).toBe("'@SUM(A1:A9)");
    expect(csvCell("\tinjected")).toBe("'\tinjected");

    // No quoting is added here, and that is correct: an apostrophe is not a
    // CSV metacharacter. Guarding stops Excel evaluating the cell, quoting
    // keeps the columns intact — two different jobs, neither a substitute.
    expect(csvCell("=cmd|' /c calc'!A1")).toBe("'=cmd|' /c calc'!A1");

    // Both jobs at once, when the payload also carries a comma.
    expect(csvCell("=HYPERLINK(1,2)")).toBe(`"'=HYPERLINK(1,2)"`);
  });

  it("guards a leading dash without breaking negative numbers", () => {
    expect(csvCell("-1+1")).toBe("'-1+1");
    expect(csvCell("-2-3")).toBe("'-2-3");
    // These are numbers and must stay numbers, or every figure in the sheet
    // arrives as text and nothing can be summed.
    expect(csvCell("-12")).toBe("-12");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell(-12)).toBe("-12");
  });

  it("renders a date unambiguously", () => {
    expect(csvCell(new Date(Date.UTC(2026, 8, 16, 10, 33, 0)))).toBe("2026-09-16T10:33:00.000Z");
  });
});

describe("csvRow", () => {
  it("joins cells and ends the line the way the spec asks", () => {
    expect(csvRow(["a", "b"])).toBe("a,b\r\n");
  });

  it("keeps the column count when a value holds a comma", () => {
    const line = csvRow(["16 Sept", "Menon, Sarah", "auth.signed_in"]);
    expect(line).toBe('16 Sept,"Menon, Sarah",auth.signed_in\r\n');
    // Three fields, not four — which is the whole point of the quoting.
    expect(line.trimEnd().split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)).toHaveLength(3);
  });

  it("keeps a row on one line when a value holds a newline", () => {
    const line = csvRow(["one", "two\nthree"]);
    expect(line.endsWith("\r\n")).toBe(true);
    // The newline survives inside the quotes rather than splitting the record.
    expect(line).toBe('one,"two\nthree"\r\n');
  });
});

describe("the byte order mark", () => {
  it("is what tells Excel the file is UTF-8", () => {
    expect(CSV_BOM).toBe("﻿");
    expect(CSV_BOM.length).toBe(1);
  });
});
