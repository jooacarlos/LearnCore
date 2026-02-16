import mongoose from "mongoose";
import User from './userModel.js';

const SalaSchema = new mongoose.Schema({
  nome: { 
    type: String, 
    required: [true, "O nome da sala é obrigatório"],
    trim: true,
    maxlength: [100, "Nome não pode exceder 100 caracteres"],
    minlength: [3, "Nome deve ter pelo menos 3 caracteres"]
  },
  descricao: { 
    type: String,
    trim: true,
    maxlength: [500, "Descrição não pode exceder 500 caracteres"]
  },
  professor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    validate: {
      validator: async function(id) {
        const user = await mongoose.model("User").findById(id);
        return user?.role === "professor";
      },
      message: "O usuário referenciado não é um professor válido"
    }
  },
  alunos: [{ 
  type: mongoose.Schema.Types.ObjectId, 
  ref: "User",
  validate: {
    validator: async function(id) {  // recebe 1 id por vez
      const user = await mongoose.model("User").findById(id);
      return user?.role === "aluno";
    },
    message: "Apenas alunos podem ser adicionados à sala"
  }
}],
  materias: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Materia"
    // Removida validação assíncrona para evitar problemas com 'this.professor'
  }],
  tarefas: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Tarefa" 
  }],
  avisos: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Aviso"
  }],
  codigoAcesso: {
    type: String,
    unique: true,
    uppercase: true,
    default: function() {
      return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  },
  dataCriacao: {
    type: Date,
    default: Date.now
  },
  isAtiva: {
    type: Boolean,
    default: true
  },
  configuracao: {
    corTema: {
      type: String,
      default: "#4f46e5",
      validate: {
        validator: function(v) {
          return /^#([0-9a-f]{3}){1,2}$/i.test(v);
        },
        message: "Cor inválida (formato hexadecimal)"
      }
    },
    permiteAutoInscricao: {
      type: Boolean,
      default: true
    }
  }
}, {
  versionKey: false,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.id;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.id;
      return ret;
    }
  }
});

// Índices para otimização
SalaSchema.index({ nome: 1, professor: 1 }, { unique: true });
SalaSchema.index({ alunos: 1 });
SalaSchema.index({ "configuracao.permiteAutoInscricao": 1 });

// Virtuals calculados
SalaSchema.virtual("totalAlunos").get(function() {
  return this.alunos?.length || 0;
});

SalaSchema.virtual("totalMaterias").get(function() {
  return this.materias?.length || 0;
});

SalaSchema.virtual("totalTarefas").get(function() {
  return this.tarefas?.length || 0;
});

SalaSchema.virtual("tarefasPendentes").get(function() {
  if (!this.populated("tarefas")) return 0;
  return this.tarefas.filter(t => t.status === "pendente").length;
});

SalaSchema.virtual("proximaTarefa").get(function() {
  if (!this.populated("tarefas")) return null;
  return this.tarefas
    .filter(t => ["pendente", "ativa"].includes(t.status))
    .sort((a, b) => new Date(a.dataEntrega) - new Date(b.dataEntrega))[0];
});

// Middlewares
SalaSchema.pre("save", async function(next) {
  if (this.isModified("professor")) {
    const professor = await mongoose.model("User").findById(this.professor);
    if (!professor || professor.role !== "professor") {
      throw new Error("Apenas professores podem ser responsáveis por salas");
    }
  }

  if (this.isModified("alunos") && this.alunos) {
    this.alunos = [...new Set(this.alunos)]; // Remove duplicados
  }

  next();
});

SalaSchema.pre("remove", async function(next) {
  try {
    await Promise.all([
      // Remove referências nos usuários
      mongoose.model("User").updateMany(
        { $or: [{ _id: this.professor }, { _id: { $in: this.alunos } }] },
        { $pull: { salas: this._id } }
      ),

      // Remove referências nas matérias
      mongoose.model("Materia").updateMany(
        { _id: { $in: this.materias } },
        { $pull: { salas: this._id } }
      ),

      // Remove tarefas associadas
      mongoose.model("Tarefa").deleteMany({ _id: { $in: this.tarefas } }),

      // Remove avisos associados
      mongoose.model("Aviso").deleteMany({ _id: { $in: this.avisos } })
    ]);

    next();
  } catch (error) {
    next(error);
  }
});

// Métodos estáticos
SalaSchema.statics.gerarCodigoAcessoUnico = async function() {
  let codigo;
  do {
    codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (await this.exists({ codigoAcesso: codigo }));
  return codigo;
};

const Sala = mongoose.model("Sala", SalaSchema);
export default Sala;
