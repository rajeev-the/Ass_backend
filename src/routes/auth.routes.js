import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.schema.js';

const router = Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.getMe);

export default router;
