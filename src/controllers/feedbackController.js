import mongoose from 'mongoose';
import Feedback from '../models/feedbackModels.js';
import Tarefa from '../models/tarefaModel.js';
import User from '../models/userModel.js';
import {
  calcularDesempenho,
  calcularMediaTurma,
  getDesempenhoHistorico
} from '../services/analyticsService.js';
import {
  generateSemanalFeedback,
  generateMensalFeedback,
  analyzeCompetencies,
  testConnection
} from '../services/ollamaService.js';

// Helper function to get recent activities
async function getAtividadesRecentes(alunoId, dias) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);

  return await Tarefa.find({
    'entregas.aluno': alunoId,
    'entregas.status': 'corrigida',
    'entregas.dataCorrecao': { $gte: dataLimite }
  })
    .select('titulo tipoAtividade materia entregas.feedback')
    .populate('materia', 'nome');
}

// Helper function to get student data
async function getDadosAluno(alunoId) {
  return await User.findById(alunoId)
    .select('nome email materias')
    .populate('materias', 'nome');
}

// Helper function to get competencies data
async function getDadosCompetencias(alunoId) {
  const atividades = await getAtividadesRecentes(alunoId, 30);
  return atividades.map(a => ({
    materia: a.materia.nome,
    nota: a.entregas.find(e => e.aluno.equals(alunoId)).feedback.nota,
    competencias: a.entregas.find(e => e.aluno.equals(alunoId)).feedback.competencias || [],
    dificuldades: a.entregas.find(e => e.aluno.equals(alunoId)).feedback.dificuldades || []
  }));
}

