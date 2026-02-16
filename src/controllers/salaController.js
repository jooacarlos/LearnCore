import Sala from "../models/salaModels.js";
import User from "../models/userModel.js";
import Materia from "../models/materiaModels.js";
import Tarefa from "../models/tarefaModel.js";
import Aviso from "../models/avisoModel.js";
import mongoose from "mongoose";

// Função auxiliar para tratamento de erros
const handleError = (res, error, context) => {
  console.error(`Erro em ${context}:`, error);
  const statusCode = error.name === 'ValidationError' ? 400 : 500;
  return res.status(statusCode).json({
    success: false,
    message: `Erro ao ${context}`,
    error: error.message
  });
};

/**
 * @desc    Criar nova sala
 * @route   POST /api/salas
 * @access  Professor
 */

export const getDashboardTurma = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user;

    // Verifica se o usuário é membro da turma
    const isMember = await Sala.findOne({
      _id: id,
      $or: [
        { professor: userId },
        { alunos: userId }
      ]
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado"
      });
    }

    // Busca todos os dados em paralelo
    const [sala, materiais, avisos, tarefas, alunos] = await Promise.all([
      // Dados básicos da turma
      Sala.findById(id)
        .populate('professor', 'firstName lastName')
        .populate('materias', 'nome descricao'),
      
      // Materiais da turma
      Materia.find({ salas: id }).select('nome descricao arquivos'),
      
      // Últimos 5 avisos
      Aviso.find({ turma: id })
        .sort({ data: -1 })
        .limit(5)
        .populate('autor', 'firstName lastName'),
      
      // Tarefas pendentes do aluno (ou todas se for professor)
      role === 'aluno' 
        ? Tarefa.find({
            turmas: id,
            alunosAtribuidos: userId,
            status: { $in: ['pendente', 'ativa'] }
          }).sort({ dataEntrega: 1 }).limit(3)
        : Tarefa.find({ turmas: id })
            .sort({ dataEntrega: 1 })
            .limit(5),
      
      // Colegas de turma (apenas dados básicos)
      User.find({ salas: id, _id: { $ne: userId } })
        .select('firstName lastName avatar')
    ]);

    // Calcula progresso do aluno (se for aluno)
    const progresso = role === 'aluno' 
      ? await calcularProgressoAluno(id, userId)
      : null;

    return res.json({
      success: true,
      data: {
        turma: {
          ...sala.toObject(),
          totalAlunos: sala.alunos.length
        },
        materiais,
        avisos,
        tarefas,
        alunos,
        progresso
      }
    });

  } catch (error) {
    return handleError(res, error, "obter dashboard da turma");
  }
};

/**
 * @desc    Listar alunos de uma turma
 * @route   GET /api/salas/:id/alunos
 * @access  Professor da turma
 */
export const listarAlunosTurma = async (req, res) => {
  try {
    const { id } = req.params;

    const sala = await Sala.findOne({
      _id: id,
      $or: [
        { professor: req.user.id },
        { alunos: req.user.id }
      ]
    }).populate('alunos', 'firstName lastName email avatar');

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Sala não encontrada ou permissão negada"
      });
    }

    return res.json({
      success: true,
      count: sala.alunos.length,
      data: sala.alunos
    });

  } catch (error) {
    return handleError(res, error, "listar alunos da turma");
  }
};

/**
 * @desc    Calcular progresso do aluno na turma
 * @param   {string} turmaId - ID da turma
 * @param   {string} alunoId - ID do aluno
 * @return  {Promise<Object>} Objeto com dados de progresso
 */
