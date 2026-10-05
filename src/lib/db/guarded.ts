/**
 * Save a document whose save is guarded on what was read -- a booking's status
 * (see the guard on the Booking schema), or an explicit `$where`. False when
 * somebody changed it first: the caller leaves it alone rather than writing
 * over their change.
 */
export async function saveUnlessChanged(doc: { save: () => Promise<unknown> }): Promise<boolean> {
  try {
    await doc.save();
    return true;
  } catch (err) {
    if ((err as { name?: string } | null)?.name === "DocumentNotFoundError") return false;
    throw err;
  }
}
