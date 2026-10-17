import asyncHandler from '../utils/asyncHandler.js';
import authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });

  res.status(200).json({
    data: result,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  // req.user is already populated by auth middleware
  res.status(200).json({
    data: req.user,
  });
});

export const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({
    data: { message: 'Logged out successfully' },
  });
});

export default {
  login,
  getMe,
  logout,
};
