import { Schema, model, models } from "mongoose";
import { DRIP_CATEGORIES, INGREDIENT_ROLES, UNITS } from "./types";

const DripIngredientSchema = new Schema(
  {
    masterId: { type: Schema.Types.ObjectId, ref: "ProductMaster", required: true },
    /** Denormalised for fast reads on catalogue/builder screens. */
    name: String,
    dose: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UNITS, required: true },
    role: { type: String, enum: INGREDIENT_ROLES, required: true },
    notes: String,
  },
  { _id: true }
);

/** A named recipe. Public catalogue entries and clinical formulas are one thing. */
const DripSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, index: true },
    tagline: String,
    description: String,
    infusionNotes: String,
    durationMin: { type: Number, default: 45 },

    ingredients: { type: [DripIngredientSchema], default: [] },

    withKit: { type: Boolean, default: true },
    kitId: { type: Schema.Types.ObjectId, ref: "SessionKit" },

    /* Public-site fields (Block 1 catalogue + detail) */
    /** Which group it appears under on the catalogue. */
    category: { type: String, enum: [...DRIP_CATEGORIES, null], default: null, index: true },
    priceInr: { type: Number, default: 0 },

    /**
     * How much fluid goes up, which is not the same as how much drug is in it.
     * A patient reads "500 ml" and knows roughly how long they are sitting
     * there; the dose list alone does not tell them that.
     */
    volumeMl: Number,

    /**
     * The upper end when a session is a range — 60 with a 90 here reads
     * "60–90 min". Null means the single figure in durationMin stands, which
     * is what every drip did before a range could be expressed.
     */
    durationToMin: Number,

    /** Free words for search and for the card: "Energy", "NAD+", "Anti-fatigue". */
    tags: [String],

    /**
     * One emoji, as the drip's own mark.
     *
     * Deliberately NOT a colour or a gradient. The design system commits to
     * white, near-black and one accent, and reserves every clinical hue for
     * genuine status — a per-drip gradient would put decoration in the same
     * visual language as an out-of-range vital. An emoji gives a card identity
     * without spending a colour.
     */
    icon: String,

    /** Shown as a badge on the catalogue. One flag, not a ranking. */
    isPopular: { type: Boolean, default: false },

    /**
     * What it does for somebody, as short cards rather than a bullet list.
     * `bestFor` stays for the one-line claims; this is the explained version.
     */
    benefits: {
      type: [
        new Schema(
          { title: { type: String, required: true }, description: String },
          { _id: false }
        ),
      ],
      default: [],
    },
    bestFor: [String],
    goodToKnow: [String],
    isPublic: { type: Boolean, default: true },
    /** Requires physician sign-off before a patient can book it. */
    requiresApproval: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Drip = models.Drip || model("Drip", DripSchema);
export default Drip;
