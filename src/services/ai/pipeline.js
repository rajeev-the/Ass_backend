import Ticket from '../../models/Ticket.js';
import Book from '../../models/Book.js';
import classifier from './classifier.js';
import drafter from './drafter.js';
import { PRIORITY_RANKS } from '../../utils/constants.js';
import { emitTicketUpdated } from '../../realtime/socket.js';

export const runAiPipeline = async (ticketId) => {
  try {
    const ticket = await Ticket.findById(ticketId).populate('book');
    if (!ticket) return;

    let bookTitle = 'General / Account Level';
    if (ticket.book) {
      const bookDoc = ticket.book.title ? ticket.book : await Book.findById(ticket.book);
      if (bookDoc) bookTitle = bookDoc.title;
    }

    // Step 1: Classify
    try {
      const classification = await classifier.classify({
        bookTitle,
        subject: ticket.subject,
        description: ticket.description,
      });

      ticket.category = {
        value: classification.category,
        source: classification.source,
        aiValue: classification.category,
        confidence: classification.confidence,
      };

      ticket.priority = {
        value: classification.priority,
        source: classification.source,
        aiValue: classification.priority,
        reason: classification.reason,
      };

      ticket.priorityRank = PRIORITY_RANKS[classification.priority] ?? 2;
      ticket.ai.classificationStatus = 'done';
      if (classification.usage) {
        ticket.ai.usage.push(classification.usage);
      }

      await ticket.save();

      emitTicketUpdated(ticket, {
        category: ticket.category,
        priority: ticket.priority,
        priorityRank: ticket.priorityRank,
        ai: ticket.ai,
      });
    } catch (classErr) {
      console.warn(
        `[AI Pipeline] classification step failed for ticket ${ticketId}:`,
        classErr.message
      );
      ticket.ai.classificationStatus = 'failed';
      ticket.ai.lastError = classErr.message;
      await ticket.save();
    }

    // Step 2: Generate Draft
    try {
      await drafter.generate(ticket, { regenerate: false });
    } catch (draftErr) {
      console.warn(`[AI Pipeline] draft step failed for ticket ${ticketId}:`, draftErr.message);
      ticket.ai.draftStatus = 'failed';
      ticket.ai.lastError = draftErr.message;
      await ticket.save();
    }
  } catch (err) {
    console.error(`[AI Pipeline] Unexpected error in pipeline for ticket ${ticketId}:`, err);
  }
};

export default { runAiPipeline };
