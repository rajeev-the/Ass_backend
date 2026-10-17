import mongoose from 'mongoose';
import Ticket from '../models/Ticket.js';
import Message from '../models/Message.js';
import Book from '../models/Book.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { generateTicketNumber } from '../utils/ticketNumber.js';
import { PRIORITY_RANKS, ALLOWED_STATUS_TRANSITIONS } from '../utils/constants.js';
import {
  toAuthorSafeTicket,
  emitTicketCreated,
  emitTicketUpdated,
  emitMessage,
} from '../realtime/socket.js';

// Keyword fallback classifier (Section 8.7)
export const classifyFallback = (text = '') => {
  const t = text.toLowerCase();
  let category = 'General Inquiry';
  let priority = 'Low';
  let reason = 'Default fallback';

  if (/isbn|metadata|wrong book|barcode/i.test(t)) {
    category = 'ISBN & Metadata Issues';
    priority = 'High';
    reason = 'Keyword match on ISBN or metadata issue';
  } else if (/royalt|payout|payment|paid|bank|₹|money/i.test(t)) {
    category = 'Royalty & Payments';
    priority = /month|never|not received/i.test(t) ? 'High' : 'Medium';
    reason = 'Keyword match on royalty or payment';
  } else if (/print|blurr|binding|misalign|defect|torn|pages/i.test(t)) {
    category = 'Printing & Quality';
    priority = 'High';
    reason = 'Keyword match on print defect or physical quality';
  } else if (/amazon|flipkart|unavailable|listing|not showing|out of stock/i.test(t)) {
    category = 'Distribution & Availability';
    priority = 'High';
    reason = 'Keyword match on retailer distribution/stock';
  } else if (/typeset|cover|proof|stage|production|when will|delay/i.test(t)) {
    category = 'Book Status & Production Updates';
    priority = 'Medium';
    reason = 'Keyword match on production stages or delays';
  }

  // Boost one level for urgent/legal/delay
  if (/urgent|legal|lawyer|6 months|months/i.test(t)) {
    if (priority === 'High') priority = 'Critical';
    else if (priority === 'Medium') priority = 'High';
    else if (priority === 'Low') priority = 'Medium';
  }

  // Policy rule in code: ISBN & Metadata Issues -> priority at least High
  if (category === 'ISBN & Metadata Issues' && (priority === 'Low' || priority === 'Medium')) {
    priority = 'High';
  }

  return { category, priority, reason };
};

/* ==========================================================================
   AUTHOR OPERATIONS
   ========================================================================== */

export const createAuthorTicket = async (
  authorId,
  { bookId, subject, description, attachments = [] }
) => {
  let validatedBookId = null;

  if (bookId) {
    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      throw AppError.notFound('Book not found');
    }
    const book = await Book.findOne({ _id: bookId, author: authorId });
    if (!book) {
      throw AppError.notFound('Book not found');
    }
    validatedBookId = book._id;
  }

  const ticketNumber = await generateTicketNumber();
  const triage = classifyFallback(`${subject} ${description}`);

  const ticket = await Ticket.create({
    ticketNumber,
    author: authorId,
    book: validatedBookId,
    subject,
    description,
    attachments,
    status: 'Open',
    category: {
      value: triage.category,
      source: 'fallback',
      aiValue: null,
      confidence: null,
    },
    priority: {
      value: triage.priority,
      source: 'fallback',
      aiValue: null,
      reason: triage.reason,
    },
    priorityRank: PRIORITY_RANKS[triage.priority] ?? 2,
    ai: {
      classificationStatus: 'pending',
      draft: null,
      draftStatus: 'none',
    },
    lastActivityAt: new Date(),
  });

  // Create initial Message
  await Message.create({
    ticket: ticket._id,
    sender: authorId,
    senderRole: 'author',
    type: 'reply',
    body: description,
    createdAt: ticket.createdAt,
  });

  emitTicketCreated(ticket);

  // Trigger background AI pipeline asynchronously (un-awaited, non-blocking)
  import('../services/ai/pipeline.js')
    .then(({ runAiPipeline }) => {
      runAiPipeline(ticket._id).catch((err) => console.error('AI pipeline error:', err));
    })
    .catch((err) => console.error('Failed to load AI pipeline:', err));

  return toAuthorSafeTicket(ticket);
};

export const getAuthorTickets = async (authorId, { status, page = 1, limit = 20 }) => {
  const query = { author: authorId };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;
  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .populate('book', 'title bookCode status')
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(limit),
    Ticket.countDocuments(query),
  ]);

  const safeTickets = tickets.map((t) => toAuthorSafeTicket(t));

  return {
    tickets: safeTickets,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
};

