import mongoose from 'mongoose';
import Book from '../models/Book.js';
import AppError from '../utils/AppError.js';

export const getAuthorBooksWithSummary = async (authorId) => {
  const books = await Book.find({ author: authorId }).sort({ createdAt: -1 });

  const summary = books.reduce(
    (acc, b) => {
      acc.totalEarned += b.totalRoyaltyEarned || 0;
      acc.totalPaid += b.royaltyPaid || 0;
      acc.totalPending += b.royaltyPending || 0;
      if (b.status === 'Published & Live') {
        acc.publishedCount += 1;
      } else {
        acc.inProductionCount += 1;
      }
      return acc;
    },
    {
      totalEarned: 0,
      totalPaid: 0,
      totalPending: 0,
      publishedCount: 0,
      inProductionCount: 0,
    }
  );

  return {
    books,
    summary,
  };
};

export const getAuthorBookById = async (authorId, bookId) => {
  if (!mongoose.Types.ObjectId.isValid(bookId)) {
    throw AppError.notFound('Book not found');
  }

  const book = await Book.findOne({ _id: bookId, author: authorId });
  if (!book) {
    // Return 404 to never leak existence of another author's book
    throw AppError.notFound('Book not found');
  }

  return book;
};

export default {
  getAuthorBooksWithSummary,
  getAuthorBookById,
};
