import Tarefa from '../models/tarefaModel.js';
import Feedback from '../models/feedbackModels.js';
import { calcularMediaTurma } from './analyticsService.js';

export const gerarFeedbackSemanal = async (alunoId) => {
  const umaSemanaAtras = new Date();
  umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

  // Busca as tarefas recentes corrigidas do aluno usando $elemMatch
  const tarefas = await getAtividadesRecentes(alunoId, umaSemanaAtras);

  if (tarefas.length === 0) {
    throw new Error('Nenhuma atividade corrigida na última semana');
  }

  // Cálculo das métricas
  const metricas = {
    totalAtividades: tarefas.length,
    mediaGeral: calcularMediaSemanal(tarefas, alunoId),
    comparativoTurma: await calcularMediaTurma(tarefas[0].turmas[0]?._id || null, alunoId)
  };

  // Cria o objeto feedback
  const feedback = new Feedback({
    alunoId,
    tipo: 'semanal',
    metricas,
    diagnostico: {
      pontosFortes: identificarPontosFortes(tarefas, alunoId),
      pontosMelhoria: identificarPontosMelhoria(tarefas, alunoId)
    },
    metadata: {
      versao: '1.0',
      dataGeracao: new Date()
    }
  });

  return feedback.save();
};

// Função que busca as tarefas corrigidas da última semana para o aluno
async function getAtividadesRecentes(alunoId, dataLimite) {
  return await Tarefa.find({
    entregas: {
      $elemMatch: {
        aluno: alunoId,
        status: 'corrigida',
        'feedback.dataCorrecao': { $gte: dataLimite }
      }
    }
  }).populate('materia', 'nome turmas');
}

// Calcula a média das notas das tarefas corrigidas
function calcularMediaSemanal(tarefas, alunoId) {
  const notas = tarefas.map(t =>
    t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota
  );
  return notas.reduce((sum, nota) => sum + nota, 0) / notas.length;
}

// Identifica os pontos fortes (notas >= 80%)
function identificarPontosFortes(tarefas, alunoId) {
  return tarefas
    .filter(t => {
      const entrega = t.entregas.find(e => e.aluno.toString() === alunoId.toString());
      return entrega.feedback.nota >= 8; // Ajustado para nota máxima 10 (80% = 8)
    })
    .slice(0, 3)
    .map(t => ({
      nome: t.materia.nome,
      nivel: 'DOMINADA',
      nota: t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota
    }));
}

// Identifica os pontos a melhorar (notas < 80%)
function identificarPontosMelhoria(tarefas, alunoId) {
  return tarefas
    .filter(t => {
      const entrega = t.entregas.find(e => e.aluno.toString() === alunoId.toString());
      return entrega.feedback.nota < 8;
    })
    .slice(0, 3)
    .map(t => ({
      nome: t.materia.nome,
      nivel: 'A MELHORAR',
      nota: t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota
    }));
}
