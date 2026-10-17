import mongoose from 'mongoose';
import {
  STATUSES,
  CATEGORIES,
  PRIORITIES,
  PRIORITY_RANKS,
  CLASSIFICATION_SOURCES,
  CLASSIFICATION_STATUSES,
  DRAFT_STATUSES,
} from '../utils/constants.js';

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: 'application/octet-stream' },
    url: { type: String, default: null },
  },
  { _id: false }
);

const aiUsageSchema = new mongoose.Schema(
  {
    task: { type: String, required: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      minlength: 5,
      maxlength: 150,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 5000,
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: STATUSES,
      default: 'Open',
      index: true,
    },
    category: {
      value: {
        type: String,
        enum: CATEGORIES,
        required: true,
      },
      source: {
        type: String,
        enum: CLASSIFICATION_SOURCES,
        default: 'fallback',
      },
      aiValue: {
        type: String,
        default: null,
      },
      confidence: {
        type: Number,
        default: null,
      },
    },
    priority: {
      value: {
        type: String,
        enum: PRIORITIES,
        default: 'Medium',
      },
      source: {
        type: String,
        enum: CLASSIFICATION_SOURCES,
        default: 'fallback',
      },
      aiValue: {
        type: String,
        default: null,
      },
      reason: {
        type: String,
        default: null,
      },
    },
    priorityRank: {
      type: Number,
      default: 2, // 0: Critical, 1: High, 2: Medium, 3: Low
      index: true,
    },
    ai: {
      classificationStatus: {
        type: String,
        enum: CLASSIFICATION_STATUSES,
        default: 'pending',
      },
      draft: {
        type: String,
        default: null,
      },
      draftStatus: {
        type: String,
        enum: DRAFT_STATUSES,
        default: 'none',
      },
      draftGeneratedAt: {
        type: Date,
        default: null,
      },
      draftBasedOnMessageCount: {
        type: Number,
        default: 0,
      },
      usage: {
        type: [aiUsageSchema],
        default: [],
      },
      lastError: {
        type: String,
        default: null,
      },
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to synchronize priorityRank with priority.value
ticketSchema.pre('save', function () {
  if (this.priority && this.priority.value) {
    this.priorityRank = PRIORITY_RANKS[this.priority.value] ?? 2;
  }
  if (!this.lastActivityAt) {
    this.lastActivityAt = new Date();
  }
});

// Compound indexes defined in Section 4.3
ticketSchema.index({ status: 1, priorityRank: 1, createdAt: 1 });
ticketSchema.index({ author: 1, createdAt: -1 });
ticketSchema.index({ 'category.value': 1 });
ticketSchema.index({ assignedTo: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
