// src/common/config/multer.config.ts
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidV4 } from 'uuid';

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads/profiles',
    filename: (req, file, callback) => {
      const fileExtName = extname(file.originalname);
      const randomName = uuidV4();
      callback(null, `${randomName}${fileExtName}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return callback(new Error('Only image files (JPG, JPEG, PNG) are allowed!'), false);
    }
    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
};