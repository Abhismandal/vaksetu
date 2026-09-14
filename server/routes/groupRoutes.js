import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createGroup,
  getGroupDetails,
  updateGroup,
  addMembers,
  removeMember,
  toggleAdmin,
} from '../controllers/groupController.js';

const router = Router();

// All group routes require authentication
router.use(protect);

router.post('/', createGroup);
router.get('/:id', getGroupDetails);
router.put('/:id', updateGroup);
router.post('/:id/members', addMembers);
router.delete('/:id/members/:memberId', removeMember);
router.put('/:id/admins/:memberId', toggleAdmin);

export default router;
