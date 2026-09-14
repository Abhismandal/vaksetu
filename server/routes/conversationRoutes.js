import { Router } from 'express';
import {
  getConversations,
  createOrGetConversation,
  getConversationById,
  getMessages,
  togglePinConversation,
} from '../controllers/conversationController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/', getConversations);
router.post('/', createOrGetConversation);
router.get('/:id', getConversationById);
router.get('/:id/messages', getMessages);
router.put('/:id/pin', togglePinConversation);

export default router;
