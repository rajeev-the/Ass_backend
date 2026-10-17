import Ticket from '../../models/Ticket.js';
import Message from '../../models/Message.js';
import User from '../../models/User.js';
import Book from '../../models/Book.js';
import aiClient from './aiClient.js';
import contextBuilder from './contextBuilder.js';
import { getRoyaltyFacts } from '../royalty.service.js';
import { getIO } from '../../realtime/socket.js';

// Deterministic, high-quality fallback generator adhering strictly to KB & tone guidelines
export const generateFallbackDraft = ({ ticket, author, book, royaltyFacts }) => {
  const firstName = author?.name ? author.name.split(' ')[0] : 'Author';
  const category = ticket.category?.value || 'General Inquiry';
  const bookTitle = book?.title ? `"${book.title}"` : 'your book';

  if (category === 'Royalty & Payments') {
    if (royaltyFacts?.belowThreshold) {
      return `Dear ${firstName},

Thank you for reaching out regarding your royalties for ${bookTitle}.

According to our records, your current accumulated royalty is ${royaltyFacts.formattedPending}. BookLeaf's policy requires a minimum threshold of ₹1,000 for quarterly payouts. Because your balance is currently below ₹1,000, it has automatically rolled over to the current quarter (${royaltyFacts.currentQuarterLabel}).

Once your total royalties reach ₹1,000, payment will be transferred directly to your linked bank account within 45 days of the quarter ending. You can also view a per-platform breakdown anytime in your dashboard.

Warm regards,
BookLeaf Author Support`;
    }

    if (royaltyFacts?.possiblyOverdue) {
      return `Dear ${firstName},

Thank you for contacting BookLeaf Author Support regarding your royalty payout for ${bookTitle}.

We see that your pending royalty is ${royaltyFacts.formattedPending}, and we understand your concern regarding the payout timing. Royalties are calculated on an 80/20 net profit split and distributed quarterly.

I have escalated your account to our finance team for an immediate audit to ensure your bank details are active and to confirm the transfer schedule within 48 hours. We appreciate your patience while we verify this for you.

Warm regards,
BookLeaf Author Support`;
    }

    return `Dear ${firstName},

Thank you for reaching out regarding your royalties for ${bookTitle}.

BookLeaf distributes royalties on an 80/20 net profit split quarterly. Payouts are processed within 45 days of the quarter closing. For ${royaltyFacts?.currentQuarterLabel || 'the current quarter'}, the payout cycle will conclude by ${royaltyFacts?.nextPayoutBy || 'the scheduled date'}.

Your total earned royalty to date is ${royaltyFacts?.formattedEarned || '₹0'}, with ${royaltyFacts?.formattedPaid || '₹0'} paid and ${royaltyFacts?.formattedPending || '₹0'} pending. Please ensure your current bank account details remain linked in your dashboard for seamless processing.

Warm regards,
BookLeaf Author Support`;
  }

  if (category === 'ISBN & Metadata Issues') {
    return `Dear ${firstName},

Thank you for alerting us about the ISBN metadata discrepancy regarding ${bookTitle}. Having exact and consistent catalog records across all platforms is essential.

I have escalated this issue directly to our production team in Delhi as a high-priority case. They are reviewing the barcode and feed with our distribution partners, and we will update you with a resolution within 48 hours.

Warm regards,
BookLeaf Author Support`;
  }

  if (category === 'Printing & Quality') {
    return `Dear ${firstName},

Thank you for contacting BookLeaf Author Support. We sincerely apologise that your printed copies of ${bookTitle} did not meet our quality standards.

To arrange a complimentary reprint, please reply with clear photographs of the defective copies showing the print or binding issues. Once our production team in Delhi verifies the photos, we will initiate a free reprint batch, dispatched within 5 to 7 business days.

Warm regards,
BookLeaf Author Support`;
  }

  if (category === 'Distribution & Availability') {
    return `Dear ${firstName},

Thank you for contacting us regarding the availability of ${bookTitle} on Amazon.

When a published book suddenly displays as "Currently Unavailable", it typically indicates a stock sync issue between distributor feeds rather than a listing removal. We have triggered an automatic catalog re-sync with our distribution team, and your listing should be restored live within 24 to 48 hours.

Warm regards,
BookLeaf Author Support`;
  }

  if (category === 'Book Status & Production Updates') {
    const currentStatus = book?.status || 'In Production';
    return `Dear ${firstName},

Thank you for following up on the progress of ${bookTitle}.

Your manuscript is currently at the ${currentStatus} stage. While production moves sequentially through cover design, typesetting, and proofreading, delays occasionally occur when awaiting proof revisions and approval cycles. Our team is actively reviewing your project and will share updated proofs within 3 to 5 business days.

Warm regards,
BookLeaf Author Support`;
  }

  // General Inquiry fallback
  return `Dear ${firstName},

Thank you for reaching out to BookLeaf Author Support.

You can submit metadata updates such as author bio and book description changes directly through your author dashboard or by replying with the revised details. Once submitted, our team pushes the updates to all retail platforms, and changes typically reflect live within 3 to 5 business days.

Please let us know if there is anything else we can assist you with.

Warm regards,
BookLeaf Author Support`;
};

