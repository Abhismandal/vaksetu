import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize original filename and ensure unique timestamp prefix
    let ext = path.extname(file.originalname);
    if (!ext) {
      if (file.mimetype.includes('webm')) ext = '.webm';
      else if (file.mimetype.includes('mp4')) ext = '.mp4';
      else if (file.mimetype.includes('ogg')) ext = '.ogg';
      else if (file.mimetype.includes('wav')) ext = '.wav';
      else if (file.mimetype.includes('mpeg') || file.mimetype.includes('mp3')) ext = '.mp3';
      else if (file.mimetype.includes('png')) ext = '.png';
      else if (file.mimetype.includes('jpeg')) ext = '.jpg';
    }
    const baseName = (path.basename(file.originalname, ext) || 'upload')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

// Allowed file types filter
const fileFilter = (req, file, cb) => {
  const allowedMimePatterns = [
    /^image\//,                          // jpeg, png, gif, webp, svg
    /^audio\//,                          // mp3, wav, ogg, webm, aac
    /^video\//,                          // mp4, webm, ogg, quicktime
    /^application\/pdf$/,                // PDF
    /^application\/msword$/,             // DOC
    /^application\/vnd\.openxmlformats/, // DOCX, XLSX, PPTX
    /^application\/vnd\.ms-/,            // XLS, PPT
    /^text\//,                           // Plain text, markdown, csv
    /^application\/json$/,               // JSON
    /^application\/zip$/,                // ZIP
    /^application\/x-zip-compressed$/,   // ZIP (Windows)
    /^application\/x-tar$/,              // TAR
    /^application\/gzip$/,               // GZIP
  ];

  const isAllowed = allowedMimePatterns.some((pattern) => pattern.test(file.mimetype));

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Allowed types include images, documents, audio, video, and archives.`
      ),
      false
    );
  }
};

// Multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit
    files: 5,                   // Maximum 5 files per batch
  },
});

export default upload;
