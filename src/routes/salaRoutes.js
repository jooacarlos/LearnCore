import express from "express";
import { 
  criarSala, 
  adicionarAluno, 
  listarSalas, 
  removerAluno,
  getSalaDetalhes,
  getDashboardTurma,
  listarAlunosTurma,
  gerarLinkConvite,
  entrarSalaPorCodigo
} from "../controllers/salaController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Salas
 *   description: Gerenciamento de turmas/salas
 */

// 🔒 Todas as rotas exigem autenticação
router.use(authMiddleware);

/**
 * @swagger
 * /api/salas:
 *   post:
 *     summary: Criar nova sala (apenas professor)
 *     tags: [Salas]
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
 *     responses:
 *       201:
 *         description: Sala criada com sucesso
 *       403:
 *         description: Apenas professores podem criar salas
 */
router.post(
  "/",
  roleMiddleware('professor'),
  criarSala
);

/**
 * @swagger
 * /api/salas/{salaId}/alunos:
 *   post:
 *     summary: Adicionar aluno à sala (apenas professor)
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salaId
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
 *               - alunoId
 *             properties:
 *               alunoId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Aluno adicionado com sucesso
 *       403:
 *         description: Apenas professor da sala pode adicionar
 */
router.post(
  "/:salaId/alunos",
  roleMiddleware('professor'),
  adicionarAluno
);

/**
 * @swagger
 * /api/salas/{salaId}/alunos/{alunoId}:
 *   delete:
 *     summary: Remover aluno da sala (apenas professor)
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: salaId
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
 *         description: Aluno removido com sucesso
 *       403:
 *         description: Apenas professor da sala pode remover
 */
router.delete(
  "/:salaId/alunos/:alunoId",
  roleMiddleware('professor'),
  removerAluno
);

/**
 * @swagger
 * /api/salas:
 *   get:
 *     summary: Listar salas (retorno varia conforme role)
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de salas
 */
router.get("/", listarSalas);

/**
 * @swagger
 * /api/salas/{id}:
 *   get:
 *     summary: Obter detalhes completos da sala
 *     tags: [Salas]
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
 *         description: Detalhes da sala
 *       403:
 *         description: Acesso permitido apenas para membros
 */
router.get("/:id", getSalaDetalhes);

/**
 * @swagger
 * /api/salas/{id}/dashboard:
 *   get:
 *     summary: Obter dashboard consolidado da turma
 *     tags: [Salas]
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
 *         description: Dados consolidados da turma
 */
router.get("/:id/dashboard", getDashboardTurma);

/**
 * @swagger
 * /api/salas/{id}/alunos:
 *   get:
 *     summary: Listar alunos da turma
 *     tags: [Salas]
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
 *         description: Lista de alunos da turma
 */
router.get(
  "/:id/alunos",
  roleMiddleware(['professor','aluno','admin']),
  listarAlunosTurma
);

/**
 * @swagger
 * /api/salas/{id}/link-convite:
 *   get:
 *     summary: Gerar link de convite da sala (apenas professor)
 *     tags: [Salas]
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
 *         description: Link de convite gerado
 *       403:
 *         description: Apenas professor pode gerar link
 */
router.get(
  "/:id/link-convite",
  roleMiddleware('professor'),
  gerarLinkConvite
);

/**
 * @swagger
 * /api/salas/entrar:
 *   get:
 *     summary: Entrar na sala via código (aluno)
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entrada na sala realizada com sucesso
 *       403:
 *         description: Apenas alunos podem entrar via código
 */
router.get(
  "/entrar",
  roleMiddleware('aluno'),
  entrarSalaPorCodigo
);

/**
 * @swagger
 * /api/salas/entrar:
 *   post:
 *     summary: Entrar na sala pelo código (aluno)
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - codigo
 *             properties:
 *               codigo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Aluno entrou na sala com sucesso
 */
router.post(
  "/entrar",
  roleMiddleware('aluno'),
  entrarSalaPorCodigo
);

export default router;