// Error handler
function handleError(res, error, tipo) {
  console.error(`[Feedback ${tipo}] Erro:`, error);

  const statusCode = error.message.includes('Nenhum') ? 404 : 500;
  const messageMap = {
    semanal: {
      404: 'Nenhuma atividade recente encontrada',
      500: 'Erro ao gerar feedback semanal'
    },
    mensal: {
      404: 'Dados insuficientes para análise mensal',
      500: 'Erro ao gerar feedback mensal'
    },
    inteligente: {
      404: 'Dados insuficientes para análise inteligente',
      500: 'Erro no serviço de IA'
    }
  };

  res.status(statusCode).json({
    success: false,
    message: messageMap[tipo][statusCode] || 'Erro ao processar solicitação',
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
}

// Weekly Feedback
export const criarFeedbackSemanal = async (req, res) => {
  try {
    const { alunoId } = req.params;
    const { detalhado = 'false' } = req.query;

    // Get base data
    const [aluno, atividades, metricas] = await Promise.all([
      getDadosAluno(alunoId),
      getAtividadesRecentes(alunoId, 7),
      calcularDesempenho(alunoId, 'semanal')
    ]);

    if (!atividades.length) {
      throw new Error('Nenhuma atividade recente encontrada');
    }

    // Create base feedback
    const feedbackData = {
      alunoId,
      tipo: 'semanal',
      periodo: {
        inicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        fim: new Date()
      },
      metricas: {
        ...metricas,
        comparativoTurma: await calcularMediaTurma(alunoId)
      },
      atividades: atividades.map(a => ({
        id: a._id,
        titulo: a.titulo,
        tipo: a.tipoAtividade,
        nota: a.entregas.find(e => e.aluno.equals(alunoId)).feedback.nota
      })),
      diagnostico: {
        pontosFortes: [],
        pontosMelhoria: []
      }
    };

    // Add AI analysis if requested
    if (detalhado === 'true') {
      const aiAnalysis = await generateSemanalFeedback({
        aluno: {
          id: alunoId,
          nome: aluno.nome,
          email: aluno.email
        },
        atividades,
        metricas,
        historico: await getDesempenhoHistorico(alunoId, 4)
      });

      feedbackData.feedbackIA = aiAnalysis;
      feedbackData.diagnostico = aiAnalysis.diagnostico || feedbackData.diagnostico;
      feedbackData.metadata = {
        geradoPorIA: true,
        modelo: process.env.OLLAMA_MODEL || 'llama3',
        versao: '2.1',
        dataGeracao: new Date()
      };
    }

    // Save and return
    const feedback = new Feedback(feedbackData);
    await feedback.save();

    // WebSocket notification
    if (req.io) {
      req.io.to(`feedback_${alunoId}`).emit('feedback_atualizado', {
        tipo: 'semanal',
        alunoId,
        feedbackId: feedback._id
      });
    }

    res.status(201).json({
      success: true,
      message: detalhado === 'true' ?
        'Feedback semanal detalhado gerado com sucesso' :
        'Feedback semanal básico gerado com sucesso',
      feedback,
      usadoIA: detalhado === 'true'
    });

  } catch (error) {
    handleError(res, error, 'semanal');
  }
};

// Monthly Feedback
export const criarFeedbackMensal = async (req, res) => {
  try {
    const { alunoId } = req.params;
    const { recarregarIA = 'false' } = req.body;

    // Check cache
    if (recarregarIA === 'false') {
      const cachedFeedback = await Feedback.findOne({
        alunoId,
        tipo: 'mensal',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).sort({ createdAt: -1 });

      if (cachedFeedback) {
        return res.json({
          success: true,
          message: 'Feedback mensal recuperado do cache',
          feedback: cachedFeedback,
          cached: true
        });
      }
    }

    // Get all necessary data
    const [aluno, atividades, metricas, historico] = await Promise.all([
      getDadosAluno(alunoId),
      getAtividadesRecentes(alunoId, 30),
      calcularDesempenho(alunoId, 'mensal'),
      getDesempenhoHistorico(alunoId, 4)
    ]);

    // Generate AI analysis
    const aiAnalysis = await generateMensalFeedback({
      aluno: {
        id: alunoId,
        nome: aluno.nome,
        materias: aluno.materias.map(m => m.nome)
      },
      atividades,
      metricas,
      historico
    });

    // Create feedback document
    const feedback = new Feedback({
      alunoId,
      tipo: 'mensal',
      periodo: {
        inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        fim: new Date()
      },
      ...aiAnalysis,
      atividades: atividades.map(a => ({
        id: a._id,
        titulo: a.titulo,
        tipo: a.tipoAtividade,
        nota: a.entregas.find(e => e.aluno.equals(alunoId)).feedback.nota
      })),
      metadata: {
        geradoPorIA: true,
        modelo: process.env.OLLAMA_MODEL || 'llama3',
        versao: '2.1',
        dataGeracao: new Date()
      }
    });

    await feedback.save();

    // WebSocket notification
    if (req.io) {
      req.io.to(`feedback_${alunoId}`).emit('feedback_atualizado', {
        tipo: 'mensal',
        alunoId,
        feedbackId: feedback._id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Feedback mensal gerado com sucesso',
      feedback
    });

  } catch (error) {
    handleError(res, error, 'mensal');
  }
};

// Intelligent Feedback
export const criarFeedbackInteligente = async (req, res) => {
  try {
    const { alunoId } = req.params;
    const { forcarRecalculo = false } = req.body;

    // Check cache
    if (!forcarRecalculo) {
      const cachedFeedback = await Feedback.findOne({
        alunoId,
        tipo: 'inteligente',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }).sort({ createdAt: -1 });

      if (cachedFeedback) {
        return res.json({
          success: true,
          message: 'Feedback recente encontrado',
          feedback: cachedFeedback,
          cached: true
        });
      }
    }

    // Get all necessary data
    const [aluno, atividades, metricas, competencias] = await Promise.all([
      getDadosAluno(alunoId),
      getAtividadesRecentes(alunoId, 30),
      calcularDesempenho(alunoId, 'completo'),
      analyzeCompetencies(await getDadosCompetencias(alunoId))
    ]);

    // Create feedback document
    const feedback = new Feedback({
      alunoId,
      tipo: 'inteligente',
      periodo: {
        inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        fim: new Date()
      },
      metricas,
      diagnostico: competencias,
      atividades: atividades.map(a => ({
        id: a._id,
        titulo: a.titulo,
        tipo: a.tipoAtividade,
        nota: a.entregas.find(e => e.aluno.equals(alunoId)).feedback.nota
      })),
      feedbackIA: {
        resumo: 'Análise inteligente personalizada',
        recomendacoes: [
          'Revisar pontos de melhoria identificados',
          'Focar nas competências que precisam de desenvolvimento'
        ]
      },
      metadata: {
        geradoPorIA: true,
        modelo: process.env.OLLAMA_MODEL || 'llama3',
        versao: '2.1',
        dataGeracao: new Date()
      }
    });

    await feedback.save();

    // WebSocket notification
    if (req.io) {
      req.io.to(`feedback_${alunoId}`).emit('feedback_atualizado', {
        tipo: 'inteligente',
        alunoId,
        feedbackId: feedback._id
      });
    }

    res.status(201).json({
      success: true,
      message: 'Feedback inteligente gerado com sucesso',
      feedback,
      nextSteps: [
        'Revisar o plano de estudos sugerido',
        'Acompanhar as métricas de progresso'
      ]
    });

  } catch (error) {
    handleError(res, error, 'inteligente');
  }
};

// Get all feedbacks
export const obterFeedbacks = async (req, res) => {
  try {
    const { alunoId, tipo, limit = 10, page = 1 } = req.query;
    
    const filtro = {};
    if (alunoId) filtro.alunoId = new mongoose.Types.ObjectId(alunoId);
    if (tipo) filtro.tipo = tipo;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'alunoId', select: 'nome email' },
        { path: 'metadata.professorResponsavel', select: 'nome' }
      ]
    };

    const result = await Feedback.paginate(filtro, options);

    if (result.docs.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Nenhum feedback encontrado',
        suggestion: 'Verifique os filtros aplicados'
      });
    }

    res.json({
      success: true,
      total: result.totalDocs,
      limit: result.limit,
      page: result.page,
      pages: result.totalPages,
      results: result.docs,
      analytics: {
        mediaGeral: calcularMediaGeral(result.docs),
        progresso: calcularProgresso(result.docs)
      }
    });

  } catch (error) {
    console.error('[Obter Feedbacks] Erro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar feedbacks',
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Test AI connection
export const testarConexaoIA = async (req, res) => {
  try {
    const resultado = await testConnection();
    
    res.json({
      success: true,
      status: resultado.status,
      modelo: resultado.modelo,
      tempoResposta: resultado.tempoResposta,
      versao: '3.0'
    });
  } catch (error) {
    console.error('[Teste IA] Erro:', error);
    res.status(503).json({
      success: false,
      status: 'indisponível',
      error: error.message,
      solution: '1. Verifique o serviço Ollama\n2. Confira OLLAMA_URL no .env'
    });
  }
};

// Helper functions
function calcularMediaGeral(feedbacks) {
  const valores = feedbacks
    .filter(f => f.metricas?.mediaGeral)
    .map(f => f.metricas.mediaGeral);

  return valores.length
    ? parseFloat((valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(2))
    : null;
}


function calcularProgresso(feedbacks) {
  if (feedbacks.length < 2) return { status: 'dados_insuficientes' };

  const [ultimo, anterior] = feedbacks.slice(0, 2);
  const diferenca = ultimo.metricas?.mediaGeral - anterior.metricas?.mediaGeral;

  return {
    diferenca: parseFloat(diferenca.toFixed(2)),
    tendencia: diferenca > 0 ? 'melhoria' : diferenca < 0 ? 'regressao' : 'estavel',
    magnitude: Math.abs(diferenca) > 5 ? 'significativa' : 'moderada'
  };
}
// No feedbackController.js
export const criarFeedbackSimples = async (req, res) => {
  try {
    const { alunoId, conteudo } = req.body;
    
    const feedback = new Feedback({
      alunoId,
      tipo: 'simples',
      conteudo,
      createdAt: new Date()
    });

    await feedback.save();

    res.status(201).json({
      success: true,
      feedback
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao criar feedback simples'
    });
  }
};