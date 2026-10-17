import Book from '../../models/Book.js';
import { getRoyaltyFacts, formatCurrency } from '../royalty.service.js';
import { buildDraftPrompt } from './prompts.js';

export const buildContext = async ({ ticket, author, book, messages = [] }) => {
  const category = ticket.category?.value || 'General Inquiry';
  const priority = ticket.priority?.value || 'Medium';

  let royaltyFacts = null;
  let accountSummary = null;

  if (book) {
    royaltyFacts = getRoyaltyFacts(book);
  } else if (author) {
    // Edge case 8.8: General ticket (no book) -> provide account summary
    const authorBooks = await Book.find({ author: author._id });
    const totalPending = authorBooks.reduce((sum, b) => sum + (b.royaltyPending || 0), 0);
    accountSummary = {
      bookCount: authorBooks.length,
      totalPendingFormatted: formatCurrency(totalPending),
    };
  }

  const { system, user } = buildDraftPrompt({
    category,
    priority,
    author,
    book,
    royaltyFacts: royaltyFacts || {
      formattedEarned: '₹0',
      formattedPaid: '₹0',
      formattedPending: accountSummary ? accountSummary.totalPendingFormatted : '₹0',
      belowThreshold: false,
      neverPaid: true,
      lastPayoutDate: null,
      nextPayoutBy: 'Next quarterly cycle',
      possiblyOverdue: false,
    },
    conversationHistory: messages,
    description: ticket.description,
  });

  return {
    system,
    user,
    royaltyFacts,
    accountSummary,
  };
};

export default { buildContext };
