import axios from 'axios';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODELO_PADRAO = process.env.OLLAMA_MODEL || 'llama2';
const TIMEOUT = process.env.OLLAMA_TIMEOUT || 45000; // 45 segundos

// Configuração do Axios com interceptors
const axiosInstance = axios.create({
  baseURL: OLLAMA_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Interceptor para retry automático
axiosInstance.interceptors.response.use(null, async (error) => {
  const config = error.config;
  
  if (!config || !config.__isRetryRequest) {
    config.__isRetryRequest = true;
    config.__retryCount = config.__retryCount || 0;
    
    if (config.__retryCount >= 3) {
      return Promise.reject(error);
    }
    
    config.__retryCount += 1;
    const delay = Math.min(1000 * config.__retryCount, 5000);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return axiosInstance(config);
  }
  
  return Promise.reject(error);
});

/**
 * Testa a conexão com o serviço Ollama
 * @returns {Promise<Object>} Status do serviço
 */


export const testConnection = async () => {
  try {
    const startTime = Date.now();
    
    // Teste modificado para lidar melhor com erros
    const pingResponse = await axios.get(`${OLLAMA_BASE_URL}`, {
      timeout: 3000
    });
    
    if (pingResponse.data !== 'Ollama is running') {
      throw new Error('Resposta inesperada do Ollama');
    }

    return {
      status: 'operacional',
      modelo: MODELO_PADRAO,
      versao: '3.0',
      tempoResposta: Date.now() - startTime
    };
  } catch (error) {
    console.error('Erro detalhado:', {
      url: error.config?.url,
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    return {
      status: 'indisponível',
      error: error.code === 'ECONNREFUSED' ? 
        'Ollama não está respondendo - verifique se o serviço está rodando' :
        error.message,
      solution: 'Execute "ollama serve" em outro terminal'
    };
  }
};

/**
 * Gera feedback semanal personalizado
 */
export const generateSemanalFeedback = async (data, detalhado = false) => {
  try {
    const prompt = buildSemanalPrompt(data, detalhado);
    const startTime = Date.now();
    
    const response = await axiosInstance.post('/api/generate', {
      model: MODELO_PADRAO,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: detalhado ? 0.5 : 0.7,
        top_p: 0.9,
        num_ctx: 4096
      }
    });

    return {
      ...parseAIResponse(response.data.response),
      metadata: {
        modelo: MODELO_PADRAO,
        tempoProcessamento: Date.now() - startTime,
        prompt: detalhado ? prompt : undefined // Opcional: logar o prompt completo
      }
    };
  } catch (error) {
    console.error('[OLLAMA] Erro no feedback semanal:', {
      message: error.message,
      prompt: error.config?.data,
      stack: error.stack
    });
    throw new Error(`Falha na geração: ${error.message}`);
  }
};

/**
 * Gera análise mensal completa
 */
export const generateMensalFeedback = async (data) => {
  try {
    const prompt = buildMensalPrompt(data);
    const startTime = Date.now();

    const response = await axiosInstance.post('/api/generate', {
      model: MODELO_PADRAO,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.4,
        top_p: 0.95,
        num_ctx: 8192
      }
    });

    return {
      ...parseAIResponse(response.data.response),
      metadata: {
        modelo: MODELO_PADRAO,
        tempoProcessamento: Date.now() - startTime
      }
    };
  } catch (error) {
    console.error('[OLLAMA] Erro no feedback mensal:', error.message);
    throw new Error(`Falha na análise: ${error.message}`);
  }
};

/**
 * Analisa competências específicas
 */
export const analyzeCompetencies = async (atividades) => {
  try {
    const prompt = buildCompetenciesPrompt(atividades);
    const startTime = Date.now();

    const response = await axiosInstance.post('/api/generate', {
      model: MODELO_PADRAO,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.3,
        top_p: 0.8
      }
    });

    return {
      ...parseCompetencies(response.data.response),
      metadata: {
        modelo: MODELO_PADRAO,
        tempoProcessamento: Date.now() - startTime
      }
    };
  } catch (error) {
    console.error('[OLLAMA] Erro na análise:', error.message);
    throw new Error(`Falha na avaliação: ${error.message}`);
  }
};

// ========== FUNÇÕES AUXILIARES ==========

const buildSemanalPrompt = (data) => {
  const { aluno, metricas, atividades, historico } = data;
  return `Como especialista em educação, analise o desempenho semanal de ${aluno.nome}:

DADOS:
${JSON.stringify({
  media: metricas.mediaGeral,
  evolucao: calcularEvolucao(historico),
  atividades: atividades.map(a => ({
    materia: a.materia,
    tipo: a.tipoAtividade,
    nota: a.nota,
    competencias: a.competencias
  }))
}, null, 2)}

FORME UM FEEDBACK COM:
1. Visão geral (3-4 frases)
2. 2 pontos fortes com exemplos
3. 1 área para melhoria com sugestões

SAÍDA EM JSON (campos: resumo, pontosFortes, melhorias)`;
};

const buildMensalPrompt = (data) => {
  // Similar ao semanal, mas com análise mais aprofundada
};

const buildCompetenciesPrompt = (atividades) => {
  // Implementação específica para análise de competências
};

const parseAIResponse = (response) => {
  try {
    const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Falha ao parsear:', response.slice(0, 200));
    return { erro: "Resposta inválida do modelo" };
  }
};

const parseCompetencies = (response) => {
  // Lógica específica para competências
};

const calcularEvolucao = (historico) => {
  // Lógica para calcular tendência
};

export default {
  testConnection,
  generateSemanalFeedback,
  generateMensalFeedback,
  analyzeCompetencies
};