async function calcularProgressoAluno(turmaId, alunoId) {
  const [totalTarefas, tarefasCompletas] = await Promise.all([
    Tarefa.countDocuments({ 
      turmas: turmaId, 
      alunosAtribuidos: alunoId 
    }),
    Tarefa.countDocuments({ 
      turmas: turmaId, 
      alunosAtribuidos: alunoId,
      status: 'corrigida' 
    })
  ]);

  return {
    porcentagem: totalTarefas > 0 
      ? Math.round((tarefasCompletas / totalTarefas) * 100) 
      : 0,
    tarefasCompletas,
    totalTarefas
  };
}
export const criarSala = async (req, res) => {
  try {
    const { nome, descricao, materiaId } = req.body;

    // Validação básica
    if (!nome || !materiaId) {
      return res.status(400).json({
        success: false,
        message: "Nome e ID da matéria são obrigatórios"
      });
    }

    const [materia, professor] = await Promise.all([
      Materia.findById(materiaId),
      User.findById(req.user.id)
    ]);

    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada"
      });
    }

    const novaSala = await Sala.create({
      nome,
      descricao,
      professor: req.user.id,
      materias: [materiaId]
    });

    // Atualiza referências em paralelo
    await Promise.all([
      User.findByIdAndUpdate(req.user.id, { $addToSet: { salas: novaSala._id } }),
      Materia.findByIdAndUpdate(materiaId, { $addToSet: { salas: novaSala._id } })
    ]);

    const salaCriada = await Sala.findById(novaSala._id)
      .populate('professor', 'firstName lastName email')
      .populate('materias', 'nome descricao')
      .lean();

    return res.status(201).json({
      success: true,
      message: "Sala criada com sucesso",
      data: salaCriada
    });

  } catch (error) {
    return handleError(res, error, "criar sala");
  }
};

/**
 * @desc    Adicionar aluno à sala
 * @route   POST /api/salas/:salaId/alunos
 * @access  Professor da sala
 */
export const adicionarAluno = async (req, res) => {
  try {
    const { salaId } = req.params;
    const { alunoId } = req.body;

    if (!alunoId) {
      return res.status(400).json({
        success: false,
        message: "ID do aluno é obrigatório"
      });
    }

    const [sala, aluno] = await Promise.all([
      Sala.findOne({ _id: salaId, professor: req.user.id }),
      User.findOne({ _id: alunoId, role: 'aluno' })
    ]);

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Sala não encontrada ou permissão negada"
      });
    }

    if (!aluno) {
      return res.status(404).json({
        success: false,
        message: "Aluno não encontrado ou perfil inválido"
      });
    }

    if (sala.alunos.includes(alunoId)) {
      return res.status(400).json({
        success: false,
        message: "Aluno já está na sala"
      });
    }

    await Promise.all([
      Sala.findByIdAndUpdate(salaId, { $addToSet: { alunos: alunoId } }),
      User.findByIdAndUpdate(alunoId, { $addToSet: { salas: salaId } })
    ]);

    // Buscar todas as tarefas vinculadas à sala
const tarefasDaSala = await Tarefa.find({ turmas: salaId }).select('_id');

// Atualizar o aluno para incluir essas tarefas
await User.updateOne(
  { _id: alunoId },
  {
    $addToSet: {
      tarefas: { $each: tarefasDaSala.map(t => t._id) }
    }
  }
);

await User.updateOne(
  { _id: alunoId },
  {
    $addToSet: {
      tarefas: { $each: tarefasDaSala.map(t => t._id) }
    }
  }
);

await Tarefa.updateMany(
  { _id: { $in: tarefasDaSala.map(t => t._id) } },
  { $addToSet: { alunosAtribuidos: alunoId } }
);

// Atualizar cada tarefa para incluir o aluno
await Tarefa.updateMany(
  { _id: { $in: tarefasDaSala.map(t => t._id) } },
  { $addToSet: { alunosAtribuidos: alunoId } }
);


    const salaAtualizada = await Sala.findById(salaId)
      .populate('alunos', 'firstName lastName email')
      .lean();

    return res.json({
      success: true,
      message: "Aluno adicionado com sucesso",
      data: salaAtualizada
    });

  } catch (error) {
    return handleError(res, error, "adicionar aluno");
  }
};

