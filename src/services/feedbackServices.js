import Feedback from '../models/feedbackModels.js';
import { calcularDesempenho } from './analyticsService.js';
import { generateFeedback, analyzeCompetencies } from './ollamaService.js';
import Tarefa from '../models/tarefaModel.js';
import Aviso from '../models/avisoModel.js';

// Funções Principais
export const gerarFeedbackInteligente = async (alunoId) => {
    // ... (mantenha sua implementação existente)
};

export const gerarFeedbackSemanal = async (alunoId) => {
    try {
        // 1. Coletar dados da semana
        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

        const [tarefas, avisos] = await Promise.all([
            Tarefa.find({
                'entregas.aluno': alunoId,
                'entregas.status': 'corrigida',
                updatedAt: { $gte: umaSemanaAtras }
            }),
            Aviso.find({
                destinatarios: alunoId,
                createdAt: { $gte: umaSemanaAtras }
            })
        ]);

        // 2. Calcular métricas semanais
        const metricas = await calcularDesempenho(alunoId, { periodo: 'semanal' });

        // 3. Gerar feedback estruturado
        const feedback = {
            alunoId,
            tipo: 'semanal',
            periodo: {
                inicio: umaSemanaAtras,
                fim: new Date()
            },
            resumo: {
                tarefasCompletas: tarefas.length,
                avisosRecebidos: avisos.length,
                mediaSemanal: metricas.mediaSemanal || 0,
                comparativo: metricas.comparativoSemanal || 'estável'
            },
            destaques: {
                melhorDesempenho: tarefas.reduce((prev, curr) => 
                    (curr.entregas[0].feedback.nota > prev.nota) ? curr : prev
                ),
                areaDestaque: metricas.competenciaMaisForte || 'Não identificada'
            },
            recomendacoes: gerarRecomendacoesSemanais(tarefas, metricas)
        };

        // 4. Salvar no banco
        const feedbackDoc = new Feedback(feedback);
        await feedbackDoc.save();

        return feedbackDoc;

    } catch (error) {
        throw new Error(`Erro ao gerar feedback semanal: ${error.message}`);
    }
};

export const gerarFeedbackMensal = async (alunoId) => {
    try {
        // 1. Coletar dados do mês
        const umMesAtras = new Date();
        umMesAtras.setMonth(umMesAtras.getMonth() - 1);

        const [tarefas, feedbacksSemanais] = await Promise.all([
            Tarefa.find({
                'entregas.aluno': alunoId,
                updatedAt: { $gte: umMesAtras }
            }),
            Feedback.find({
                alunoId,
                tipo: 'semanal',
                createdAt: { $gte: umMesAtras }
            })
        ]);

        // 2. Calcular métricas mensais
        const metricas = await calcularDesempenho(alunoId, { periodo: 'mensal' });

        // 3. Gerar relatório consolidado
        const feedback = {
            alunoId,
            tipo: 'mensal',
            periodo: {
                inicio: umMesAtras,
                fim: new Date()
            },
            desempenho: {
                mediaMensal: metricas.mediaGeral,
                evolucao: calcularEvolucaoMensal(feedbacksSemanais),
                rankingCompetencias: metricas.rankingCompetencias || []
            },
            participacao: {
                totalTarefas: tarefas.length,
                taxaEntrega: metricas.taxaEntrega || 0,
                participacaoEventos: metricas.participacaoEventos || 0
            },
            relatorioIA: await gerarRelatorioMensalIA(alunoId, metricas, tarefas)
        };

        // 4. Salvar no banco
        const feedbackDoc = new Feedback(feedback);
        await feedbackDoc.save();

        return feedbackDoc;

    } catch (error) {
        throw new Error(`Erro ao gerar feedback mensal: ${error.message}`);
    }
};

export const gerarFeedbackLegado = async (alunoId, notas, presenca) => {
    // ... (mantenha sua implementação existente)
};

// Funções Auxiliares
const gerarRecomendacoesSemanais = (tarefas, metricas) => {
    const recomendacoes = [];
    
    if (metricas.mediaSemanal < 6) {
        recomendacoes.push('Reforçar estudos nas matérias com menor desempenho');
    }
    
    if (tarefas.length < 3) {
        recomendacoes.push('Aumentar participação nas atividades propostas');
    }

    return recomendacoes.length > 0 
        ? recomendacoes 
        : ['Manter o bom desempenho e continuar com o ritmo atual'];
};

const calcularEvolucaoMensal = (feedbacksSemanais) => {
    if (feedbacksSemanais.length < 2) return 'dados-insuficientes';
    
    const primeiro = feedbacksSemanais[0].resumo.mediaSemanal;
    const ultimo = feedbacksSemanais[feedbacksSemanais.length - 1].resumo.mediaSemanal;
    const diferenca = ultimo - primeiro;

    return {
        percentual: `${((diferenca / primeiro) * 100).toFixed(1)}%`,
        tendencia: diferenca > 0 ? 'positiva' : 'negativa',
        variacao: Math.abs(diferenca)
    };
};

const gerarRelatorioMensalIA = async (alunoId, metricas, tarefas) => {
    try {
        return await generateFeedback({
            tipo: 'relatorio-mensal',
            alunoId,
            metricas,
            historicoTarefas: tarefas.slice(0, 10).map(t => ({
                titulo: t.titulo,
                status: t.entregas[0]?.status,
                nota: t.entregas[0]?.feedback.nota
            }))
        });
    } catch (error) {
        console.error('Falha ao gerar relatório com IA:', error);
        return { erro: 'Relatório simplificado devido a falha na IA' };
    }
};

// Exportações organizadas
export default {
    gerarFeedbackInteligente,
    gerarFeedbackSemanal,
    gerarFeedbackMensal,
    gerarFeedbackLegado
};