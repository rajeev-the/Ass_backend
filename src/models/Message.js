import mongoose from 'mongoose';
import { MESSAGE_TYPES, MESSAGE_SENDERS } from '../utils/constants.js';

const messageSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for system generated messages
    },
    senderRole: {
      type: String,
      enum: MESSAGE_SENDERS,
      required: true,
    },
    type: {
      type: String,
      enum: MESSAGE_TYPES,
      default: 'reply',
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    usedAiDraft: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

export const Message = mongoose.model('Message', messageSchema);
export default Message;