export const generate = async (ticketInput, { regenerate = false } = {}) => {
  let ticket = ticketInput;
  if (!ticket._id || !ticket.subject) {
    ticket = await Ticket.findById(ticketInput).populate('author book');
  }

  // Count current messages
  const currentMessages = await Message.find({ ticket: ticket._id }).sort({ createdAt: 1 });
  const currentMessageCount = currentMessages.length;

  // Cache check (Cost control rule 8.3):
  // Return cached draft if draft exists, draftStatus is 'ready', message count hasn't changed, and regenerate is not forced
  if (
    !regenerate &&
    ticket.ai?.draft &&
    ticket.ai?.draftStatus === 'ready' &&
    ticket.ai?.draftBasedOnMessageCount === currentMessageCount
  ) {
    return {
      draft: ticket.ai.draft,
      draftStatus: 'ready',
      cached: true,
      draftBasedOnMessageCount: ticket.ai.draftBasedOnMessageCount,
    };
  }

  const [author, book] = await Promise.all([
    User.findById(ticket.author),
    ticket.book ? Book.findById(ticket.book) : null,
  ]);

  const royaltyFacts = book ? getRoyaltyFacts(book) : null;
  const { system, user } = await contextBuilder.buildContext({
    ticket,
    author,
    book,
    messages: currentMessages,
  });

  let draftText;
  let usage = null;
  let draftStatus = 'ready';
  let lastError = null;

  try {
    const response = await aiClient.complete({
      system,
      user,
      maxTokens: 500,
      temperature: 0.4,
      taskName: 'draft',
    });

    draftText = response.text.trim();
    usage = {
      task: 'draft',
      model: response.model,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs: response.latencyMs,
      at: new Date(),
    };
  } catch (error) {
    console.warn(
      `⚠️ Live AI drafting skipped/failed (${error.message}). Using BookLeaf knowledge base fallback.`
    );
    draftText = generateFallbackDraft({ ticket, author, book, royaltyFacts });
    lastError = error.message;
  }

  // Update ticket with draft
  ticket.ai.draft = draftText;
  ticket.ai.draftStatus = draftStatus;
  ticket.ai.draftGeneratedAt = new Date();
  ticket.ai.draftBasedOnMessageCount = currentMessageCount;
  if (lastError) {
    ticket.ai.lastError = lastError;
  }
  if (usage) {
    ticket.ai.usage.push(usage);
  }

  await ticket.save();

  // Emit event to admins
  const io = getIO();
  if (io) {
    io.to('admins').emit('ticket:draftReady', { ticketId: ticket._id.toString() });
  }

  return {
    draft: draftText,
    draftStatus: 'ready',
    cached: false,
    draftBasedOnMessageCount: currentMessageCount,
  };
};

export default {
  generate,
  generateFallbackDraft,
};
