/**
 * Whether a patient may book a drip. A drip on the website can be booked by
 * anyone the booking rules allow; one kept off it ("Show on the public
 * catalogue" unticked) only on their physician's recommendation.
 */
export function patientMayBook(drip: { _id: unknown; isPublic?: boolean }, recommendedIds: unknown[]): boolean {
  return drip.isPublic !== false || recommendedIds.map(String).includes(String(drip._id));
}
