import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'outros';
    
    // Determina a pasta baseado no tipo de arquivo
    if (file.mimetype.startsWith('image/')) {
      folder = 'atividades';
    } else if ([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.sheet',
      'text/plain'
    ].includes(file.mimetype)) {
      folder = 'materiais';
    }

    const uploadPath = path.join(process.cwd(), 'uploads', folder);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Aceita todos os tipos de arquivo, mas organiza nas pastas corretas
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { 
    fileSize: 25 * 1024 * 1024 // 25MB
  }
});

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nenhum arquivo enviado' 
      });
    }

    const folder = req.file.mimetype.startsWith('image/') ? 'atividades' : 'materiais';
    const filePath = `/uploads/${folder}/${req.file.filename}`;

    res.json({
      success: true,
      filePath,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar upload',
      error: error.message 
    });
  }
};

export const uploadMiddleware = upload.single('file');