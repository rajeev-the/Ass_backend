import asyncHandler from '../utils/asyncHandler.js';
import bookService from '../services/book.service.js';
import ticketService from '../services/ticket.service.js';

export const getBooks = asyncHandler(async (req, res) => {
  const result = await bookService.getAuthorBooksWithSummary(req.user._id);
  res.status(200).json({
    data: result,
  });
});

export const getBookById = asyncHandler(async (req, res) => {
  const book = await bookService.getAuthorBookById(req.user._id, req.params.bookId);
  res.status(200).json({
    data: book,
  });
});

export const getTickets = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await ticketService.getAuthorTickets(req.user._id, query);
  res.status(200).json({
    data: result.tickets,
    meta: result.meta,
  });
});

export const createTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.createAuthorTicket(req.user._id, req.body);
  res.status(201).json({
    data: ticket,
  });
});

export const getTicketById = asyncHandler(async (req, res) => {
  const result = await ticketService.getAuthorTicketById(req.user._id, req.params.id);
  res.status(200).json({
    data: result,
  });
});

export const addMessage = asyncHandler(async (req, res) => {
  const message = await ticketService.addAuthorMessage(req.user._id, req.params.id, req.body.body);
  res.status(201).json({
    data: message,
  });
});

export default {
  getBooks,
  getBookById,
  getTickets,
  createTicket,
  getTicketById,
  addMessage,
};
