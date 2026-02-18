import express from "express";
import {
  criarMateria,
  vincularSala,
  listarMaterias,
  getMateriaDetalhes,
  atualizarMateria,
  desvincularSala,
  deletarMateria,
  listarMateriaisPorSala,
  uploadMaterial,
  removerMaterial
} from "../controllers/materiaController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";
import { upload } from "../config/multerConfig.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Matérias
 *   description: Gerenciamento de matérias e materiais didáticos
 */

// 🔒 Todas as rotas exigem autenticação
router.use(authMiddleware);

/**
 * @swagger
 * /api/materias:
 *   post:
 *     summary: Criar nova matéria (apenas professor)
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *             properties:
 *               nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *     responses:
 *       201:
 *         description: Matéria criada com sucesso
 */
router.post("/", roleMiddleware(['professor']), criarMateria);

/**
 * @swagger
 * /api/materias:
 *   get:
 *     summary: Listar matérias (professor e admin)
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de matérias
 */
router.get("/", roleMiddleware(['professor', 'admin']), listarMaterias);

/**
 * @swagger
 * /api/materias/{id}:
 *   get:
 *     summary: Obter detalhes da matéria
 *     tags: [Matérias]
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
 *         description: Detalhes da matéria
 */
router.get("/:id",
  roleMiddleware(['professor', 'admin', 'aluno']),
  getMateriaDetalhes
);

/**
 * @swagger
 * /api/materias/{id}:
 *   put:
 *     summary: Atualizar matéria (apenas professor)
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               descricao:
 *                 type: string
 *     responses:
 *       200:
 *         description: Matéria atualizada com sucesso
 */
router.put("/:id",
  roleMiddleware(['professor']),
  atualizarMateria
);

/**
 * @swagger
 * /api/materias/{id}:
 *   delete:
 *     summary: Deletar matéria (apenas professor)
 *     tags: [Matérias]
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
 *         description: Matéria removida com sucesso
 */
router.delete("/:id",
  roleMiddleware(['professor']),
  deletarMateria
);

/**
 * @swagger
 * /api/materias/{materiaId}/salas/{salaId}:
 *   post:
 *     summary: Vincular matéria a uma sala
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: materiaId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: salaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matéria vinculada à sala
 */
router.post("/:materiaId/salas/:salaId",
  roleMiddleware(['professor']),
  vincularSala
);

/**
 * @swagger
 * /api/materias/{materiaId}/salas/{salaId}:
 *   delete:
 *     summary: Desvincular matéria de uma sala
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: materiaId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: salaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matéria desvinculada da sala
 */
router.delete("/:materiaId/salas/:salaId",
  roleMiddleware(['professor']),
  desvincularSala
);

/**
 * @swagger
 * /api/materias/salas/{salaId}:
 *   get:
 *     summary: Listar materiais por sala
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salaId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de materiais da sala
 */
router.get("/salas/:salaId",
  roleMiddleware(['professor', 'aluno']),
  listarMateriaisPorSala
);

/**
 * @swagger
 * /api/materias/{id}/materiais:
 *   post:
 *     summary: Upload de materiais (até 5 arquivos)
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               arquivos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Arquivos enviados com sucesso
 */
router.post("/:id/materiais",
  roleMiddleware(['professor']),
  upload.array('arquivos', 5),
  uploadMaterial
);

/**
 * @swagger
 * /api/materias/{id}/materiais/{materialId}:
 *   delete:
 *     summary: Remover material da matéria
 *     tags: [Matérias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: materialId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Material removido com sucesso
 */
router.delete("/:id/materiais/:materialId",
  roleMiddleware(['professor']),
  removerMaterial
);

export default router;
