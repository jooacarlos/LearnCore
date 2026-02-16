import User from '../models/userModel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Sala from '../models/salaModels.js';
import Tarefa from '../models/tarefaModel.js';
import { gerarAvatar } from '../utils/generateAvatar.js';


// Helper para omitir campos sensíveis
const sanitizeUser = (user) => {
  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.__v;
  return userObj;
};

/**
 * Registra um novo usuário (aluno ou professor)
 */
export const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, role, instituicao, matricula } = req.body;

    // Validações básicas
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Senhas não coincidem' });
    }

    // Validação específica por role
    if (role === 'professor' && !instituicao) {
      return res.status(400).json({ success: false, message: 'Instituição é obrigatória para professores' });
    }

    if (role === 'aluno' && !matricula) {
      return res.status(400).json({ success: false, message: 'Matrícula é obrigatória para alunos' });
    }

    // Verifica se usuário já existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email já cadastrado' });
    }

    // Cria o usuário
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: await bcrypt.hash(password, 10),
      role: role || 'aluno',
      ...(role === 'professor' && { instituicao }),
      ...(role === 'aluno' && { matricula })
      
    });
    // Gera avatar com a inicial do nome
const inicial = firstName.trim()[0];
const avatarPath = gerarAvatar(inicial);
newUser.avatar = avatarPath;


    await newUser.save();

    // Gera token JWT
    const token = jwt.sign(
      { 
        id: newUser._id, 
        role: newUser.role,
        email: newUser.email
      },
      process.env.JWT_SECRET || 'defaultSecret',
      { expiresIn: '8h' }
    );

    res.status(201).json({
      success: true,
      message: 'Usuário registrado com sucesso',
      data: {
        user: sanitizeUser(newUser),
        token
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro no registro',
      error: error.message 
    });
  }
};

/**
 * Login do usuário
 */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciais inválidas' 
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Credenciais inválidas' 
      });
    }

    const token = jwt.sign(
      { 
        id: user._id,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET || 'defaultSecret',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Login bem-sucedido',
      data: {
        user: sanitizeUser(user),
        token
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro no login',
      error: error.message 
    });
  }
};

/**
 * Obtém informações do usuário logado
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v')
      .populate({
        path: 'salas',
        select: 'nome descricao materias totalAlunos totalTarefas',
        populate: {
          path: 'materias',
          select: 'nome atividadesAtivas salasAtivas totalMateriais'
        }
      })
      .populate({
        path: 'tarefas',
        select: 'titulo dataEntrega statusGeral turmas alunosAtribuidos',
        match: { visivelParaAlunos: true },
        transform: (doc) => {
          if (!doc) return null;
          
          const atrasada = doc.dataEntrega < new Date() && 
                          ['ativa', 'parcialmente_entregue'].includes(doc.statusGeral);
          
          return {
            _id: doc._id,
            titulo: doc.titulo,
            dataEntrega: doc.dataEntrega,
            status: doc.statusGeral, // Mantendo 'status' para compatibilidade
            statusGeral: doc.statusGeral,
            atrasada,
            turmas: doc.turmas,
            id: doc._id
          };
        }
      });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuário não encontrado' 
      });
    }

    // Formata a resposta
    const response = {
      ...user.toObject(),
      fullName: `${user.firstName} ${user.lastName}`,
      id: user._id,
      tarefas: user.tarefas.map(t => ({
        ...t,
        // Garante que campos obrigatórios estejam presentes
        status: t.statusGeral || 'ativa',
        atrasada: t.atrasada || false
      }))
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Erro detalhado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar usuário',
      error: error.message 
    });
  }
};

/**
 * Atualiza usuário
 */
export const updateUser = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user.id;

    // Impede mudança de role sem autorização
    if (updates.role && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Não autorizado' 
      });
    }

    // Atualiza senha se fornecida
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }

    const user = await User.findByIdAndUpdate(userId, updates, { 
      new: true,
      runValidators: true 
    }).select('-password -__v');

    res.json({
      success: true,
      message: 'Usuário atualizado',
      data: user
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro na atualização',
      error: error.message 
    });
  }
};

/**
 * Lista todos os alunos (apenas para professores/admin)
 */
export const listAlunos = async (req, res) => {
  try {
    if (req.user.role !== 'professor' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Não autorizado' 
      });
    }

    const alunos = await User.find({ role: 'aluno' })
      .select('firstName lastName email matricula salas')
      .populate({
        path: 'salas',
        select: 'nome'
      });

    res.json({
      success: true,
      count: alunos.length,
      data: alunos
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro ao listar alunos',
      error: error.message 
    });
  }
};

/**
 * Lista todos os professores (apenas para admin)
 */
export const listProfessores = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Não autorizado' 
      });
    }

    const professores = await User.find({ role: 'professor' })
      .select('firstName lastName email instituicao disciplinas salas')
      .populate({
        path: 'salas',
        select: 'nome'
      });

    res.json({
      success: true,
      count: professores.length,
      data: professores
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro ao listar professores',
      error: error.message 
    });
  }
};

/**
 * Obtém informações completas de um aluno (para professores)
 */
export const getAlunoDetails = async (req, res) => {
  try {
    if (req.user.role !== 'professor' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Não autorizado' 
      });
    }

    const aluno = await User.findById(req.params.id)
      .select('firstName lastName email matricula salas tarefas')
      .populate({
        path: 'salas',
        select: 'nome descricao materias'
      })
      .populate({
        path: 'tarefas',
        select: 'titulo dataEntrega statusGeral turmas',
        match: { visivelParaAlunos: true },
        transform: (doc) => {
          if (!doc) return null;
          return {
            ...doc.toObject(),
            atrasada: doc.dataEntrega < new Date() && doc.statusGeral === 'ativa'
          };
        }
      });

    if (!aluno || aluno.role !== 'aluno') {
      return res.status(404).json({ 
        success: false,
        message: 'Aluno não encontrado' 
      });
    }

    res.json({
      success: true,
      data: {
        ...aluno.toObject(),
        fullName: `${aluno.firstName} ${aluno.lastName}`,
        id: aluno._id
      }
    });

  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar aluno',
      error: error.message 
    });
  }
};