import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');

/**
 * @desc    Upload single file
 * @route   POST /api/upload/single
 * @access  Private
 */
export const uploadSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was provided for upload',
      });
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        url: fileUrl,
        relativeUrl: `/uploads/${req.file.filename}`,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        filename: req.file.filename,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload multiple files (up to 5)
 * @route   POST /api/upload/multiple
 * @access  Private
 */
export const uploadMultiple = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files were provided for upload',
      });
    }

    const host = req.get('host');
    const protocol = req.protocol;

    const files = req.files.map((file) => ({
      url: `${protocol}://${host}/uploads/${file.filename}`,
      relativeUrl: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      type: file.mimetype,
      filename: file.filename,
    }));

    res.status(201).json({
      success: true,
      message: `${files.length} files uploaded successfully`,
      files,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an uploaded file by filename
 * @route   DELETE /api/upload/:filename
 * @access  Private
 */
export const deleteUploadedFile = async (req, res, next) => {
  try {
    const rawFilename = req.params.filename;
    if (!rawFilename) {
      return res.status(400).json({
        success: false,
        message: 'Filename parameter is required',
      });
    }

    // Sanitize to prevent path traversal
    const safeFilename = path.basename(rawFilename);
    const filePath = path.join(uploadsDir, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.status(200).json({
        success: true,
        message: 'File removed successfully',
      });
    }

    res.status(404).json({
      success: false,
      message: 'File not found on server',
    });
  } catch (error) {
    next(error);
  }
};
