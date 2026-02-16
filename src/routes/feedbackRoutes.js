import express from 'express';
import {
  obterFeedbacks,
  criarFeedbackSemanal,
  criarFeedbackMensal,
  criarFeedbackInteligente,
  criarFeedbackSimples,
  testarConexaoIA
} from '../controllers/feedbackController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

import {roleMiddleware} from '../middleware/roleMiddleware.js';

const router = express.Router();

// Rotas principais
router.get('/', 
  authMiddleware, 
  obterFeedbacks
);
router.post('/semanal/:alunoId', criarFeedbackSemanal);
router.post('/mensal/:alunoId', criarFeedbackMensal);

router.post('/inteligente/:alunoId', 
  authMiddleware,
  roleMiddleware(['professor', 'tutor']), // Apenas professores/tutores
  criarFeedbackInteligente
);

// Rota legada (mantida para compatibilidade)
router.post('/simples', 
  authMiddleware,
  roleMiddleware(['sistema']), // Apenas integrações antigas
  criarFeedbackSimples
);

// Nova rota para análise específica
router.get('/analise/:alunoId', 
  authMiddleware,
  roleMiddleware(['professor', 'tutor']),
  async (req, res) => {
    // Implementação alternativa para análises rápidas
    res.status(501).json({ message: 'Em implementação' });
  }
);

// Rotas de administração
router.get('/admin/metricas', 
  authMiddleware,
  roleMiddleware(['admin']),
  async (req, res) => {
    // Futura implementação de métricas gerais
    res.status(501).json({ message: 'Endpoint em desenvolvimento' });
  }
);
router.get('/teste-ia', testarConexaoIA);

export default router;