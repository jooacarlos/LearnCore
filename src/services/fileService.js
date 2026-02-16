// Substitua o conteúdo de fileService.js por:
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

export const saveFileLocally = (file, subfolder) => {
  const folderPath = path.join(UPLOADS_DIR, subfolder);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const uniqueName = `${Date.now()}-${file.originalname}`;
  const filePath = path.join(folderPath, uniqueName);

  fs.renameSync(file.path, filePath);
  return {
    url: `/uploads/${subfolder}/${uniqueName}`,
    path: filePath
  };
};

export const deleteLocalFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};