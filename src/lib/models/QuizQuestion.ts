import { Schema, model, models } from "mongoose";

const QuizOptionSchema = new Schema(
  {
    value: { type: String, required: true },
    label: { type: String, required: true },
    /** 0–100. Higher is better; it raises the markers this question feeds. */
    score: { type: Number, required: true, min: 0, max: 100 },
    order: { type: Number, default: 0 },
    /** Multiple choice: "None of these" -- ticking it clears the others. */
    exclusive: { type: Boolean, default: false },
  },
  { _id: false }
);

/**
 * One condition of "show this question only when…". `_id: false` on purpose:
 * these go to a client component as props, and an ObjectId is not plain data.
 */
const ConditionSchema = new Schema(
  {
    qid: { type: String, required: true },
    op: { type: String, enum: ["is", "isNot", "answered", "gt", "gte", "lt", "lte"], required: true },
    values: { type: [String], default: undefined },
    value: Number,
  },
  { _id: false }
);

const ShowIfSchema = new Schema(
  {
    match: { type: String, enum: ["all", "any"], default: "all" },
    conditions: { type: [ConditionSchema], default: [] },
  },
  { _id: false }
);

/**
 * The questionnaire, held in the database so it can be edited without a
 * deploy. `src/lib/clinical/quiz.ts` still carries the bundled defaults, and
 * the reader falls back to them if this collection is empty — the quiz must
 * never break because an edit went wrong.
 */
const QuizQuestionSchema = new Schema(
  {
    /** The answer key. Stable across edits, because scores are keyed on it. */
    qid: { type: String, required: true, unique: true, trim: true },
    section: { type: String, required: true },
    order: { type: Number, default: 0, index: true },
    question: { type: String, required: true },
    help: String,
    type: { type: String, enum: ["single", "multi", "text", "number"], default: "single" },
    options: { type: [QuizOptionSchema], default: [] },
    /** Marker name → weight 0–1. Which nutrient markers this answer moves. */
    affects: { type: Map, of: Number, default: {} },
    optional: { type: Boolean, default: false },
    /** Answering one of these is a hard stop a physician must see. */
    contraindicationIf: { type: [String], default: [] },
    /** Number questions: the range a real answer falls in, and its unit. */
    min: Number,
    max: Number,
    unit: String,
    decimals: { type: Boolean, default: false },
    /** Absent: everybody is asked. See src/lib/clinical/quiz-rules.ts. */
    showIf: { type: ShowIfSchema, default: undefined },
    isActive: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

QuizQuestionSchema.index({ isActive: 1, order: 1 });

export const QuizQuestion = models.QuizQuestion || model("QuizQuestion", QuizQuestionSchema);
export default QuizQuestion;
