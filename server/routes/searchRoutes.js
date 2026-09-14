import { Router } from 'express';
import { searchAll } from '../controllers/searchController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

// Global search across messages, conversations, and users
router.get('/', searchAll);

export default router;
