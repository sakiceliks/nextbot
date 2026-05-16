import mongoose, { Schema, Document } from "mongoose";

export interface IWhatsAppLog extends Document {
  message: string;
  timestamp: Date;
  type: "info" | "error" | "success" | "warning";
}

const WhatsAppLogSchema: Schema = new Schema({
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  type: { type: String, enum: ["info", "error", "success", "warning"], default: "info" },
});

// En son 100 logu tutacak şekilde bir TTL indeksi eklenebilir veya manuel temizlenebilir.
// Şimdilik basit tutuyoruz.

export default mongoose.models.WhatsAppLog || mongoose.model<IWhatsAppLog>("WhatsAppLog", WhatsAppLogSchema);
