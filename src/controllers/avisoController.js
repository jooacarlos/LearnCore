import Aviso from "../models/avisoModel.js";
import Sala from "../models/salaModels.js";

const handleError = (res, error, context) => {
  console.error(`Erro em ${context}:`, error);
  res.status(500).json({
    success: false,
    message: `Erro ao ${context}`,
    error: error.message
  });
};

export const criarAviso = async (req, res) => {
  try {
    const { turmaId } = req.params;
    const { titulo, conteudo, prioridade, dataExpiracao } = req.body;

    // Verifica se o usuário tem acesso à turma
    const sala = await Sala.findOne({
      _id: turmaId,
      $or: [
        { professor: req.user.id },
        { alunos: req.user.id }
      ]
    });

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado à turma"
      });
    }

    const novoAviso = await Aviso.create({
      titulo,
      conteudo,
      turma: turmaId,
      autor: req.user.id,
      prioridade,
      dataExpiracao,
      anexos: req.files?.map(file => ({
        url: file.path,
        nome: file.originalname,
        tipo: file.mimetype,
        tamanho: file.size
      })) || []
    });

    // Atualiza a sala com o novo aviso
    await Sala.findByIdAndUpdate(turmaId, {
      $push: { avisos: novoAviso._id }
    });

    res.status(201).json({
      success: true,
      data: novoAviso
    });

  } catch (error) {
    handleError(res, error, "criar aviso");
  }
};

export const listarAvisos = async (req, res) => {
  try {
    const { turmaId } = req.params;

    // Verifica se o usuário tem acesso à turma
    const isMember = await Sala.findOne({
      _id: turmaId,
      $or: [
        { professor: req.user.id },
        { alunos: req.user.id }
      ]
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado"
      });
    }

    // Busca todos os avisos sem paginação
    const avisos = await Aviso.find({ turma: turmaId })
      .sort({ createdAt: -1 }) // Ordena do mais recente para o mais antigo
      .populate('autor', 'firstName lastName avatar')
      .populate('turma', 'nome');

    res.json({
      success: true,
      data: avisos
    });

  } catch (error) {
    handleError(res, error, "listar avisos");
  }
};

export const getAvisoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const aviso = await Aviso.findById(id)
      .populate('autor', 'firstName lastName avatar')
      .populate('turma', 'nome');

    if (!aviso) {
      return res.status(404).json({
        success: false,
        message: "Aviso não encontrado"
      });
    }

    // Verifica se o usuário tem acesso à turma do aviso
    const isMember = await Sala.findOne({
      _id: aviso.turma,
      $or: [
        { professor: req.user.id },
        { alunos: req.user.id }
      ]
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado a este aviso"
      });
    }

    res.json({
      success: true,
      data: aviso
    });

  } catch (error) {
    handleError(res, error, "obter aviso");
  }
};

export const atualizarAviso = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, conteudo, prioridade, dataExpiracao } = req.body;

    // Primeiro verifica se o aviso existe e se o usuário é o autor
    const avisoExistente = await Aviso.findOne({
      _id: id,
      autor: req.user.id
    });

    if (!avisoExistente) {
      return res.status(404).json({
        success: false,
        message: "Aviso não encontrado ou você não tem permissão para editá-lo"
      });
    }

    const avisoAtualizado = await Aviso.findByIdAndUpdate(
      id,
      {
        titulo,
        conteudo,
        prioridade,
        dataExpiracao,
        $push: {
          anexos: req.files?.map(file => ({
            url: file.path,
            nome: file.originalname,
            tipo: file.mimetype,
            tamanho: file.size
          })) || []
        }
      },
      { new: true, runValidators: true }
    ).populate('autor', 'firstName lastName');

    res.json({
      success: true,
      data: avisoAtualizado
    });

  } catch (error) {
    handleError(res, error, "atualizar aviso");
  }
};

export const deletarAviso = async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se o aviso existe e se o usuário é o autor
    const aviso = await Aviso.findOne({
      _id: id,
      $or: [
        { autor: req.user.id },
        { turma: { $in: await Sala.find({ professor: req.user.id }).distinct('_id') } }
      ]
    });

    if (!aviso) {
      return res.status(404).json({
        success: false,
        message: "Aviso não encontrado ou você não tem permissão para removê-lo"
      });
    }

    // Remove o aviso da coleção de avisos da sala
    await Sala.findByIdAndUpdate(aviso.turma, {
      $pull: { avisos: aviso._id }
    });

    await Aviso.deleteOne({ _id: id });

    res.json({
      success: true,
      message: "Aviso removido com sucesso"
    });

  } catch (error) {
    handleError(res, error, "remover aviso");
  }
};

export default {
  criarAviso,
  listarAvisos,
  getAvisoPorId,
  atualizarAviso,
  deletarAviso
};