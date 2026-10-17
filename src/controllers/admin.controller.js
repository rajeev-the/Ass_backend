import asyncHandler from '../utils/asyncHandler.js';
import ticketService from '../services/ticket.service.js';

export const getTickets = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || req.query;
  const result = await ticketService.getAdminTickets({
    ...query,
    adminUserId: req.user._id,
  });

  res.status(200).json({
    data: result.tickets,
    meta: result.meta,
  });
});

export const getStats = asyncHandler(async (req, res) => {
  const stats = await ticketService.getAdminTicketStats(req.user?._id);
  res.status(200).json({
    data: stats,
  });
});

export const getTicketById = asyncHandler(async (req, res) => {
  const result = await ticketService.getAdminTicketById(req.params.id);
  res.status(200).json({
    data: result,
  });
});

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.updateTicket(req.params.id, req.user, req.body);
  res.status(200).json({
    data: ticket,
  });
});

export const assignToMe = asyncHandler(async (req, res) => {
  const ticket = await ticketService.assignTicketToMe(req.params.id, req.user);
  res.status(200).json({
    data: ticket,
  });
});

export const addMessage = asyncHandler(async (req, res) => {
  const message = await ticketService.addAdminMessage(req.params.id, req.user, req.body);
  res.status(201).json({
    data: message,
  });
});

export const getAuthorById = asyncHandler(async (req, res) => {
  const result = await ticketService.getAuthorWithBooks(req.params.id);
  res.status(200).json({
    data: result,
  });
});

export const getAiDraft = asyncHandler(async (req, res) => {
  const regenerate = req.query.regenerate === 'true';
  const result = await ticketService.getOrGenerateDraft(req.params.id, { regenerate });
  res.status(200).json({
    data: result,
  });
});

export const reclassifyTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.reclassifyTicket(req.params.id);
  res.status(200).json({
    data: ticket,
  });
});

export const getAiConfig = asyncHandler(async (_req, res) => {
  const { aiClient } = await import('../services/ai/aiClient.js');
  const config = await aiClient.getPublicConfig();
  res.status(200).json({
    data: config,
  });
});

export const updateAiConfig = asyncHandler(async (req, res) => {
  const { aiClient } = await import('../services/ai/aiClient.js');
  const updated = await aiClient.updateConfig(req.body);
  res.status(200).json({
    data: updated,
  });
});

export default {
  getTickets,
  getStats,
  getTicketById,
  updateTicket,
  assignToMe,
  addMessage,
  getAuthorById,
  getAiDraft,
  reclassifyTicket,
  getAiConfig,
  updateAiConfig,
};
