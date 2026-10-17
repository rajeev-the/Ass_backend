import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: false,
    },
  });

  // JWT Authentication Handshake Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user) return;

    // Auto-join personal / role rooms
    if (user.role === 'admin') {
      socket.join('admins');
    } else {
      socket.join(`author:${user._id.toString()}`);
    }

    // Room join/leave for specific tickets
    socket.on('ticket:join', ({ ticketId }) => {
      if (ticketId) {
        socket.join(`ticket:${ticketId}`);
      }
    });

    socket.on('ticket:leave', ({ ticketId }) => {
      if (ticketId) {
        socket.leave(`ticket:${ticketId}`);
      }
    });

    socket.on('disconnect', () => {
      // socket disconnected
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

// Author-safe projection for ticket payloads
export const toAuthorSafeTicket = (ticketDoc) => {
  const ticket = ticketDoc.toObject ? ticketDoc.toObject() : { ...ticketDoc };

  return {
    _id: ticket._id,
    ticketNumber: ticket.ticketNumber,
    author: ticket.author,
    book: ticket.book,
    subject: ticket.subject,
    description: ticket.description,
    attachments: ticket.attachments || [],
    status: ticket.status,
    category: {
      value: ticket.category?.value,
    },
    priority: {
      value: ticket.priority?.value,
    },
    firstResponseAt: ticket.firstResponseAt,
    resolvedAt: ticket.resolvedAt,
    lastActivityAt: ticket.lastActivityAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
};

export const emitTicketCreated = (ticket) => {
  if (!io) return;
  io.to('admins').emit('ticket:created', ticket);
};

export const emitTicketUpdated = (ticket, changes = {}) => {
  if (!io) return;
  const ticketId = ticket._id.toString();
  const authorId = ticket.author?._id ? ticket.author._id.toString() : ticket.author?.toString();

  // Admin and ticket room get full changes
  io.to('admins').emit('ticket:updated', { ticketId, changes });
  io.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, changes });

  // Author room gets author-safe changes only
  if (authorId) {
    const safeChanges = { ...changes };
    delete safeChanges.ai;
    if (safeChanges.category) {
      safeChanges.category = { value: safeChanges.category.value };
    }
    if (safeChanges.priority) {
      safeChanges.priority = { value: safeChanges.priority.value };
    }
    delete safeChanges.assignedTo;

    io.to(`author:${authorId}`).emit('ticket:updated', {
      ticketId,
      changes: safeChanges,
    });
  }
};

export const emitMessage = (message, ticket) => {
  if (!io) return;
  const ticketId = (ticket._id || message.ticket).toString();
  const authorId = ticket?.author?._id ? ticket.author._id.toString() : ticket?.author?.toString();

  if (message.type === 'internal_note') {
    // INTERNAL NOTES NEVER REACH AUTHORS
    io.to('admins').emit('message:created', message);
  } else {
    // Replies and system messages
    io.to('admins').emit('message:created', message);
    io.to(`ticket:${ticketId}`).emit('message:created', message);
    if (authorId) {
      io.to(`author:${authorId}`).emit('message:created', message);
    }
  }
};

export default {
  initSocket,
  getIO,
  toAuthorSafeTicket,
  emitTicketCreated,
  emitTicketUpdated,
  emitMessage,
};
