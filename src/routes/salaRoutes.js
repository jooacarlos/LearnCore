import express from "express";
import { 
  criarSala, 
  adicionarAluno, 
  listarSalas, 
  removerAluno,
  getSalaDetalhes,
  getDashboardTurma,
  listarAlunosTurma,
  gerarLinkConvite,    // importe essa função
  entrarSalaPorCodigo  // importe essa função
} from "../controllers/salaController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Rotas protegidas por autenticação
router.use(authMiddleware);

// Criar sala (apenas professores)
router.post(
  "/",
  roleMiddleware('professor'),
  criarSala
);

// Adicionar aluno (apenas professor da sala)
router.post(
  "/:salaId/alunos",
  roleMiddleware('professor'),
  adicionarAluno
);

// Remover aluno (apenas professor da sala)
router.delete(
  "/:salaId/alunos/:alunoId",
  roleMiddleware('professor'),
  removerAluno
);

// Listar salas (adaptado para cada role)
router.get("/", listarSalas);

// Detalhes completos de uma sala específica (para membros da turma)
router.get("/:id", getSalaDetalhes);

// Dashboard consolidado da turma (para membros da turma)
router.get("/:id/dashboard", getDashboardTurma);

// Listar alunos de uma turma (para professor da turma)
router.get(
  "/:id/alunos",
  roleMiddleware(['professor','aluno', 'admin']),
  listarAlunosTurma
);

// NOVAS ROTAS:

// Gerar link convite para sala (apenas professor)
router.get(
  "/:id/link-convite",
  roleMiddleware('professor'),
  gerarLinkConvite
);
// rota para aluno entrar via código (apenas alunos logados podem acessar)
router.get("/entrar", roleMiddleware('aluno'), entrarSalaPorCodigo);

// Aluno entra na sala pelo código de acesso
router.post(
  "/entrar",
  roleMiddleware('aluno'),
  entrarSalaPorCodigo
);

export default router;
