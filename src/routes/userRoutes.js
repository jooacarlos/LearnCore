import express from 'express';
import {
  registerUser,
  loginUser,
  getMe,
  updateUser,
  listAlunos,
  listProfessores,
  getAlunoDetails
} from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { roleMiddleware } from '../middleware/roleMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Usuários
 *   description: Gerenciamento de usuários (alunos, professores e admin)
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - email
 *               - senha
 *               - role
 *             properties:
 *               nome:
 *                 type: string
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [aluno, professor, admin]
 *     responses:
 *       201:
 *         description: Usuário registrado com sucesso
 *       400:
 *         description: Erro de validação
 */
router.post('/register', registerUser);

/**
 * @swagger
 * /api/users/login:
 *   post:
 *     summary: Login do usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - senha
 *             properties:
 *               email:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado com sucesso (retorna JWT)
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', loginUser);

// 🔒 Todas as rotas abaixo exigem autenticação
router.use(authMiddleware);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Obter dados do usuário logado
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado
 *       401:
 *         description: Não autorizado
 */
router.get('/me', getMe);

/**
 * @swagger
 * /api/users:
 *   put:
 *     summary: Atualizar dados do próprio usuário
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               senha:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       401:
 *         description: Não autorizado
 */
router.put('/', updateUser);

/**
 * @swagger
 * /api/users/alunos:
 *   get:
 *     summary: Listar todos os alunos
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de alunos
 *       403:
 *         description: Acesso negado (somente professor ou admin)
 */
router.get(
  '/alunos',
  roleMiddleware(['professor', 'admin']),
  listAlunos
);

/**
 * @swagger
 * /api/users/alunos/{id}:
 *   get:
 *     summary: Obter detalhes de um aluno específico
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do aluno
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados do aluno
 *       403:
 *         description: Acesso negado
 */
router.get(
  '/alunos/:id',
  roleMiddleware(['professor', 'admin']),
  getAlunoDetails
);

/**
 * @swagger
 * /api/users/professores:
 *   get:
 *     summary: Listar todos os professores
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de professores
 *       403:
 *         description: Acesso negado (somente admin)
 */
router.get(
  '/professores',
  roleMiddleware(['admin']),
  listProfessores
);

export default router;
