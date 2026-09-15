/**
 * The tax arithmetic on a GST invoice.
 *
 * Pure, and kept apart from the page that prints it: a tax invoice is a legal
 * document, the numbers on it have to be reproducible, and the only way to
 * show they are is to test them without a database in the way.
 */

/**
 * Whether the price a drip is sold at already contains its GST.
 *
 * It does. `priceInr` is the figure a patient reads on the public catalogue
 * and the figure an order is totalled from, and a retail price shown in India
 * is understood to include tax. Treating it as tax-exclusive would bill a
 * clinic 12% more than the order they agreed to, which is a worse error than
 * any presentation detail on the slip.
 *
 * So the tax is worked backwards out of the price, and the invoice total comes
 * to exactly the order total. Flip this if your accountant says the catalogue
 * price is meant to be tax-exclusive — nothing else has to change.
 */
export const PRICES_INCLUDE_GST = true;

/** Two decimal places, the way money is written on an invoice line. */
export const round2 = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The state a GSTIN belongs to.
 *
 * The first two digits of a GSTIN are the state code — 29 is Karnataka. That
 * is why no separate "state" field is needed on a clinic: the number they are
 * registered under already says where they are, and it is the figure the
 * invoice has to agree with.
 */
export function stateCodeFromGstin(gstin?: string | null): string | null {
  const code = (gstin ?? "").trim().slice(0, 2);
  return /^\d{2}$/.test(code) && code !== "00" ? code : null;
}

/** GST state codes, so a place of supply can be written in words. */
export const STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const stateName = (code?: string | null) =>
  code ? (STATE_NAMES[code] ?? `State ${code}`) : null;

/**
 * Whether this is a sale across a state line.
 *
 * Within one state the tax splits into CGST and SGST; across states it is a
 * single IGST at the same combined rate. A buyer with no GSTIN is not
 * registered, so there is no second state to compare against and the place of
 * supply is where we are — an intra-state sale.
 */
export function isInterState(
  sellerGstin?: string | null,
  buyerGstin?: string | null,
): boolean {
  const seller = stateCodeFromGstin(sellerGstin);
  const buyer = stateCodeFromGstin(buyerGstin);
  if (!seller || !buyer) return false;
  return seller !== buyer;
}

export type TaxSplit = {
  /** The value the tax is charged on. */
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** taxableValue + every tax on it. */
  total: number;
};

/**
 * One line's tax.
 *
 * `lineTotal` is what the clinic is charged for that line. With tax-inclusive
 * pricing the taxable value is worked back out of it, so the numbers always
 * add up to the figure the order already showed.
 */
export function splitTax(
  lineTotal: number,
  gstRate: number,
  interState: boolean,
): TaxSplit {
  const rate = Math.max(0, gstRate) / 100;

  const taxableValue = PRICES_INCLUDE_GST
    ? round2(lineTotal / (1 + rate))
    : round2(lineTotal);

  // Taken as the difference rather than recalculated, so a rounded taxable
  // value and its tax still sum to the price on the order. Recomputing it
  // leaves invoices a paisa out, which is the sort of thing that has to be
  // explained to an accountant every month.
  const tax = PRICES_INCLUDE_GST
    ? round2(lineTotal - taxableValue)
    : round2(taxableValue * rate);

  const half = round2(tax / 2);
  return {
    taxableValue,
    // The halves are taken as half and the remainder, never as two halves —
    // an odd number of paise has to land somewhere rather than vanish.
    cgst: interState ? 0 : half,
    sgst: interState ? 0 : round2(tax - half),
    igst: interState ? tax : 0,
    total: round2(taxableValue + tax),
  };
}

/**
 * The rupee rounding at the foot of an invoice.
 *
 * Indian invoices are settled in whole rupees, with the difference shown on
 * its own line rather than quietly absorbed into a total that then disagrees
 * with the lines above it.
 */
export function roundOffFor(total: number): {
  grandTotal: number;
  roundOff: number;
} {
  const grandTotal = Math.round(total);
  return { grandTotal, roundOff: round2(grandTotal - total) };
}

/**
 * One line's rate, for the narrow column beside it.
 *
 * Just the figure. Whether it splits into CGST and SGST or stands as IGST is a
 * property of the whole supply, not of one line, so it is stated once at the
 * head of the sheet — repeating "CGST 6% + SGST 6%" against every line said
 * the same thing five times and wrapped to three lines doing it.
 *
 * "Nil" rather than "0%": a supply that bears no tax is a different statement
 * from tax that was charged and came to nothing.
 */
export function rateLabel(gstRate: number): string {
  return gstRate ? `${gstRate}%` : "Nil";
}

/** How the tax on this supply is split, written once at the head of the sheet. */
export function taxBasisLabel(interState: boolean): string {
  return interState ? "IGST — inter-state" : "CGST + SGST — intra-state";
}

/**
 * What the document is called.
 *
 * A supplier without a GSTIN is not registered and may not charge GST at all;
 * what they issue is a bill of supply, not a tax invoice. The same is true of
 * a registered supplier whose lines are all exempt or nil-rated. Calling
 * either one a "Tax invoice" would be a claim to be registered and charging —
 * which is the one thing on this sheet that must never be wrong.
 */