/**
 * @desc    Listar salas do usuário
 * @route   GET /api/salas
 * @access  Privado
 */
export const listarSalas = async (req, res) => {
  try {
    const { role, id } = req.user;
    let query = {};

    if (role === 'professor') {
      query.professor = id;
    } else if (role === 'aluno') {
      query.alunos = id;
    }

    const salas = await Sala.find(query)
      .populate('professor', 'firstName lastName')
      .populate('alunos', 'firstName lastName')
      .populate('materias', 'nome')
      .populate({
        path: 'tarefas',
        select: 'titulo status dataEntrega',
        match: { status: { $ne: 'arquivada' } },
        options: { sort: { dataEntrega: -1 }, limit: 5 }
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calcula estatísticas para cada sala
    const salasComEstatisticas = salas.map(sala => ({
      ...sala,
      totalAlunos: sala.alunos?.length || 0,
      tarefasPendentes: sala.tarefas?.filter(t => t.status === 'pendente').length || 0,
      tarefasCorrigidas: sala.tarefas?.filter(t => t.status === 'corrigida').length || 0
    }));

    return res.json({
      success: true,
      count: salas.length,
      data: salasComEstatisticas
    });

  } catch (error) {
    return handleError(res, error, "listar salas");
  }
};

/**
 * @desc    Obter detalhes de uma sala
 * @route   GET /api/salas/:id
 * @access  Membros da sala
 */
export const getSalaDetalhes = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role } = req.user;

    const sala = await Sala.findOne({
      _id: id,
      $or: [
        { professor: userId },
        { alunos: userId }
      ]
    })
    .populate('professor', 'firstName lastName email')
    .populate('alunos', 'firstName lastName email')
    .populate('materias', 'nome descricao')
    .populate({
      path: 'tarefas',
      select: 'titulo descricao dataEntrega status entregas',
      populate: {
        path: 'responsavel',
        select: 'firstName lastName'
      }
    })
    .lean();

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado"
      });
    }

    // Calcula estatísticas
    const estatisticas = {
      totalAlunos: sala.alunos?.length || 0,
      tarefasPendentes: sala.tarefas?.filter(t => t.status === 'pendente').length || 0,
      tarefasCorrigidas: sala.tarefas?.filter(t => t.status === 'corrigida').length || 0,
      proximaTarefa: sala.tarefas
        ?.filter(t => t.status === 'pendente')
        .sort((a, b) => new Date(a.dataEntrega) - new Date(b.dataEntrega))[0]
    };

    return res.json({
      success: true,
      data: {
        ...sala,
        ...estatisticas
      }
    });

  } catch (error) {
    return handleError(res, error, "obter detalhes da sala");
  }
};

// ... (Outros métodos como removerAluno, atualizarSala e adicionarMateria seguem o mesmo padrão)

/**
 * @desc    Remover aluno da sala
 * @route   DELETE /api/salas/:salaId/alunos/:alunoId
 * @access  Professor da sala
 */
export const removerAluno = async (req, res) => {
  try {
    const { salaId, alunoId } = req.params;

    const sala = await Sala.findOneAndUpdate(
      { _id: salaId, professor: req.user.id },
      { $pull: { alunos: alunoId } }
    );

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Sala não encontrada ou permissão negada"
      });
    }

    await User.findByIdAndUpdate(alunoId, { $pull: { salas: salaId } });

    return res.json({
      success: true,
      message: "Aluno removido com sucesso"
    });

  } catch (error) {
    return handleError(res, error, "remover aluno");
  }
};

/**
 * @desc    Atualizar informações da sala
 * @route   PUT /api/salas/:id
 * @access  Professor da sala
 */
