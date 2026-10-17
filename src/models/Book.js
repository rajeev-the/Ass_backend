import mongoose from 'mongoose';
import { PRODUCTION_STAGES } from '../utils/constants.js';

const bookSchema = new mongoose.Schema(
  {
    bookCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    isbn: {
      type: String,
      default: null,
      trim: true,
    },
    genre: {
      type: String,
      default: null,
      trim: true,
    },
    publicationDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      trim: true,
    },
    mrp: {
      type: Number,
      default: null,
    },
    royaltyPerCopy: {
      type: Number,
      default: null,
    },
    totalCopiesSold: {
      type: Number,
      default: 0,
    },
    totalRoyaltyEarned: {
      type: Number,
      default: 0,
    },
    royaltyPaid: {
      type: Number,
      default: 0,
    },
    royaltyPending: {
      type: Number,
      default: 0,
    },
    lastRoyaltyPayoutDate: {
      type: Date,
      default: null,
    },
    printPartner: {
      type: String,
      default: null,
      trim: true,
    },
    availableOn: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bookSchema.virtual('isPublished').get(function () {
  return this.status === 'Published & Live';
});

bookSchema.virtual('productionStageIndex').get(function () {
  if (!this.status) return -1;
  const statusLower = this.status.toLowerCase();
  return PRODUCTION_STAGES.findIndex((stage) => statusLower.includes(stage.toLowerCase()));
});

export const Book = mongoose.model('Book', bookSchema);
export default Book;
