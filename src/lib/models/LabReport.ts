import { Schema, model, models } from "mongoose";

const LabReportSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileName: { type: String, required: true },
    fileUrl: String,
    mimeType: String,
    sizeBytes: Number,
    category: String,
    notes: String,
    sharedWithDoctorId: { type: Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const LabReport = models.LabReport || model("LabReport", LabReportSchema);
export default LabReport;
