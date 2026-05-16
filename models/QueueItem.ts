import mongoose, { Schema, Document } from "mongoose";

export interface IQueueItem extends Document {
  queueId: string;
  draft: any;
  preview?: string;
  status: "pending" | "running" | "done" | "error";
  errorMsg?: string;
  addedAt: string;
  duration?: string;
  publishedAt?: Date;
  logs: string[];
}

const QueueItemSchema: Schema = new Schema({
  queueId: { type: String, required: true, unique: true },
  draft: { type: Schema.Types.Mixed, required: true },
  preview: { type: String },
  status: { type: String, enum: ["pending", "running", "done", "error"], default: "pending" },
  errorMsg: { type: String },
  addedAt: { type: String },
  duration: { type: String },
  publishedAt: { type: Date },
  logs: [{ type: String }],
}, { timestamps: true });

export default mongoose.models.QueueItem || mongoose.model<IQueueItem>("QueueItem", QueueItemSchema);