export const atualizarSala = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove campos que não podem ser atualizados
    delete updates.professor;
    delete updates.alunos;
    delete updates.materias;

    const sala = await Sala.findOneAndUpdate(
      { _id: id, professor: req.user.id },
      updates,
      { new: true, runValidators: true }
    )
    .populate('professor', 'firstName lastName')
    .populate('materias', 'nome')
    .lean();

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Sala não encontrada ou permissão negada"
      });
    }

    return res.json({
      success: true,
      message: "Sala atualizada com sucesso",
      data: sala
    });

  } catch (error) {
    return handleError(res, error, "atualizar sala");
  }
};

/**
 * @desc    Adicionar matéria à sala
 * @route   POST /api/salas/:id/materias
 * @access  Professor da sala
 */
export const adicionarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const { materiaId } = req.body;

    const [sala, materia] = await Promise.all([
      Sala.findOne({ _id: id, professor: req.user.id }),
      Materia.findById(materiaId)
    ]);

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Sala não encontrada ou permissão negada"
      });
    }

    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada"
      });
    }

    if (sala.materias.includes(materiaId)) {
      return res.status(400).json({
        success: false,
        message: "Matéria já está na sala"
      });
    }

    await Promise.all([
      Sala.findByIdAndUpdate(id, { $addToSet: { materias: materiaId } }),
      Materia.findByIdAndUpdate(materiaId, { $addToSet: { salas: id } })
    ]);

    const salaAtualizada = await Sala.findById(id)
      .populate('materias', 'nome descricao')
      .lean();

    return res.json({
      success: true,
      message: "Matéria adicionada com sucesso",
      data: salaAtualizada
    });

  } catch (error) {
    return handleError(res, error, "adicionar matéria");
  }
};

export const gerarLinkConvite = async (req, res) => {
  try {
    const salaId = req.params.id;
    const userId = req.user.id;

    // Buscar a sala e garantir que o professor dono está requisitando
    const sala = await Sala.findById(salaId);
    if (!sala) {
      return res.status(404).json({ message: "Sala não encontrada." });
    }
    if (sala.professor.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Acesso negado. Apenas o professor pode gerar o link." });
    }

    // Verifica se a sala permite auto inscrição (se quiser forçar isso)
    if (!sala.configuracao.permiteAutoInscricao) {
      return res.status(400).json({ message: "Auto inscrição está desabilitada para esta sala." });
    }

    // Link de convite pode ser algo assim:
    const baseUrl = process.env.BASE_URL || `http://localhost:3000`;
    const linkConvite = `${baseUrl}/entrar-sala?codigo=${sala.codigoAcesso}`;

    return res.json({ link: linkConvite, codigoAcesso: sala.codigoAcesso });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao gerar link convite." });
  }
};

// Aluno entra na sala pelo código de acesso

export const entrarSalaPorCodigo = async (req, res) => {
  try {
    const codigo = req.query.codigo;
    const alunoId = req.user.id;
    const user = await User.findById(alunoId);
console.log("Usuário tentando entrar:", user);


    if (!codigo) {
      return res.status(400).json({ message: "Código de acesso não fornecido." });
    }

    const sala = await Sala.findOne({ codigoAcesso: codigo, isAtiva: true });
    if (!sala) {
      return res.status(404).json({ message: "Sala não encontrada ou código inválido." });
    }

    if (!sala.configuracao.permiteAutoInscricao) {
      return res.status(403).json({ message: "Auto inscrição não permitida nesta sala." });
    }

    const aluno = await User.findById(alunoId);
    if (!aluno || aluno.role !== 'aluno') {
      return res.status(403).json({ message: "Apenas alunos podem entrar em salas." });
    }

    if (sala.alunos.includes(alunoId)) {
      return res.status(400).json({ message: "Você já está nesta sala." });
    }

    sala.alunos.push(new mongoose.Types.ObjectId(alunoId)); // 🔧 Corrigido aqui
    await sala.save();

    await User.findByIdAndUpdate(alunoId, { $addToSet: { salas: sala._id } });

    return res.json({ message: "Aluno adicionado com sucesso.", salaId: sala._id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao entrar na sala." });
  }
};