export const getAuthorTicketById = async (authorId, ticketId) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, author: authorId }).populate(
    'book',
    'title bookCode status isbn'
  );

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  // Author visibility rule: NEVER include internal_note messages
  const messages = await Message.find({
    ticket: ticket._id,
    type: { $in: ['reply', 'system'] },
  })
    .populate('sender', 'name role')
    .sort({ createdAt: 1 });

  const safeTicket = toAuthorSafeTicket(ticket);

  return {
    ticket: safeTicket,
    messages,
  };
};

export const addAuthorMessage = async (authorId, ticketId, body) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findOne({ _id: ticketId, author: authorId });
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  if (ticket.status === 'Closed') {
    throw AppError.unprocessable('Cannot reply to a closed ticket');
  }

  let statusReopened = false;
  if (ticket.status === 'Resolved') {
    ticket.status = 'Open';
    statusReopened = true;
  }

  ticket.lastActivityAt = new Date();
  await ticket.save();

  const message = await Message.create({
    ticket: ticket._id,
    sender: authorId,
    senderRole: 'author',
    type: 'reply',
    body,
  });

  if (statusReopened) {
    await Message.create({
      ticket: ticket._id,
      sender: null,
      senderRole: 'system',
      type: 'system',
      body: 'Ticket reopened to Open following author response',
    });
  }

  emitMessage(message, ticket);
  emitTicketUpdated(ticket, {
    status: ticket.status,
    lastActivityAt: ticket.lastActivityAt,
  });

  return message;
};

/* ==========================================================================
   ADMIN OPERATIONS
   ========================================================================== */

export const getAdminTickets = async ({
  status,
  category,
  priority,
  assignedTo,
  from,
  to,
  q,
  sort = 'urgency',
  page = 1,
  limit = 20,
  adminUserId,
}) => {
  const matchStage = {};

  if (status) {
    matchStage.status = status;
  }
  if (category) {
    matchStage['category.value'] = category;
  }
  if (priority) {
    matchStage['priority.value'] = priority;
  }

  if (assignedTo === 'me' && adminUserId) {
    matchStage.assignedTo = new mongoose.Types.ObjectId(adminUserId);
  } else if (assignedTo === 'unassigned') {
    matchStage.assignedTo = null;
  } else if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
    matchStage.assignedTo = new mongoose.Types.ObjectId(assignedTo);
  }

  if (from || to) {
    matchStage.createdAt = {};
    if (from) matchStage.createdAt.$gte = new Date(from);
    if (to) matchStage.createdAt.$lte = new Date(to);
  }

  if (q) {
    const regex = new RegExp(q, 'i');
    matchStage.$or = [{ ticketNumber: regex }, { subject: regex }, { description: regex }];
  }

  // Sort strategy:
  // 'urgency' = unresolved first ($in ['Open', 'In Progress'] before Resolved/Closed) -> priorityRank asc -> createdAt asc
  let sortStage;
  const addFieldsStage = {
    isResolved: {
      $cond: [{ $in: ['$status', ['Resolved', 'Closed']] }, 1, 0],
    },
  };

  if (sort === 'urgency') {
    sortStage = { isResolved: 1, priorityRank: 1, createdAt: 1 };
  } else if (sort === 'oldest') {
    sortStage = { createdAt: 1 };
  } else {
    sortStage = { createdAt: -1 };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const pipeline = [
    { $match: matchStage },
    { $addFields: addFieldsStage },
    { $sort: sortStage },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: Number(limit) },
          {
            $lookup: {
              from: 'users',
              localField: 'author',
              foreignField: '_id',
              as: 'author',
            },
          },
          { $unwind: '$author' },
          {
            $lookup: {
              from: 'books',
              localField: 'book',
              foreignField: '_id',
              as: 'book',
            },
          },
          {
            $unwind: {
              path: '$book',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'assignedTo',
              foreignField: '_id',
              as: 'assignedTo',
            },
          },
          {
            $unwind: {
              path: '$assignedTo',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              'author.passwordHash': 0,
              'author.__v': 0,
              'assignedTo.passwordHash': 0,
              'assignedTo.__v': 0,
              isResolved: 0,
            },
          },
        ],
        totalCount: [{ $count: 'total' }],
      },
    },
  ];

  const [result] = await Ticket.aggregate(pipeline);
  const total = result.totalCount[0]?.total || 0;
  const now = Date.now();

  const tickets = (result.data || []).map((t) => ({
    ...t,
    ageHours: Math.max(0, Math.floor((now - new Date(t.createdAt).getTime()) / (1000 * 60 * 60))),
  }));

  return {
    tickets,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
};

