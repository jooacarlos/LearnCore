import Materia from "../models/materiaModels.js";
import Sala from "../models/salaModels.js";
import User from "../models/userModel.js";
import Tarefa from "../models/tarefaModel.js";

/**
 * @desc    Criar nova matéria
 * @route   POST /api/materias
 * @access  Professor
 */

export const listarMateriaisPorSala = async (req, res) => {
  try {
    const { salaId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verifica se o usuário tem acesso à sala
    const sala = await Sala.findOne({
      _id: salaId,
      $or: [
        { professor: userId },
        { alunos: userId }
      ]
    });

    if (!sala) {
      return res.status(403).json({
        success: false,
        message: "Acesso não autorizado à sala"
      });
    }

    // Busca materiais vinculados à sala
    const materiais = await Materia.find({ salas: salaId })
      .select('nome descricao arquivos professor')
      .populate('professor', 'firstName lastName');

    return res.json({
      success: true,
      data: materiais
    });

  } catch (error) {
    return handleError(res, error, "listar materiais por sala");
  }
};

/**
 * @desc    Upload de materiais para a matéria
 * @route   POST /api/materias/:id/materiais
 * @access  Professor da matéria
 */
export const uploadMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const professorId = req.user.id;

    const materia = await Materia.findOne({
      _id: id,
      professor: professorId
    });

    if (!materia) {
      return res.status(403).json({
        success: false,
        message: "Matéria não encontrada ou permissão negada"
      });
    }

    const arquivos = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.path, 'materiais');
      arquivos.push({
        nome: file.originalname,
        url: result.secure_url,
        tipo: file.mimetype,
        tamanho: file.size,
        publicId: result.public_id
      });
    }

    materia.arquivos = [...materia.arquivos, ...arquivos];
    await materia.save();

    return res.json({
      success: true,
      message: "Materiais adicionados com sucesso",
      data: arquivos
    });

  } catch (error) {
    return handleError(res, error, "upload de materiais");
  }
};

/**
 * @desc    Remover material da matéria
 * @route   DELETE /api/materias/:id/materiais/:materialId
 * @access  Professor da matéria
 */
export const removerMaterial = async (req, res) => {
  try {
    const { id, materialId } = req.params;
    const professorId = req.user.id;

    const materia = await Materia.findOne({
      _id: id,
      professor: professorId
    });

    if (!materia) {
      return res.status(403).json({
        success: false,
        message: "Matéria não encontrada ou permissão negada"
      });
    }

    const materialIndex = materia.arquivos.findIndex(
      m => m._id.toString() === materialId
    );

    if (materialIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Material não encontrado"
      });
    }

    const [materialRemovido] = materia.arquivos.splice(materialIndex, 1);
    await materia.save();

    // Remove do Cloudinary se tiver publicId
    if (materialRemovido.publicId) {
      await deleteFromCloudinary(materialRemovido.publicId);
    }

    return res.json({
      success: true,
      message: "Material removido com sucesso"
    });

  } catch (error) {
    return handleError(res, error, "remover material");
  }
};
export const criarMateria = async (req, res) => {
  try {
    const { nome, descricao, codigo, cor } = req.body;
    const professorId = req.user.id;

    // Validação básica
    if (!nome) {
      return res.status(400).json({
        success: false,
        message: "Nome da matéria é obrigatório"
      });
    }

    // Verifica se o professor existe
    const professor = await User.findById(professorId);
    if (!professor || professor.role !== 'professor') {
      return res.status(403).json({
        success: false,
        message: "Apenas professores podem criar matérias"
      });
    }

    // Cria a nova matéria
    const novaMateria = new Materia({
      nome,
      descricao,
      codigo,
      cor: cor || "#3b82f6",
      professor: professorId
    });

    await novaMateria.save();

    res.status(201).json({
      success: true,
      message: "Matéria criada com sucesso",
      data: novaMateria
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Já existe uma matéria com este nome ou código"
      });
    }
    res.status(500).json({
      success: false,
      message: "Erro ao criar matéria",
      error: error.message
    });
  }
};

/**
 * @desc    Vincular matéria a uma sala
 * @route   POST /api/materias/:materiaId/salas/:salaId
 * @access  Professor dono da matéria e da sala
 */
