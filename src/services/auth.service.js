import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

export const login = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw AppError.invalidCredentials('Invalid email or password');
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    throw AppError.invalidCredentials('Invalid email or password');
  }

  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    }
  );

  return {
    token,
    user,
  };
};

export const getMe = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }
  return user;
};

export default {
  login,
  getMe,
};
