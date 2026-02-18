import express from 'express';
import {
  criarTarefa,
  listarTarefas,
  listarTarefasPendentes,
  entregarTarefa,
  corrigirEntrega,
  atualizarTarefa,
  removerTarefa,
  obterTarefaPorId,
  devolverTarefa
} from '../controllers/tarefaController.js';

import { authMiddleware } from '../middleware/authMiddleware.js';
import { isProfessor } from '../middleware/roleMiddleware.js';
import { upload } from "../config/multerConfig.js";

const router = express.Router();

router.use(authMiddleware);

/* =====================================================
   ROTAS PROFESSOR
===================================================== */

/**
 * @swagger
 * /api/tarefas:
 *   post:
 *     summary: Criar nova tarefa
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               descricao:
 *                 type: string
 *               prazo:
 *                 type: string
 *                 format: date
 *               imagem:
 *                 type: string
 *                 format: binary
 *               anexos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Tarefa criada com sucesso
 */
router.post('/',
  isProfessor,
  upload.fields([
    { name: 'imagem', maxCount: 1 },
    { name: 'anexos', maxCount: 5 }
  ]),
  criarTarefa
);

/**
 * @swagger
 * /api/tarefas/{id}:
 *   put:
 *     summary: Atualizar tarefa
 *     tags: [Tarefas]
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
 *         description: Tarefa atualizada com sucesso
 */
router.put('/:id',
  isProfessor,
  upload.fields([
    { name: 'imagem', maxCount: 1 },
    { name: 'anexos', maxCount: 5 }
  ]),
  atualizarTarefa
);

/**
 * @swagger
 * /api/tarefas/{id}:
 *   delete:
 *     summary: Remover tarefa
 *     tags: [Tarefas]
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
 *         description: Tarefa removida com sucesso
 */
router.delete('/:id',
  isProfessor,
  removerTarefa
);

/**
 * @swagger
 * /api/tarefas/{id}/corrigir/{alunoId}:
 *   post:
 *     summary: Corrigir entrega de um aluno
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: alunoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tarefa corrigida com sucesso
 */
router.post('/:id/corrigir/:alunoId',
  isProfessor,
  upload.none(),
  corrigirEntrega
);

/**
 * @swagger
 * /api/tarefas/{id}/devolver/{alunoId}:
 *   post:
 *     summary: Devolver tarefa para o aluno refazer
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: alunoId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tarefa devolvida com sucesso
 */
router.post('/:id/devolver/:alunoId',
  isProfessor,
  upload.none(),
  devolverTarefa
);

/* =====================================================
   ROTAS ALUNO
===================================================== */

/**
 * @swagger
 * /api/tarefas/{id}/entregar:
 *   post:
 *     summary: Entregar tarefa
 *     tags: [Tarefas]
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
 *               anexos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Tarefa entregue com sucesso
 */
router.post('/:id/entregar',
  upload.array('anexos', 3),
  entregarTarefa
);

/* =====================================================
   ROTAS COMPARTILHADAS
===================================================== */

/**
 * @swagger
 * /api/tarefas:
 *   get:
 *     summary: Listar todas as tarefas
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tarefas
 */
router.get('/', listarTarefas);

/**
 * @swagger
 * /api/tarefas/pendentes:
 *   get:
 *     summary: Listar tarefas pendentes
 *     tags: [Tarefas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de tarefas pendentes
 */
router.get('/pendentes', listarTarefasPendentes);

/**
 * @swagger
 * /api/tarefas/{id}:
 *   get:
 *     summary: Obter tarefa por ID
 *     tags: [Tarefas]
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
 *         description: Dados da tarefa
 */
router.get('/:id', obterTarefaPorId);

export default router;
