import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import {
  uploadSingle,
  uploadMultiple,
  deleteUploadedFile,
} from '../controllers/uploadController.js';

const router = Router();

// Multer error handling wrapper
const handleUpload = (uploader) => (req, res, next) => {
  uploader(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds 25 MB limit',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Maximum 5 files can be uploaded at once',
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }
    next();
  });
};

// All upload routes require authentication
router.use(protect);

router.post('/single', handleUpload(upload.single('file')), uploadSingle);
router.post('/multiple', handleUpload(upload.array('files', 5)), uploadMultiple);
router.post('/', handleUpload(upload.single('file')), uploadSingle);
router.delete('/:filename', deleteUploadedFile);

export default router;
