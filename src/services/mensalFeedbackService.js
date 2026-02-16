import Tarefa from '../models/tarefaModel.js';
import Feedback from '../models/feedbackModels.js';
import { analyzeCompetencies } from './ollamaService.js';

export const gerarFeedbackMensal = async (alunoId) => {
  const umMesAtras = new Date();
  umMesAtras.setMonth(umMesAtras.getMonth() - 1);

  const tarefas = await Tarefa.find({
    'entregas.aluno': alunoId,
    'entregas.status': 'corrigida',
    'entregas.dataCorrecao': { $gte: umMesAtras }
  }).populate('materia', 'nome');

  if (tarefas.length === 0) {
    throw new Error('Nenhuma atividade corrigida no último mês');
  }

  const competencias = await analyzeCompetencies({
    atividades: tarefas.map(t => ({
      materia: t.materia.nome,
      nota: t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota,
      topicos: t.topicosAbordados,
      dificuldades: t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.dificuldades
    }))
  });

  const feedback = new Feedback({
    alunoId,
    tipo: 'mensal',
    diagnostico: {
      topicosDificuldade: competencias.topicosDificuldade,
      pontosFortes: competencias.pontosFortes,
      pontosMelhoria: competencias.pontosMelhoria
    },
    planoEstudos: gerarPlanoMensal(competencias),
    metadata: {
      modeloIA: process.env.OLLAMA_MODEL || 'llama2',
      versao: '1.0'
    }
  });

  return feedback.save();
};

function gerarPlanoMensal(competencias) {
  return {
    periodo: '1 mês',
    focoPrincipal: competencias.topicosDificuldade.slice(0, 3).map(t => t.topico),
    cronograma: competencias.topicosDificuldade.map(topico => ({
      topico: topico.topico,
      acoes: [
        `Revisão de conceitos básicos de ${topico.topico}`,
        `Prática diária de exercícios`,
        `Aulas de reforço semanais`
      ],
      recursos: [
        `Livro didático - Capítulo ${Math.floor(Math.random() * 10) + 1}`,
        `Playlist de vídeos recomendados`
      ]
    }))
  };
}