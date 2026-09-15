import { Schema, model, models } from "mongoose";

/**
 * Editable copy on the public site, keyed by a dotted path such as
 * `home.hero.headline`. Any key with no row falls back to the value hardcoded
 * at the call site, so the site never renders a blank because a key is missing.
 */
const ContentBlockSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: String, default: "" },
    /** Where it appears, for the editor's own listing. */
    group: { type: String, default: "general", index: true },
    description: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const ContentBlock = models.ContentBlock || model("ContentBlock", ContentBlockSchema);
export default ContentBlock;
