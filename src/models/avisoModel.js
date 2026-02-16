import mongoose from "mongoose";

const AvisoSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, "O título é obrigatório"],
    trim: true,
    maxlength: [100, "O título não pode exceder 100 caracteres"]
  },
  conteudo: {
    type: String,
    required: [true, "O conteúdo é obrigatório"],
    maxlength: [2000, "O conteúdo não pode exceder 2000 caracteres"]
  },
  turma: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sala",
    required: true
  },
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  anexos: [{
    url: String,
    nome: String,
    tipo: String,
    tamanho: Number
  }],
  dataPublicacao: {
    type: Date,
    default: Date.now
  },
  dataExpiracao: Date,
  prioridade: {
    type: String,
    enum: ["baixa", "media", "alta"],
    default: "baixa"
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para otimização
AvisoSchema.index({ turma: 1 });
AvisoSchema.index({ autor: 1 });
AvisoSchema.index({ dataPublicacao: -1 });

// Virtual para status (se expirado)
AvisoSchema.virtual("status").get(function() {
  if (this.dataExpiracao && new Date() > this.dataExpiracao) {
    return "expirado";
  }
  return "ativo";
});

export default mongoose.model("Aviso", AvisoSchema);