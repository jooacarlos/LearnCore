import mongoose from 'mongoose';

const competenciaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    enum: ['Interpretação de Texto', 'Cálculo Algébrico', 'Análise Crítica', 'Resolução de Problemas', 'Gestão de Tempo']
  },
  nivel: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  }
}, { _id: false });

const dificuldadeSchema = new mongoose.Schema({
  topico: {
    type: String,
    required: true
  },
  categoria: {
    type: String,
    enum: ['conceitual', 'pratica', 'temporal', 'avaliacao'],
    required: true
  },
  nivel: {
    type: Number,
    min: 1,
    max: 3
  }
}, { _id: false });

const entregaSchema = new mongoose.Schema({
  aluno: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  respostaTexto: {
    type: String,
    default: ''
  },
  anexos: [{
    nome: String,
    url: String,
    tipo: String,
    tamanho: Number,
    publicId: String
  }],
  dataEntrega: {
    type: Date,
    default: null
  },
  // Atualize o enum de status na entregaSchema:
  status: {
    type: String,
    enum: ['pendente', 'entregue', 'pendente_correcao', 'corrigida', 'devolvida', 'atrasada'],
    default: 'pendente'
  },

  feedback: {
    texto: String,
    nota: {
      type: Number,
      min: 0,
      max: 100
    },
    dataCorrecao: Date,
    competencias: [competenciaSchema],
    dificuldades: [dificuldadeSchema],
    observacoesProfessor: String
  },
  tempoExecucao: Number
}, { _id: false });

const tarefaSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'O título da atividade é obrigatório'],
    trim: true,
    maxlength: [100, 'O título não pode exceder 100 caracteres']
  },
  descricao: {
    type: String,
    required: [true, 'A descrição é obrigatória'],
    maxlength: [2000, 'A descrição não pode exceder 2000 caracteres']
  },
  materia: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Materia',
    required: true
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  turmas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sala',
    required: [true, 'Selecione pelo menos uma turma']
  }],
  alunosAtribuidos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dataCriacao: {
    type: Date,
    default: Date.now
  },
  dataEntrega: {
    type: Date,
    required: [true, 'A data de entrega é obrigatória']
  },
  tipoAtividade: {
    type: String,
    enum: ['prova', 'exercicio', 'trabalho', 'apresentacao', 'quiz', 'projeto'],
    required: true
  },
  topicosAbordados: [{
    type: String,
    required: true
  }],
   imagem: {
    nome: String,
    url: String,
    tipo: String,
    tamanho: Number,
    publicId: String
  },
  anexos: [{
    nome: String,
    url: String,
    tipo: String,
    tamanho: Number,
    publicId: String
  }],

  entregas: [entregaSchema],

  valor: {
    type: Number,
    required: true,
    min: [1, 'O valor mínimo é 1 ponto'],
    max: [100, 'O valor máximo é 100 pontos']
  },
  criteriosAvaliacao: [{
    descricao: String,
    peso: Number
  }],
  entregas: [entregaSchema],
  statusGeral: {
    type: String,
    enum: [
      'ativa',
      'parcialmente_entregue',
      'totalmente_entregue',
      'pendente_correcao',
      'parcialmente_corrigida',
      'totalmente_corrigida',
      'arquivada'
    ],
    default: 'ativa'
  },
  visivelParaAlunos: {
    type: Boolean,
    default: true
  },
  metadata: {
    rastreamento: {
      atualizadoEm: Date,
      versaoFeedback: Number
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices
tarefaSchema.index({ professor: 1 });
tarefaSchema.index({ turmas: 1 });
tarefaSchema.index({ statusGeral: 1 });
tarefaSchema.index({ dataEntrega: 1 });
tarefaSchema.index({ materia: 1 });
tarefaSchema.index({ 'entregas.aluno': 1 });

// Virtuals
tarefaSchema.virtual('atrasada').get(function () {
  return new Date() > this.dataEntrega;
});

tarefaSchema.virtual('progresso').get(function() {
  const totalAlunos = this.alunosAtribuidos?.length || 0;
  const entregues = this.entregas?.filter(e => 
    ['entregue', 'pendente_correcao', 'corrigida'].includes(e.status)
  )?.length || 0;
  const corrigidas = this.entregas?.filter(e => e.status === 'corrigida')?.length || 0;
  
  return {
    entregues: `${entregues}/${totalAlunos}`,
    corrigidas: `${corrigidas}/${totalAlunos}`,
    percentualEntregue: totalAlunos > 0 ? Math.round((entregues / totalAlunos) * 100) : 0,
    percentualCorrigido: totalAlunos > 0 ? Math.round((corrigidas / totalAlunos) * 100) : 0
  };
});

// Middlewares
tarefaSchema.pre('save', function(next) {
  // Atualiza status de atraso
  this.entregas.forEach(entrega => {
    if (entrega.status === 'pendente' && new Date() > this.dataEntrega) {
      entrega.status = 'atrasada';
    }
  });

  // Atualiza status geral da tarefa
  const totalAlunos = this.alunosAtribuidos.length;
  const entregues = this.entregas.filter(e => 
    ['entregue', 'pendente_correcao', 'corrigida'].includes(e.status)
  ).length;
  const pendentesCorrecao = this.entregas.filter(e => e.status === 'pendente_correcao').length;
  const corrigidas = this.entregas.filter(e => e.status === 'corrigida').length;

  if (this.isModified('entregas') || this.isNew) {
    if (totalAlunos === 0) {
      this.statusGeral = 'ativa';
    } else if (corrigidas === totalAlunos) {
      this.statusGeral = 'totalmente_corrigida';
    } else if (corrigidas > 0) {
      this.statusGeral = 'parcialmente_corrigida';
    } else if (pendentesCorrecao > 0) {
      this.statusGeral = 'pendente_correcao';
    } else if (entregues === totalAlunos) {
      this.statusGeral = 'totalmente_entregue';
    } else if (entregues > 0) {
      this.statusGeral = 'parcialmente_entregue';
    } else {
      this.statusGeral = 'ativa';
    }
  }

  // Atualiza metadados
  if (!this.metadata) this.metadata = {};
  if (!this.metadata.rastreamento) this.metadata.rastreamento = {};
  
  this.metadata.rastreamento.atualizadoEm = new Date();
  
  if (this.isModified('entregas.feedback')) {
    this.metadata.rastreamento.versaoFeedback = 
      (this.metadata.rastreamento.versaoFeedback || 0) + 1;
  }

  next();
});

tarefaSchema.pre('remove', async function(next) {
  await mongoose.model('Sala').updateMany(
    { _id: { $in: this.turmas } },
    { $pull: { tarefas: this._id } }
  );
  next();
});

// Métodos de instância
tarefaSchema.methods.enviarAtividade = function(alunoId, dadosEntrega) {
  const entregaIndex = this.entregas.findIndex(e => e.aluno.equals(alunoId));
  
  if (entregaIndex === -1) {
    // Nova entrega
    this.entregas.push({
      aluno: alunoId,
      respostaTexto: dadosEntrega.respostaTexto,
      anexos: dadosEntrega.anexos || [],
      dataEntrega: new Date(),
      status: 'entregue',
      tempoExecucao: dadosEntrega.tempoExecucao
    });
  } else {
    // Atualiza entrega existente
    this.entregas[entregaIndex] = {
      ...this.entregas[entregaIndex].toObject(),
      respostaTexto: dadosEntrega.respostaTexto,
      anexos: dadosEntrega.anexos || [],
      dataEntrega: new Date(),
      status: 'entregue',
      tempoExecucao: dadosEntrega.tempoExecucao
    };
  }
  
  // Atualiza automaticamente para pendente_correcao após 1 minuto
  setTimeout(async () => {
    const tarefa = await this.model('Tarefa').findById(this._id);
    const entrega = tarefa.entregas.find(e => e.aluno.equals(alunoId));
    if (entrega && entrega.status === 'entregue') {
      entrega.status = 'pendente_correcao';
      await tarefa.save();
    }
  }, 60000); // 1 minuto
};

tarefaSchema.methods.corrigirAtividade = function(alunoId, feedbackTexto, nota) {
  const entrega = this.entregas.find(e => e.aluno.equals(alunoId));
  if (!entrega) throw new Error('Entrega não encontrada para correção');
  
  entrega.feedback = {
    texto: feedbackTexto,
    nota: nota,
    dataCorrecao: new Date()
  };
  
  entrega.status = 'corrigida';
};

const Tarefa = mongoose.model('Tarefa', tarefaSchema);

export default Tarefa;
