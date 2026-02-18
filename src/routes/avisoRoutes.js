import express from "express";
import {
  criarAviso,
  listarAvisos,
  getAvisoPorId,
  atualizarAviso,
  deletarAviso
} from "../controllers/avisoController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { upload } from "../config/multerConfig.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Avisos
 *   description: Gerenciamento de avisos das turmas
 */

// 🔒 Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @swagger
 * /api/turmas/{turmaId}/avisos:
 *   post:
 *     summary: Criar aviso para uma turma (com anexos opcionais)
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - mensagem
 *             properties:
 *               titulo:
 *                 type: string
 *               mensagem:
 *                 type: string
 *               anexos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Aviso criado com sucesso
 */
router.post(
  "/turmas/:turmaId/avisos",
  upload.array('anexos', 3),
  criarAviso
);

/**
 * @swagger
 * /api/turmas/{turmaId}/avisos/json:
 *   post:
 *     summary: Criar aviso via JSON (sem anexos)
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - mensagem
 *             properties:
 *               titulo:
 *                 type: string
 *               mensagem:
 *                 type: string
 *     responses:
 *       201:
 *         description: Aviso criado com sucesso (sem anexos)
 */
router.post(
  "/turmas/:turmaId/avisos/json",
  (req, res, next) => {
    req.body.anexos = [];
    next();
  },
  criarAviso
);

/**
 * @swagger
 * /api/turmas/{turmaId}/avisos:
 *   get:
 *     summary: Listar avisos de uma turma
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: turmaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de avisos da turma
 */
router.get("/turmas/:turmaId/avisos", listarAvisos);

/**
 * @swagger
 * /api/avisos/{id}:
 *   get:
 *     summary: Obter aviso específico por ID
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do aviso
 */
router.get("/avisos/:id", getAvisoPorId);

/**
 * @swagger
 * /api/avisos/{id}:
 *   put:
 *     summary: Atualizar aviso (com possibilidade de novos anexos)
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               mensagem:
 *                 type: string
 *               anexos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Aviso atualizado com sucesso
 */
router.put(
  "/avisos/:id",
  upload.array('anexos', 3),
  atualizarAviso
);

/**
 * @swagger
 * /api/avisos/{id}:
 *   delete:
 *     summary: Deletar aviso
 *     tags: [Avisos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Aviso deletado com sucesso
 */
router.delete("/avisos/:id", deletarAviso);

export default router;
