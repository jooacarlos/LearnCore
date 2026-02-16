import mongoose from "mongoose";

const MateriaSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, "O nome da matéria é obrigatório"],
      trim: true,
      maxlength: [100, "O nome não pode exceder 100 caracteres"],
      minlength: [3, "O nome deve ter pelo menos 3 caracteres"]
    },
    descricao: {
      type: String,
      trim: true,
      maxlength: [500, "A descrição não pode exceder 500 caracteres"]
    },
    codigo: {
      type: String,
      unique: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          return /^[A-Z]{3}\d{3}$/.test(v); // Exemplo: MAT123
        },
        message: "Código inválido (formato esperado: ABC123)"
      }
    },
    salas: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sala",
      
    }],
    professor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      validate: {
        validator: async function(v) {
          const user = await mongoose.model("User").findById(v);
          return user && user.role === "professor";
        },
        message: "O professor especificado não existe ou não tem a role correta"
      }
    },
    atividades: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tarefa",
      validate: {
        validator: async function(v) {
          const tarefa = await mongoose.model("Tarefa").findById(v);
          return tarefa && tarefa.professor.toString() === this.professor.toString();
        },
        message: "Tarefa não encontrada ou não pertence ao professor"
      }
    }],
    arquivos: [{
      nome: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      },
      tipo: {
        type: String,
        required: true
      },
      tamanho: {
        type: Number,
        required: true
      },
      publicId: {
        type: String
      },
      dataUpload: {
        type: Date,
        default: Date.now
      }
    }],
    dataCriacao: {
      type: Date,
      default: Date.now
    },
    isAtiva: {
      type: Boolean,
      default: true
    },
    cor: {
      type: String,
      default: "#3b82f6",
      validate: {
        validator: function(v) {
          return /^#([0-9a-f]{3}){1,2}$/i.test(v);
        },
        message: "Cor inválida (formato hexadecimal)"
      }
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    versionKey: false
  }
);

// Índices para melhorar performance nas queries mais comuns
MateriaSchema.index({ nome: 1, professor: 1 }, { unique: true });
MateriaSchema.index({ salas: 1 }); // Para buscar matérias por sala
MateriaSchema.index({ professor: 1 }); // Para listar matérias do professor

// Virtual para contar atividades ativas
MateriaSchema.virtual("atividadesAtivas").get(function() {
  if (!this.atividades || this.atividades.length === 0) return 0;
  return this.atividades.length;
});

// Virtual para contar salas ativas
MateriaSchema.virtual("salasAtivas").get(function() {
  return this.salas?.length || 0;
});

// Virtual para contar materiais disponíveis
MateriaSchema.virtual("totalMateriais").get(function() {
  return this.arquivos?.length || 0;
});

// Middleware para validação antes de salvar
MateriaSchema.pre("save", async function(next) {
  // Validação do professor
  if (this.isModified("professor")) {
    const professor = await mongoose.model("User").findById(this.professor);
    if (!professor || professor.role !== "professor") {
      throw new Error("O usuário especificado não é um professor válido");
    }
  }

  // Formatação do código
  if (this.isModified("codigo") && this.codigo) {
    this.codigo = this.codigo.toUpperCase();
  }
  next();
});

// Middleware para limpeza de referências ao remover
MateriaSchema.pre("remove", async function(next) {
  try {
    // Remove a matéria das salas vinculadas
    await mongoose.model("Sala").updateMany(
      { materias: this._id },
      { $pull: { materias: this._id } }
    );

    // Remove os arquivos do Cloudinary
    if (this.arquivos && this.arquivos.length > 0) {
      await Promise.all(
        this.arquivos.map(file => 
          file.publicId ? deleteFromCloudinary(file.publicId) : Promise.resolve()
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Adicione esta função se estiver usando Cloudinary
async function deleteFromCloudinary(publicId) {
  // Implementação da função de deletar do Cloudinary
  // (deve ser importada de um serviço)
}

const Materia = mongoose.model("Materia", MateriaSchema);
export default Materia;