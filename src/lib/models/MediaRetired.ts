import { Schema, model, models } from "mongoose";

/**
 * An uploaded photograph that no page uses any more, and when it stopped
 * (replaced, restored to the original, or its drip deleted). The file stays in
 * storage for a grace period, so a mistake can still be undone by hand;
 * `npm run clean-media` deletes only files that have been here longer than that
 * and that no photo record points to. Counted from this moment, not from the
 * upload: a photo that served the site for a year still gets its grace.
 */
const MediaRetiredSchema = new Schema(
  {
    /** Storage key (lib/storage), e.g. images/site/home/step-physician/20261014-153012-a1b2c3.jpg. */
    file: { type: String, required: true, unique: true },
    /** The place it was used in, for the listing. */
    slot: { type: String, default: null },
    reason: { type: String, enum: ["replaced", "restored", "drip-deleted", "noticed"], required: true },
    retiredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false }
);

export const MediaRetired = models.MediaRetired || model("MediaRetired", MediaRetiredSchema);
export default MediaRetired;
