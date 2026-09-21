import { Schema, model, models } from "mongoose";
import { AI_STATUS } from "../ai/config";

/**
 * A saved AI configuration — the model, its settings and its prompts.
 *
 * Nothing in the app reads this yet. It is the record an operator edits and
 * switches between (see lib/ai/config.ts for what that does and does not mean),
 * kept as data so that connecting a model later is a matter of reading the
 * Active row, not of building the screen that sets it.
 *
 * No API key is stored, by design: those belong in the server's environment.
 */
const AIModelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: "" },
    model: { type: String, required: true, trim: true },
    temperature: { type: Number, required: true, min: 0, max: 1 },
    maxTokens: { type: Number, required: true, min: 1 },
    systemPrompt: { type: String, default: "" },
    userPromptTemplate: { type: String, default: "" },
    // No `index: true` here. It would build a plain index on the same key as the
    // partial unique one below, the two would collide on the name, and the
    // unique one — the only one that matters — would silently never be built.
    status: { type: String, enum: AI_STATUS, default: "test" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/**
 * At most one configuration is Active, and the database says so rather than
 * leaving it to the code that flips the switch. Two Active rows would mean
 * "the active model" has no single answer, and two requests activating at once
 * are exactly how that would happen.
 */
AIModelSchema.index(
  { status: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "one_active_model" }
);

export const AIModel = models.AIModel || model("AIModel", AIModelSchema);
export default AIModel;
