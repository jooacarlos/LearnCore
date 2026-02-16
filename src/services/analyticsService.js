import mongoose from 'mongoose';
import Tarefa from '../models/tarefaModel.js';
import Materia from '../models/materiaModels.js';
import Feedback from '../models/feedbackModels.js';

/**
 * Serviço de análise de desempenho acadêmico
 */
export const calcularDesempenho = async (alunoId) => {
    // 1. Buscar todas as tarefas corrigidas do aluno
    const tarefas = await Tarefa.find({
        'entregas.aluno': alunoId,
        'entregas.status': 'corrigida'
    }).populate('professor', 'nome');

    if (tarefas.length === 0) {
        throw new Error('Nenhuma tarefa corrigida encontrada para análise');
    }

    // 2. Calcular métricas básicas
    const metricasBasicas = calcularMetricasBasicas(tarefas, alunoId);

    // 3. Análise por matéria
    const desempenhoPorMateria = await analisarPorMateria(tarefas, alunoId);

    // 4. Evolução temporal
    const evolucaoTemporal = calcularEvolucaoTemporal(tarefas, alunoId);

    // 5. Comparativo com a turma
    const comparativoTurma = await calcularComparativoTurma(tarefas[0].turmas[0], alunoId);

    return {
        ...metricasBasicas,
        materias: desempenhoPorMateria,
        evolucao: evolucaoTemporal,
        comparativo: comparativoTurma,
        ultimaAtualizacao: new Date()
    };
};

// Funções auxiliares internas
const calcularMetricasBasicas = (tarefas, alunoId) => {
    const notas = tarefas.map(t => 
        t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota
    );

    const mediaGeral = notas.reduce((sum, nota) => sum + nota, 0) / notas.length;
    const desempenhoRelativo = mediaGeral < 50 ? 'baixo' : mediaGeral < 70 ? 'medio' : 'alto';

    return {
        totalAtividades: notas.length,
        mediaGeral: parseFloat(mediaGeral.toFixed(2)),
        desempenhoRelativo,
        notaMaxima: Math.max(...notas),
        notaMinima: Math.min(...notas),
        variacaoNotas: calcularVariacao(notas)
    };
};

const analisarPorMateria = async (tarefas, alunoId) => {
    const materias = await Materia.find({ 
        _id: { $in: [...new Set(tarefas.map(t => t.materia))] } 
    });

    return materias.map(materia => {
        const tarefasMateria = tarefas.filter(t => t.materia.toString() === materia._id.toString());
        const notas = tarefasMateria.map(t => 
            t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota
        );

        const media = notas.reduce((sum, nota) => sum + nota, 0) / notas.length;
        
        return {
            materia: materia.nome,
            quantidadeAtividades: notas.length,
            media: parseFloat(media.toFixed(2)),
            pontosFortes: identificarPadroes(tarefasMateria, alunoId, 'forte'),
            pontosMelhoria: identificarPadroes(tarefasMateria, alunoId, 'fracasso')
        };
    });
};

const calcularEvolucaoTemporal = (tarefas, alunoId) => {
    return tarefas
        .map(t => ({
            data: t.dataEntrega,
            nota: t.entregas.find(e => e.aluno.toString() === alunoId.toString()).feedback.nota,
            tipo: t.tipo || 'regular'
        }))
        .sort((a, b) => new Date(a.data) - new Date(b.data));
};

const calcularComparativoTurma = async (turmaId, alunoId) => {
    const turma = await mongoose.model('Sala').findById(turmaId)
        .populate('alunos')
        .populate('tarefas');

    if (!turma) return null;

    const alunos = turma.alunos.filter(a => a._id.toString() !== alunoId.toString());
    const medias = await Promise.all(
        alunos.map(async aluno => {
            const tarefas = await Tarefa.find({
                'entregas.aluno': aluno._id,
                'entregas.status': 'corrigida',
                _id: { $in: turma.tarefas }
            });
            
            const notas = tarefas.map(t => 
                t.entregas.find(e => e.aluno.toString() === aluno._id.toString()).feedback.nota
            );
            
            return notas.length > 0 ? 
                notas.reduce((sum, nota) => sum + nota, 0) / notas.length : 
                0;
        })
    );

    const mediaTurma = medias.reduce((sum, media) => sum + media, 0) / medias.length;
    return {
        totalAlunos: alunos.length,
        mediaTurma: parseFloat(mediaTurma.toFixed(2)),
        posicaoRelativa: 'top 30%' // Placeholder - implementar lógica real
    };
};

