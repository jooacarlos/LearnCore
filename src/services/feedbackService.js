import Feedback from '../models/feedbackModels.js';

export const gerarFeedback = async (alunoId, notas, presenca) => { // Corrigido o nome da função
    let erros = [];
    let sugestoes = [];

    // Analisar notas
    const mediaGeral = notas.reduce((acc, curr) => acc + curr.nota, 0) / notas.length;
    if (mediaGeral < 6) {
        sugestoes.push('Revisar os conteúdos básicos e praticar mais exercícios.');
        erros.push('Baixo desempenho nas atividades.');
    }

    // Analisar presença
    if (presenca < 75) {
        sugestoes.push('Frequência insuficiente, procure melhorar.');
        erros.push('Baixa presença nas aulas.');
    }

    // Criando feedback e salvando no banco
    const feedback = new Feedback({
        alunoId,
        notas,
        presenca,
        errosCometidos: erros,
        sugestoesEstudo: sugestoes
    });

    await feedback.save(); // Salva o feedback no MongoDB

    return feedback; // Retorna o feedback criado
};
