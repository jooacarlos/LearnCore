import mongoose from 'mongoose';

const userSchema = mongoose.Schema(
    {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        email: { 
            type: String, 
            required: true, 
            unique: true, 
            match: [/^\S+@\S+\.\S+$/, 'Por favor, forneça um email válido.'] 
        },
        password: { type: String, required: true },
        role: { 
            type: String, 
            enum: ['aluno', 'professor', 'admin'], // Adicionei 'admin' para escalabilidade
            required: true, // Removi o default para forçar definição explícita
            validate: {
                validator: function(v) {
                    return ['aluno', 'professor', 'admin'].includes(v);
                },
                message: props => `${props.value} não é um role válido!`
            }
        },
        
        // --- Campos específicos de PROFESSOR ---
        instituicao: { 
            type: String,
            required: function() { return this.role === 'professor'; } 
        },
        disciplinas: [{ 
            type: String,
            required: function() { return this.role === 'professor'; }
        }],
        
        // --- Campos específicos de ALUNO ---
        matricula: {
            type: String,
            required: function() { return this.role === 'aluno'; },
            unique: true
        },
        materias: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Materia'
}],

        
        // --- Campos compartilhados ---
        salas: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Sala'
        }],
        tarefas: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tarefa'
        }],
        feedbacks: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Feedback'
        }],
        notas: [{
            disciplina: String,
            valor: Number,
            data: { type: Date, default: Date.now }
        }],
        
        isActive: { 
            type: Boolean, 
            default: true 
        },
        
        // --- Metadados ---
        lastAccess: { type: Date },
        metadata: { type: mongoose.Schema.Types.Mixed }, // Para extensões futuras
        avatar: {
  type: String // Caminho da imagem ou URL (se for salvo na nuvem)
},

    },
    {
        timestamps: true,
        toJSON: { virtuals: true }, // Para incluir virtuals quando converter para JSON
        toObject: { virtuals: true }
    }
);

// Virtual para nome completo
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Middleware para limpar dados antes de salvar
userSchema.pre('save', function(next) {
    if (this.role !== 'professor') {
        this.instituicao = undefined;
        this.disciplinas = undefined;
    }
    if (this.role !== 'aluno') {
        this.matricula = undefined;
    }
    next();
});

const User = mongoose.model('User', userSchema);
export default User;