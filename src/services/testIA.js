import { generateFeedback } from './ollamaService.js';

const testData = {
  aluno: "João Silva",
  notas: {
    matematica: 85,
    portugues: 60,
    historia: 45
  },
  competencias: {
    logica: "avançado",
    escrita: "básico"
  }
};

generateFeedback(testData)
  .then(console.log)
  .catch(console.error);