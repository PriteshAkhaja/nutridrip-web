/**
 * One phone number, one account. "+91 98444 71234", "9844471234" and
 * "+919844471234" are the same patient, so every number is normalised to
 * E.164 before it is stored or looked up.
 */
export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  // A leading trunk zero on an Indian number: 09844471234.
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  // A bare ten-digit number is assumed to be Indian.
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}