export const getAdminTicketStats = async (adminUserId = null) => {
  const tickets = await Ticket.find({}).lean();

  const byStatus = {
    Open: 0,
    'In Progress': 0,
    Resolved: 0,
    Closed: 0,
  };

  const byPriority = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
  };

  const byCategory = {
    'Royalty & Payments': 0,
    'ISBN & Metadata Issues': 0,
    'Printing & Quality': 0,
    'Distribution & Availability': 0,
    'Book Status & Production Updates': 0,
    'General Inquiry': 0,
  };

  let unassigned = 0;
  let overdue48h = 0;
  let aiFailed = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let resolvedToday = 0;
  let myTickets = 0;

  const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  for (const t of tickets) {
    if (byStatus[t.status] !== undefined) {
      byStatus[t.status] += 1;
    }

    const catVal = t.category?.value || t.category;
    if (catVal && byCategory[catVal] !== undefined) {
      byCategory[catVal] += 1;
    }

    const isUnresolved = t.status === 'Open' || t.status === 'In Progress';
    if (isUnresolved) {
      const pVal = t.priority?.value;
      if (pVal && byPriority[pVal] !== undefined) {
        byPriority[pVal] += 1;
      }
      if (!t.assignedTo) {
        unassigned += 1;
      }
      if (!t.firstResponseAt && new Date(t.createdAt).getTime() < fortyEightHoursAgo) {
        overdue48h += 1;
      }
      if (adminUserId && t.assignedTo && String(t.assignedTo) === String(adminUserId)) {
        myTickets += 1;
      }
    }

    const isResolved = t.status === 'Resolved' || t.status === 'Closed';
    const updatedTime = new Date(t.updatedAt || t.createdAt).getTime();
    if (isResolved && updatedTime >= startOfToday.getTime()) {
      resolvedToday += 1;
    }

    if (t.ai?.classificationStatus === 'failed' || t.ai?.draftStatus === 'failed') {
      aiFailed += 1;
    }

    if (Array.isArray(t.ai?.usage)) {
      for (const u of t.ai.usage) {
        inputTokens += u.inputTokens || 0;
        outputTokens += u.outputTokens || 0;
      }
    }
  }

  return {
    byStatus,
    byPriority,
    byCategory,
    open: byStatus.Open,
    inProgress: byStatus['In Progress'],
    allOpen: byStatus.Open + byStatus['In Progress'],
    resolved: byStatus.Resolved,
    closed: byStatus.Closed,
    critical: byPriority.Critical,
    high: byPriority.High,
    criticalHigh: byPriority.Critical + byPriority.High,
    unassigned,
    overdue48h,
    overdue: overdue48h,
    resolvedToday,
    myTickets,
    aiFailed,
    tokens: {
      input: inputTokens,
      output: outputTokens,
    },
  };
};

export const getAdminTicketById = async (ticketId) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findById(ticketId)
    .populate('author', 'name email authorCode phone city joinedDate')
    .populate(
      'book',
      'title bookCode status isbn mrp royaltyPerCopy royaltyPaid royaltyPending totalCopiesSold totalRoyaltyEarned availableOn printPartner'
    )
    .populate('assignedTo', 'name email role');

  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  // Admin gets all messages including internal_note
  const messages = await Message.find({ ticket: ticket._id })
    .populate('sender', 'name role email')
    .sort({ createdAt: 1 });

  return {
    ticket,
    messages,
  };
};

export const updateTicket = async (
  ticketId,
  adminUser,
  { status, category, priority, assignedTo }
) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  const changes = {};

  if (status && status !== ticket.status) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[ticket.status] || [];
    if (!allowed.includes(status)) {
      throw AppError.unprocessable(
        `Invalid status transition from '${ticket.status}' to '${status}'. Allowed: ${allowed.join(', ')}`
      );
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    changes.status = status;

    if (status === 'Resolved') {
      ticket.resolvedAt = new Date();
      changes.resolvedAt = ticket.resolvedAt;
    }

    await Message.create({
      ticket: ticket._id,
      sender: adminUser._id,
      senderRole: 'system',
      type: 'system',
      body: `Status changed from ${oldStatus} to ${status} by ${adminUser.name}`,
    });
  }

  if (category && category !== ticket.category?.value) {
    ticket.category.value = category;
    ticket.category.source = 'admin';
    changes.category = ticket.category;
  }

  if (priority && priority !== ticket.priority?.value) {
    ticket.priority.value = priority;
    ticket.priority.source = 'admin';
    ticket.priorityRank = PRIORITY_RANKS[priority] ?? 2;
    changes.priority = ticket.priority;
    changes.priorityRank = ticket.priorityRank;
  }

  if (assignedTo !== undefined) {
    let newAssigned = null;
    if (assignedTo) {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        throw AppError.badRequest('Invalid assignedTo ID');
      }
      const targetUser = await User.findById(assignedTo);
      if (!targetUser) {
        throw AppError.notFound('Assigned user not found');
      }
      newAssigned = targetUser._id;
      await Message.create({
        ticket: ticket._id,
        sender: adminUser._id,
        senderRole: 'system',
        type: 'system',
        body: `Ticket assigned to ${targetUser.name} by ${adminUser.name}`,
      });
    } else {
      await Message.create({
        ticket: ticket._id,
        sender: adminUser._id,
        senderRole: 'system',
        type: 'system',
        body: `Ticket unassigned by ${adminUser.name}`,
      });
    }
    ticket.assignedTo = newAssigned;
    changes.assignedTo = newAssigned;
  }

  ticket.lastActivityAt = new Date();
  changes.lastActivityAt = ticket.lastActivityAt;
  await ticket.save();

  emitTicketUpdated(ticket, changes);

  return ticket;
};