const identificarPadroes = (tarefas, alunoId, tipo) => {
    // Implementação simplificada - pode ser aprimorada com IA
    const entregas = tarefas.map(t => 
        t.entregas.find(e => e.aluno.toString() === alunoId.toString())
    );

    if (tipo === 'forte') {
        return ['Resolução de problemas', 'Criatividade']; // Exemplo
    } else {
        return ['Gestão de tempo', 'Detalhamento']; // Exemplo
    }
};

const calcularVariacao = (notas) => {
    const media = notas.reduce((a, b) => a + b, 0) / notas.length;
    const variancia = notas.reduce((a, b) => a + Math.pow(b - media, 2), 0) / notas.length;
    return {
        desvioPadrao: parseFloat(Math.sqrt(variancia).toFixed(2)),
        coeficienteVariacao: parseFloat(((Math.sqrt(variancia) / media) * 100).toFixed(2))
    };
};

// Métodos adicionais para integração com o controller
export const gerarRelatorioConsolidado = async (alunoId) => {
    const [desempenho, feedbacks] = await Promise.all([
        calcularDesempenho(alunoId),
        Feedback.find({ alunoId }).sort({ createdAt: -1 }).limit(3)
    ]);

    return {
        ...desempenho,
        historicoFeedback: feedbacks.map(f => ({
            data: f.createdAt,
            pontosMelhoria: f.diagnostico.pontosMelhoria,
            progresso: f.progresso
        }))
    };
};

export const identificarTendencias = async (alunoId) => {
    const feedbacks = await Feedback.find({ alunoId })
        .sort({ createdAt: -1 })
        .limit(5);

    if (feedbacks.length < 3) {
        return { mensagem: 'Dados insuficientes para análise de tendência' };
    }

    // Lógica de análise de tendência (pode ser aprimorada)
    const melhoras = feedbacks[0].diagnostico.pontosMelhoria.filter(
        ponto => !feedbacks[4].diagnostico.pontosMelhoria.includes(ponto)
    );

    return {
        melhoras,
        alertas: feedbacks[0].diagnostico.pontosMelhoria.filter(
            ponto => !melhoras.includes(ponto))
    };
};

// Adicione estas novas funções:

export const calcularMediaTurma = async (turmaId, alunoId) => {
  const turma = await mongoose.model('Sala').findById(turmaId)
    .populate('alunos')
    .populate('tarefas');

  const notasTurma = await Promise.all(
    turma.alunos.map(async aluno => {
      const tarefas = await Tarefa.find({
        'entregas.aluno': aluno._id,
        'entregas.status': 'corrigida',
        _id: { $in: turma.tarefas }
      });
      const notas = tarefas.map(t => 
        t.entregas.find(e => e.aluno.toString() === aluno._id.toString()).feedback.nota
      );
      return notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
    })
  );

  const mediaTurma = notasTurma.reduce((a, b) => a + b, 0) / notasTurma.length;
  return parseFloat(mediaTurma.toFixed(2));
};

export const identificarTopicosDificuldade = async (alunoId, periodoDias = 30) => {
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - periodoDias);

  const tarefas = await Tarefa.find({
    'entregas.aluno': alunoId,
    'entregas.status': 'corrigida',
    'entregas.dataCorrecao': { $gte: dataInicio }
  });

  const topicos = {};
  
  tarefas.forEach(tarefa => {
    const entrega = tarefa.entregas.find(e => e.aluno.toString() === alunoId.toString());
    if (entrega.feedback.nota < 60) {
      tarefa.topicosAbordados.forEach(topico => {
        if (!topicos[topico]) {
          topicos[topico] = { erros: 0, total: 0 };
        }
        topicos[topico].erros++;
        topicos[topico].total++;
      });
    }
  });

  return Object.entries(topicos)
    .map(([topico, dados]) => ({
      topico,
      taxaErro: (dados.erros / dados.total) * 100,
      materia: tarefas.find(t => 
        t.topicosAbordados.includes(topico))?.materia
    }))
    .sort((a, b) => b.taxaErro - a.taxaErro);
};
export const getDesempenhoHistorico = async (alunoId, semanas = 4) => {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - semanas * 7);

  const feedbacks = await Feedback.find({
    alunoId,
    createdAt: { $gte: dataLimite }
  }).sort({ createdAt: 1 });

  return feedbacks.map(f => ({
    data: f.createdAt,
    media: f.metricas?.mediaGeral,
    desempenho: f.metricas?.desempenhoRelativo
  }));
};