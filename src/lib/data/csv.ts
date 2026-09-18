/**
 * CSV, written for a file somebody will open in Excel.
 *
 * Two things have to be right, and only one of them is the obvious one.
 *
 * The obvious one is quoting: a value holding a comma, a quote or a newline
 * has to be wrapped and its quotes doubled, or one row silently becomes two
 * and every column after it is wrong.
 *
 * The other is **formula injection**. Excel and Sheets execute any cell that
 * starts with `=`, `+`, `@` or a tab, so a row whose content began `=cmd|...`
 * would run when an admin opened the export. That content is not hypothetical
 * here: the audit trail records values that came from forms, so an attacker
 * who can type into any field in the app can choose what lands in this file.
 * A trail exported for a compliance review is the last place that should
 * happen, so leading formula characters are neutralised with a quote.
 */

/** Values Excel would treat as a formula rather than as text. */
const FORMULA = /^[=+@\t\r]/;

/** A plain number, which `-` also starts and which must stay a number. */
const NUMBER = /^-\d+(\.\d+)?$/;

/** Needs wrapping: a separator, a quote, a newline, or edge whitespace. */
const NEEDS_QUOTES = /[",\n\r]|^\s|\s$/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);

  // A leading apostrophe keeps Excel from evaluating it, and stays visible so
  // the reader can see the value was changed rather than wondering later.
  // `-12` is left alone: it is a number, not a formula.
  if (FORMULA.test(text) || (text.startsWith("-") && !NUMBER.test(text))) {
    text = `'${text}`;
  }

  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One line, CRLF-terminated — what RFC 4180 asks for and what Excel wants. */
export function csvRow(cells: unknown[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/**
 * Excel reads a CSV as the system codepage unless the file says otherwise, so
 * without this an Indian name or a ₹ arrives as mojibake.
 */
export const CSV_BOM = "﻿";
