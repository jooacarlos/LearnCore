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

// Rotas públicas
router.post('/register', registerUser); // Registro de usuário (aluno ou professor)
router.post('/login', loginUser);       // Login de usuário

// Todas as rotas abaixo exigem autenticação
router.use(authMiddleware);

// Rotas básicas de usuário
router.get('/me', getMe);               // Obter dados do usuário logado
router.put('/', updateUser);            // Atualizar próprio usuário

// Rotas para professores
router.get('/alunos', 
  roleMiddleware(['professor', 'admin']), 
  listAlunos
); // Listar todos os alunos

router.get('/alunos/:id', 
  roleMiddleware(['professor', 'admin']), 
  getAlunoDetails
); // Detalhes de um aluno específico

// Rotas apenas para admin
router.get('/professores', 
  roleMiddleware(['admin']), 
  listProfessores
); // Listar todos os professores

export default router;