export const assignTicketToMe = async (ticketId, adminUser) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  ticket.assignedTo = adminUser._id;
  ticket.lastActivityAt = new Date();
  await ticket.save();

  await Message.create({
    ticket: ticket._id,
    sender: adminUser._id,
    senderRole: 'system',
    type: 'system',
    body: `Ticket assigned to ${adminUser.name}`,
  });

  emitTicketUpdated(ticket, {
    assignedTo: adminUser._id,
    lastActivityAt: ticket.lastActivityAt,
  });

  return ticket;
};

export const addAdminMessage = async (ticketId, adminUser, { body, type, usedAiDraft = false }) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  const changes = {};

  if (type === 'reply') {
    if (!ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      changes.firstResponseAt = ticket.firstResponseAt;
    }

    // First admin reply automatically transitions Open -> In Progress
    if (ticket.status === 'Open') {
      ticket.status = 'In Progress';
      changes.status = 'In Progress';

      await Message.create({
        ticket: ticket._id,
        sender: null,
        senderRole: 'system',
        type: 'system',
        body: 'Status automatically changed from Open to In Progress upon admin reply',
      });
    }
  }

  ticket.lastActivityAt = new Date();
  changes.lastActivityAt = ticket.lastActivityAt;
  await ticket.save();

  const message = await Message.create({
    ticket: ticket._id,
    sender: adminUser._id,
    senderRole: 'admin',
    type,
    body,
    usedAiDraft: !!usedAiDraft,
  });

  emitMessage(message, ticket);
  emitTicketUpdated(ticket, changes);

  return message;
};

export const getAuthorWithBooks = async (authorId) => {
  if (!mongoose.Types.ObjectId.isValid(authorId)) {
    throw AppError.notFound('Author not found');
  }

  const author = await User.findOne({ _id: authorId, role: 'author' });
  if (!author) {
    throw AppError.notFound('Author not found');
  }

  const books = await Book.find({ author: author._id }).sort({ createdAt: -1 });

  return {
    author,
    books,
  };
};

export const getOrGenerateDraft = async (ticketId, { regenerate = false } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findById(ticketId).populate('book');
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  const { generate } = await import('./ai/drafter.js');
  return generate(ticket, { regenerate });
};

export const reclassifyTicket = async (ticketId) => {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw AppError.notFound('Ticket not found');
  }

  const ticket = await Ticket.findById(ticketId).populate('book');
  if (!ticket) {
    throw AppError.notFound('Ticket not found');
  }

  let bookTitle = 'General / Account Level';
  if (ticket.book) {
    const bookDoc = ticket.book.title ? ticket.book : await Book.findById(ticket.book);
    if (bookDoc) bookTitle = bookDoc.title;
  }

  const { classify } = await import('./ai/classifier.js');
  const result = await classify({
    bookTitle,
    subject: ticket.subject,
    description: ticket.description,
  });

  ticket.category = {
    value: result.category,
    source: result.source,
    aiValue: result.category,
    confidence: result.confidence,
  };

  ticket.priority = {
    value: result.priority,
    source: result.source,
    aiValue: result.priority,
    reason: result.reason,
  };

  ticket.priorityRank = PRIORITY_RANKS[result.priority] ?? 2;
  ticket.ai.classificationStatus = 'done';
  if (result.usage) {
    ticket.ai.usage.push(result.usage);
  }
  ticket.lastActivityAt = new Date();
  await ticket.save();

  emitTicketUpdated(ticket, {
    category: ticket.category,
    priority: ticket.priority,
    priorityRank: ticket.priorityRank,
    ai: ticket.ai,
    lastActivityAt: ticket.lastActivityAt,
  });

  return ticket;
};

export default {
  classifyFallback,
  createAuthorTicket,
  getAuthorTickets,
  getAuthorTicketById,
  addAuthorMessage,
  getAdminTickets,
  getAdminTicketStats,
  getAdminTicketById,
  updateTicket,
  assignTicketToMe,
  addAdminMessage,
  getAuthorWithBooks,
  getOrGenerateDraft,
  reclassifyTicket,
};
