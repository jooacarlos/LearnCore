import express from 'express';
import { uploadFile, uploadMiddleware } from '../controllers/uploadController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Upload de arquivos gerais
 */

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Realizar upload de arquivo
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               arquivo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Arquivo enviado com sucesso
 *       400:
 *         description: Erro no upload
 */
router.post('/upload', uploadMiddleware, uploadFile);

export default router;
