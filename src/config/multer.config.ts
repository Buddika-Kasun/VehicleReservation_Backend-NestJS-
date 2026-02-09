// src/config/multer.config.ts
/*
import { diskStorage } from 'multer';
import { extname } from 'path';

export const multerConfig = {
  storage: diskStorage({
    // Use Railway's temp directory or create in current directory
    destination: (req, file, cb) => {
      const uploadPath = process.env.UPLOAD_PATH || './tmp/uploads';
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const randomName = Array(32)
        .fill(null)
        .map(() => Math.round(Math.random() * 16).toString(16))
        .join('');
      cb(null, `${randomName}${extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg')
      .split(',')
      .map(type => type.trim());
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  },
};
*/

import { MulterModuleOptions } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';

export const multerConfig: MulterModuleOptions = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = './uploads/apps';
      
      // Create directory if it doesn't exist
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const uniqueSuffix = uuidv4();
      const extension = extname(file.originalname);
      const filename = `${Date.now()}-${uniqueSuffix}${extension}`;
      cb(null, filename);
    },
  }),
  fileFilter: (req, file, cb) => {
    // Accept only APK, IPA, and ZIP files
    const allowedExtensions = ['.apk', '.ipa', '.zip'];
    const allowedMimeTypes = [
      'application/vnd.android.package-archive', // APK MIME type
      'application/octet-stream', // IPA MIME type
      'application/zip', // ZIP MIME type
      'application/x-zip-compressed',
    ];

    const extension = extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();
    
    if (allowedExtensions.includes(extension) || allowedMimeTypes.includes(mimeType)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only APK, IPA, and ZIP files are allowed. Received: ${file.mimetype} with extension: ${extension}`), false);
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
};