export function documentTypeFor(
  sellerGstin: string | null | undefined,
  anyTax: boolean,
): "tax_invoice" | "bill_of_supply" {
  return sellerGstin?.trim() && anyTax ? "tax_invoice" : "bill_of_supply";
}

export const DOCUMENT_TITLE = {
  tax_invoice: "Tax invoice",
  bill_of_supply: "Bill of supply",
} as const;

export type HsnSummaryRow = {
  hsnCode: string;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
};

/**
 * The HSN-wise tax summary that closes a GST invoice.
 *
 * It is not a repeat of the lines above it. A return is filed by HSN and rate,
 * not by product name, so two drips sharing a classification belong on one row
 * — and an invoice that cannot be read that way has to be re-added by hand at
 * the far end. Lines carrying no tax are included rather than dropped: an
 * exempt supply still has to be declared.
 */
export function hsnSummary(
  lines: Array<{
    hsnCode?: string;
    gstRate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
  }>
): HsnSummaryRow[] {
  const rows = new Map<string, HsnSummaryRow>();

  for (const l of lines) {
    const hsnCode = l.hsnCode?.trim() || "—";
    // Rate belongs in the key as well as the code: the same classification can
    // be billed at two rates on one invoice, and merging them would report a
    // rate that was never charged.
    const key = `${hsnCode}@${l.gstRate}`;
    const row = rows.get(key) ?? {
      hsnCode,
      gstRate: l.gstRate,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalTax: 0,
    };
    row.taxableValue = round2(row.taxableValue + l.taxableValue);
    row.cgst = round2(row.cgst + l.cgst);
    row.sgst = round2(row.sgst + l.sgst);
    row.igst = round2(row.igst + l.igst);
    row.totalTax = round2(row.cgst + row.sgst + row.igst);
    rows.set(key, row);
  }

  return [...rows.values()].sort(
    (a, b) => a.hsnCode.localeCompare(b.hsnCode) || a.gstRate - b.gstRate
  );
}

/* ------------------------------------------------------------------ */
/* Is that a GSTIN?                                                    */
/* ------------------------------------------------------------------ */

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The fifteenth character of a GSTIN is a check digit over the first fourteen.
 *
 * Weights alternate 1, 2 across the string; each product is folded by adding
 * its quotient and remainder mod 36; the digit is whatever brings the total to
 * a multiple of 36. It exists to catch exactly the mistake this is guarding
 * against — one character mistyped or two transposed.
 */
export function gstinCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = BASE36.indexOf(first14[i]);
    if (value < 0) return "";
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return BASE36[(36 - (sum % 36)) % 36];
}

/* Each part checked on its own, so the message can name the part that is wrong. */
const STATE_PART = /^[0-9]{2}/;
const PAN_PART = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]/;

export type GstinCheck = {
  /** Wrong beyond argument. Refuse the save. */
  error?: string;
  /**
   * Looks wrong, but say so rather than refuse.
   *
   * The last character is worked out from the other fourteen, so a mismatch
   * means something is mistyped. It is the one rule this cannot be certain of
   * — a validator that wrongly rejected a real registration would leave a
   * business unable to enter its own number and no way past. A typo reaching
   * an invoice is the lesser harm, so this warns and lets it through.
   */
  warning?: string;
};

/**
 * Whether a string can be a GST registration number.
 *
 * Every message here is read by whoever is typing the number — a clinic
 * manager or an office administrator, not a developer. So each one says which
 * part is wrong and what it should look like, and none of them uses a word
 * that only appears in the specification.
 *
 * An empty one is not an error: not being registered is allowed, and whether
 * a blank is acceptable is the caller's question, not this one's.
 */
export function checkGstin(raw: string): GstinCheck {
  const gstin = raw.trim().toUpperCase();
  if (!gstin) return {};

  if (gstin.length < 15) {
    return {
      error: `A GST number has 15 characters. You have typed ${gstin.length} — it looks unfinished.`,
    };
  }
  if (gstin.length > 15) {
    return { error: `A GST number has 15 characters. You have typed ${gstin.length}.` };
  }

  if (!STATE_PART.test(gstin)) {
    return {
      error: `A GST number starts with two numbers for the state — 29 is Karnataka, 27 is Maharashtra. Yours starts with "${gstin.slice(0, 2)}".`,
    };
  }
  if (!STATE_NAMES[gstin.slice(0, 2)]) {
    return {
      error: `No state has the code ${gstin.slice(0, 2)}. Karnataka is 29, Maharashtra is 27, Delhi is 07.`,
    };
  }
  if (!PAN_PART.test(gstin)) {
    return {
      error:
        "Characters 3 to 12 are the business PAN — five letters, then four numbers, then one letter. Check that part against the GST certificate.",
    };
  }
  if (gstin[13] !== "Z") {
    return {
      error: `The 14th character is the letter Z on almost every GST number. Yours is "${gstin[13]}".`,
    };
  }
  if (!/^[0-9A-Z]$/.test(gstin[12]) || !/^[0-9A-Z]$/.test(gstin[14])) {
    return { error: "A GST number uses only letters A to Z and numbers 0 to 9." };
  }

  const expected = gstinCheckDigit(gstin.slice(0, 14));
  if (expected && gstin[14] !== expected) {
    return {
      warning:
        "The last character does not match the rest of the number, so something may be mistyped. It has been saved — please check it against the GST certificate.",
    };
  }
  return {};
}
