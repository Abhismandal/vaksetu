import { Router } from 'express';
import {
  getUsers,
  getUserById,
  updatePublicKey,
  getUserPublicKey,
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getUsers);
router.put('/public-key', updatePublicKey);
router.get('/:id/public-key', getUserPublicKey);
router.get('/:id', getUserById);

export default router;
