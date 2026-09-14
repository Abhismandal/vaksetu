import { Router } from 'express';
import {
  chatWithAi,
  getAiConversation,
  rewriteMessageController,
  translateMessageController,
  summarizeConversationController,
  getSmartRepliesController,
} from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/conversation', getAiConversation);
router.post('/chat', chatWithAi);
router.post('/rewrite', rewriteMessageController);
router.post('/translate', translateMessageController);
router.post('/summarize', summarizeConversationController);
router.post('/smart-replies', getSmartRepliesController);

export default router;
