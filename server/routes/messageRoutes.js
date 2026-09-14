import { Router } from 'express';
import {
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  togglePinMessage,
  deleteSelectedMessages,
  toggleStarMessage,
  getStarredMessages,
  getPinnedMessages,
  getConversationMedia,
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.post('/', sendMessage);
router.get('/starred', getStarredMessages);
router.get('/pinned/:conversationId', getPinnedMessages);
router.get('/media/:conversationId', getConversationMedia);
router.post('/batch-delete', deleteSelectedMessages);

router.put('/:id', editMessage);
router.delete('/:id', deleteMessage);
router.post('/:id/reactions', reactToMessage);
router.put('/:id/pin', togglePinMessage);
router.post('/:id/star', toggleStarMessage);

export default router;
