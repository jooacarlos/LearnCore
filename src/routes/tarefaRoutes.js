import express from 'express';
import {
  criarTarefa,
  listarTarefas,
  listarTarefasPendentes,
  entregarTarefa,
  corrigirEntrega, // Mantemos apenas o corrigirEntrega
  atualizarTarefa,
  removerTarefa,
  obterTarefaPorId,
  devolverTarefa
} from '../controllers/tarefaController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { isProfessor } from '../middleware/roleMiddleware.js';
import { upload, handleUploadErrors } from "../config/multerConfig.js";





const router = express.Router();

router.use(authMiddleware);

// Rotas para professores
router.post('/',
  isProfessor,
  upload.fields([
    { name: 'imagem', maxCount: 1 },
    { name: 'anexos', maxCount: 5 }
  ]),
  criarTarefa
);
// Adicione a rota para devolução:
router.post('/:id/devolver/:alunoId', 
  isProfessor,
  upload.none(),
  devolverTarefa
);

router.put('/:id',
  isProfessor,
  upload.fields([
    { name: 'imagem', maxCount: 1 },
    { name: 'anexos', maxCount: 5 }
  ]),
  atualizarTarefa
);

// Nova estrutura para correção de tarefas (por aluno específico)
router.post('/:id/corrigir/:alunoId', 
  isProfessor,
  upload.none(), // Não esperamos arquivos para correção
  corrigirEntrega
);

router.delete('/:id', 
  isProfessor,
  removerTarefa
);

// Rotas para alunos
router.post('/:id/entregar',
  upload.array('anexos', 3), // Limite de 3 anexos por entrega
  entregarTarefa
);

// Rotas compartilhadas
router.get('/', 
  listarTarefas
);

router.get('/pendentes', 
  listarTarefasPendentes
);

router.get('/:id', 
  obterTarefaPorId
);

export default router;