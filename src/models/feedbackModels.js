import mongoose from 'mongoose';

const competenciaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    trim: true
  },
  nivel: {
    type: String,
    enum: ['DOMINADA', 'INTERMEDIARIA', 'FRACA'],
    required: true
  },
  nota: {
    type: Number,
    min: 0,
    max: 100
  },
  evidencia: {
    type: String,
    trim: true
  }
}, { _id: false });

const dificuldadeSchema = new mongoose.Schema({
  topico: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    enum: ['conceitual', 'pratica', 'temporal', 'avaliacao'],
    required: true
  },
  nivel: {
    type: Number,
    min: 1,
    max: 3,
    default: 1
  }
}, { _id: false });

const atividadeRecomendadaSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    trim: true
  },
  descricao: {
    type: String,
    required: true,
    trim: true
  },
  recurso: {
    type: String,
    trim: true
  },
  prazo: {
    type: Date
  }
}, { _id: false });

const feedbackIASchema = new mongoose.Schema({
  resumo: {
    type: String,
    required: true,
    trim: true
  },
  analiseDetalhada: {
    type: String,
    trim: true
  },
  recomendacoes: {
    type: [String],
    default: []
  },
  exercicios: {
    type: [String],
    default: []
  }
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  alunoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tipo: {
    type: String,
    enum: ['semanal', 'mensal', 'inteligente', 'simples'],
    required: true
  },
  periodo: {
    inicio: {
      type: Date,
      required: true
    },
    fim: {
      type: Date,
      required: true
    }
  },
  metricas: {
    mediaGeral: {
      type: Number,
      min: 0,
      max: 100
    },
    evolucao: [{
      semana: Number,
      nota: Number,
      data: Date
    }],
    comparativoTurma: Number,
    competencias: [competenciaSchema],
    dificuldades: [dificuldadeSchema]
  },
  diagnostico: {
    pontosFortes: [competenciaSchema],
    pontosMelhoria: [competenciaSchema],
    topicosDificuldade: [dificuldadeSchema],
    tendencias: [String]
  },
  feedbackIA: feedbackIASchema,
  atividadesRecomendadas: [atividadeRecomendadaSchema],
  atividades: [{
    id: mongoose.Schema.Types.ObjectId,
    titulo: String,
    tipo: String,
    nota: Number
  }],
  metadata: {
    geradoPorIA: {
      type: Boolean,
      default: false
    },
    modelo: {
      type: String,
      trim: true
    },
    versao: {
      type: String,
      trim: true
    },
    dataGeracao: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
feedbackSchema.index({ alunoId: 1, tipo: 1 });
feedbackSchema.index({ 'periodo.inicio': 1, 'periodo.fim': 1 });
feedbackSchema.index({ createdAt: 1 });

// Virtuals
feedbackSchema.virtual('progresso').get(function() {
  const pontosFortes = this.diagnostico?.pontosFortes?.length || 0;
  const pontosMelhoria = this.diagnostico?.pontosMelhoria?.length || 1;
  return Math.round((pontosFortes / (pontosFortes + pontosMelhoria)) * 100);
});

// Middleware
feedbackSchema.pre('save', function(next) {
  if (this.isNew) {
    if (this.tipo === 'semanal' && !this.periodo.inicio) {
      this.periodo = {
        inicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        fim: new Date()
      };
    }
    if (this.tipo === 'mensal' && !this.periodo.inicio) {
      this.periodo = {
        inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        fim: new Date()
      };
    }
  }
  next();
});

export default mongoose.model('Feedback', feedbackSchema);