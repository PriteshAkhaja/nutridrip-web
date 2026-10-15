import { Schema, model, models } from "mongoose";

/**
 * A replaced photograph on the public site (Admin → Site images): one row per
 * slot (lib/media/slots), or per drip ("drip.<slug>"). No row: the slot shows
 * its shipped photo. Deleting the row is "Restore original". The file stays in
 * storage for a grace period (MediaRetired, `npm run clean-media`), so an old
 * upload is not lost by accident, and is deleted for good after it.
 */
const SiteMediaSchema = new Schema(
  {
    slot: { type: String, required: true, unique: true, trim: true },
    /** Storage key (lib/storage), e.g. images/site/home/hero/20261014-153012-a1b2c3.jpg. Null: details only. */
    file: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    /** A 20px preview as a data URL, shown while the photo loads. */
    blur: { type: String, default: null },
    /** What it shows, for screen readers and search. */
    alt: { type: String, default: null, maxlength: 300 },
    /** CSS object-position, "x% y%": where the subject sits. */
    position: { type: String, default: null },
    bytes: { type: Number, default: null },
    originalName: { type: String, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const SiteMedia = models.SiteMedia || model("SiteMedia", SiteMediaSchema);
export default SiteMedia;