export const vincularSala = async (req, res) => {
  try {
    const { materiaId, salaId } = req.params;
    const professorId = req.user.id;

    // Verifica se a matéria existe (sem checar se pertence ao professor)
    const materia = await Materia.findById(materiaId);
    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada"
      });
    }

    // Verifica se a sala existe e pertence ao professor
    const sala = await Sala.findOne({
      _id: salaId,
      professor: professorId
    });
    if (!sala) {
      return res.status(404).json({
        success: false,
        message: "Sala não encontrada ou você não tem permissão"
      });
    }

    // Evita duplicação
    if (materia.salas.includes(salaId)) {
      return res.status(400).json({
        success: false,
        message: "Esta matéria já está vinculada à sala"
      });
    }

    // Atualiza ambos os lados da relação
    await Promise.all([
      Materia.findByIdAndUpdate(
        materiaId,
        { $addToSet: { salas: salaId } }
      ),
      Sala.findByIdAndUpdate(
        salaId,
        { $addToSet: { materias: materiaId } }
      )
    ]);

    res.json({
      success: true,
      message: "Matéria vinculada à sala com sucesso"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao vincular matéria à sala",
      error: error.message
    });
  }
};
export const listarTodasMaterias = async (req, res) => {
  try {
    const materias = await Materia.find().select('nome descricao codigo cor');
    res.json({
      success: true,
      data: materias
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao listar matérias",
      error: error.message
    });
  }
};


/**
 * @desc    Listar matérias do professor
 * @route   GET /api/materias
 * @access  Professor
 */
export const listarMaterias = async (req, res) => {
  try {
    const materias = await Materia.find()
      .populate({
        path: 'salas',
        select: 'nome descricao'
      })
      .populate({
        path: 'atividades',
        match: { status: { $ne: 'arquivada' } },
        select: 'titulo dataEntrega status'
      })
      .sort({ nome: 1 });

    res.json({
      success: true,
      count: materias.length,
      data: materias
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao listar matérias",
      error: error.message
    });
  }
};



/**
 * @desc    Obter detalhes de uma matéria
 * @route   GET /api/materias/:id
 * @access  Professor dono da matéria
 */
export const getMateriaDetalhes = async (req, res) => {
  try {
    const { id } = req.params;
    const professorId = req.user.id;

    const materia = await Materia.findOne({
      _id: id,
      professor: professorId
    })
    .populate({
      path: 'salas',
      select: 'nome descricao alunos',
      populate: {
        path: 'alunos',
        select: 'firstName lastName'
      }
    })
    .populate({
      path: 'atividades',
      select: 'titulo dataEntrega status responsavel',
      populate: {
        path: 'responsavel',
        select: 'firstName lastName'
      }
    });

    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada ou você não tem permissão"
      });
    }

    res.json({
      success: true,
      data: materia
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao buscar matéria",
      error: error.message
    });
  }
};

/**
 * @desc    Atualizar matéria
 * @route   PUT /api/materias/:id
 * @access  Professor dono da matéria
 */
export const atualizarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const professorId = req.user.id;

    // Remove campos que não podem ser atualizados
    delete updates.professor;
    delete updates.salas;
    delete updates.atividades;

    const materia = await Materia.findOneAndUpdate(
      {
        _id: id,
        professor: professorId
      },
      updates,
      { new: true, runValidators: true }
    );

    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada ou você não tem permissão"
      });
    }

    res.json({
      success: true,
      message: "Matéria atualizada com sucesso",
      data: materia
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Já existe uma matéria com este nome ou código"
      });
    }
    res.status(500).json({
      success: false,
      message: "Erro ao atualizar matéria",
      error: error.message
    });
  }
};

/**
 * @desc    Desvincular matéria de uma sala
 * @route   DELETE /api/materias/:materiaId/salas/:salaId
 * @access  Professor dono da matéria e da sala
 */
export const desvincularSala = async (req, res) => {
  try {
    const { materiaId, salaId } = req.params;
    const professorId = req.user.id;

    // Verifica se a matéria existe e pertence ao professor
    const materia = await Materia.findOne({
      _id: materiaId,
      professor: professorId
    });
    
    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada ou você não tem permissão"
      });
    }

    // Verifica se a sala existe e pertence ao professor
    const sala = await Sala.findOne({
      _id: salaId,
      professor: professorId
    });
    
    if (!sala) {
      return res.status(404).json({
        success: false,
        message: "Sala não encontrada ou você não tem permissão"
      });
    }

    // Remove a relação
    await Promise.all([
      Materia.findByIdAndUpdate(
        materiaId,
        { $pull: { salas: salaId } }
      ),
      Sala.findByIdAndUpdate(
        salaId,
        { $pull: { materias: materiaId } }
      )
    ]);

    res.json({
      success: true,
      message: "Matéria desvinculada da sala com sucesso"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao desvincular matéria da sala",
      error: error.message
    });
  }
};

/**
 * @desc    Deletar matéria
 * @route   DELETE /api/materias/:id
 * @access  Professor dono da matéria
 */
export const deletarMateria = async (req, res) => {
  try {
    const { id } = req.params;
    const professorId = req.user.id;

    const materia = await Materia.findOneAndDelete({
      _id: id,
      professor: professorId
    });

    if (!materia) {
      return res.status(404).json({
        success: false,
        message: "Matéria não encontrada ou você não tem permissão"
      });
    }

    res.json({
      success: true,
      message: "Matéria deletada com sucesso"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Erro ao deletar matéria",
      error: error.message
    });
  }
};