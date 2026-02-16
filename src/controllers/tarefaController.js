import Tarefa from '../models/tarefaModel.js';
import Sala from '../models/salaModels.js';
import User from "../models/userModel.js";
import { generateSemanalFeedback } from '../services/ollamaService.js';
import path from 'path';
import fs from 'fs';

// Função auxiliar para limpar uploads em caso de erro
const cleanUpUploads = (files) => {
  try {
    if (files?.imagem) {
      fs.unlinkSync(files.imagem[0].path);
    }
    if (files?.anexos) {
      files.anexos.forEach(anexo => {
        fs.unlinkSync(anexo.path);
      });
    }
  } catch (err) {
    console.error('Erro ao limpar arquivos temporários:', err);
  }
};

export const criarTarefa = async (req, res) => {
  try {
    const { titulo, descricao, dataEntrega, valor, turmas, tipoAtividade, materia } = req.body;

    // Verifica se o usuário é professor
    const professor = await User.findOne({ _id: req.user.id, role: 'professor' });
    if (!professor) {
      cleanUpUploads(req.files);
      return res.status(403).json({
        success: false,
        message: 'Apenas professores podem criar tarefas'
      });
    }

    // Verifica se as turmas pertencem ao professor
    const turmasValidas = await Sala.find({
      _id: { $in: turmas },
      professor: req.user.id
    });

    if (turmasValidas.length !== turmas.length) {
      cleanUpUploads(req.files);
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para atribuir tarefas a uma ou mais turmas selecionadas'
      });
    }

    // Processa a imagem da atividade (se existir)
    let imagem = null;
    if (req.files?.imagem && req.files.imagem.length > 0) {
      const arquivoImagem = req.files.imagem[0];
      imagem = {
        nome: arquivoImagem.originalname,
        url: `/uploads/atividades/${arquivoImagem.filename}`,
        tipo: arquivoImagem.mimetype,
        tamanho: arquivoImagem.size,
        publicId: '' // caso use upload externo, pode preencher
      };
    }

    // Processa os anexos/materiais de apoio
    const anexos = [];
    if (req.files?.anexos) {
      for (const anexo of req.files.anexos) {
        anexos.push({
          nome: anexo.originalname,
          url: `/uploads/materiais/${anexo.filename}`,
          tipo: anexo.mimetype,
          tamanho: anexo.size,
          publicId: ''
        });
      }
    }

    // Cria a tarefa com imagem e anexos estruturados
    const novaTarefa = new Tarefa({
      titulo,
      descricao,
      dataEntrega,
      valor,
      turmas,
      professor: req.user.id,
      tipoAtividade,
      materia,
      imagem,    // passa objeto imagem completo, não só url
      anexos,
      statusGeral: 'ativa',
      visivelParaAlunos: true
    });

    await novaTarefa.save();

    // Atualiza as turmas com a nova tarefa
    await Sala.updateMany(
      { _id: { $in: turmas } },
      { $push: { tarefas: novaTarefa._id } }
    );

    // Busca os alunos das turmas
    const alunos = await User.find({
      role: 'aluno',
      salas: { $in: turmas }
    }).select('_id');

    const alunosIds = alunos.map(aluno => aluno._id);

    // Atribui os alunos à tarefa
    novaTarefa.alunosAtribuidos = alunosIds;
    await novaTarefa.save();

    // Atualiza os alunos com a nova tarefa
    await User.updateMany(
      { _id: { $in: alunosIds } },
      { $push: { tarefas: novaTarefa._id } }
    );

    // Atualiza o professor com a nova tarefa
    await User.findByIdAndUpdate(
      req.user.id,
      { $push: { tarefas: novaTarefa._id } }
    );
    

    res.status(201).json({
      success: true,
      message: 'Tarefa criada com sucesso!',
      data: novaTarefa
    });

  } catch (error) {
    cleanUpUploads(req.files);
    console.error('Erro ao criar tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar tarefa',
      error: error.message
    });
  }
  console.log('FILES:', req.files);
console.log('BODY:', req.body);

};


export const listarTarefas = async (req, res) => {
  try {
    const { turmaId, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};

    if (userRole === 'professor') {
      query.professor = userId;
      if (turmaId) {
        query.turmas = turmaId;
      }
    } else {
      // Aluno: mostrar tarefas visíveis e atribuídas
      query.alunosAtribuidos = { $in: [userId] };
      query.visivelParaAlunos = true;

      if (turmaId) {
        query.turmas = turmaId;
      }
    }

    // Filtro por status
    if (status) {
      if (status === 'ativa') {
        query.statusGeral = 'ativa';
      } else {
        // Filtra por status das entregas individuais
        query['entregas.status'] = status;
        
        // Para alunos, filtra apenas suas entregas
        if (userRole === 'aluno') {
          query['entregas.aluno'] = userId;
        }
      }
    }

    const tarefas = await Tarefa.find(query)
  .populate('professor', 'firstName lastName email')
  .populate('turmas', 'nome descricao')
  .select('+imagem +anexos') // Adicione esta linha
  .sort({ dataEntrega: 1 });

    // Adiciona informações de progresso na resposta
    const tarefasComProgresso = tarefas.map(tarefa => ({
      ...tarefa.toObject(),
      progresso: tarefa.progresso,
      // Adiciona status específico para exibição
      statusDisplay: getDisplayStatus(tarefa, userId)
    }));

    res.json({
      success: true,
      count: tarefas.length,
      data: tarefasComProgresso
    });

  } catch (error) {
    console.error('Erro ao listar tarefas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar tarefas',
      error: error.message
    });
  }
};

// Função auxiliar para determinar o status de exibição
function getDisplayStatus(tarefa, userId) {
  // Se for aluno, mostra o status específico da sua entrega
  if (userId) {
    const entrega = tarefa.entregas.find(e => e.aluno.equals(userId));
    if (entrega) {
      return entrega.status;
    }
    return new Date() > new Date(tarefa.dataEntrega) ? 'atrasada' : 'pendente';
  }

  // Se for professor, mostra o status mais crítico
  const statusPriority = {
    'atrasada': 1,
    'pendente_correcao': 2,
    'devolvida': 3,
    'corrigida': 4,
    'entregue': 5,
    'pendente': 6
  };

  const highestPriorityStatus = tarefa.entregas
    .map(e => e.status)
    .sort((a, b) => statusPriority[a] - statusPriority[b])[0];

  return highestPriorityStatus || (new Date() > new Date(tarefa.dataEntrega))? 'atrasada' : 'pendente';
}

export const obterTarefaPorId = async (req, res) => {
  try {
    const tarefa = await Tarefa.findById(req.params.id)
 .populate('professor', 'firstName lastName email')
      .populate('turmas', 'nome descricao')
      .populate('alunosAtribuidos', 'firstName lastName email')
      .select('+imagem +anexos'); 

    if (!tarefa) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    const userTemAcesso = (
      (req.user.role === 'professor' && tarefa.professor._id.equals(req.user.id)) ||
      (req.user.role === 'aluno' && tarefa.alunosAtribuidos.some(a => a._id.equals(req.user.id)))
    );

    if (!userTemAcesso) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para acessar esta tarefa'
      });
    }

    // Inclui informações de progresso e status na resposta
    const resposta = {
      ...tarefa.toObject(),
      progresso: tarefa.progresso,
      statusDisplay: getDisplayStatus(tarefa, req.user.id)
    };

    res.json({
      success: true,
      data: resposta
    });

  } catch (error) {
    console.error('Erro ao obter tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter tarefa',
      error: error.message
    });
  }
};

import mongoose from 'mongoose';

export const entregarTarefa = async (req, res) => {
  try {
    const { respostaTexto } = req.body;
    const tarefa = await Tarefa.findById(req.params.id);

    if (!tarefa) {
      return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    }

    if (!tarefa.alunosAtribuidos.includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Você não está atribuído a esta tarefa' });
    }

    const agora = new Date();
    if (agora > tarefa.dataEntrega) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prazo para entrega da tarefa expirou',
        status: 'atrasada'
      });
    }

    const anexosUrls = [];
    if (req.files?.anexos) {
      for (const anexo of req.files.anexos) {
        const filePath = `/uploads/entregas/${anexo.filename}`;
        anexosUrls.push({
          nome: anexo.originalname,
          url: filePath,
          tipo: anexo.mimetype,
          tamanho: anexo.size
        });
      }
    }

    const userId = new mongoose.Types.ObjectId(req.user.id);

    const entregaIndex = tarefa.entregas.findIndex(entrega => entrega.aluno.equals(userId));

    if (entregaIndex >= 0) {
      const entrega = tarefa.entregas[entregaIndex];
      entrega.respostaTexto = respostaTexto;
      entrega.anexos = anexosUrls;
      entrega.dataEntrega = agora;
      entrega.status = 'entregue';
    } else {
      tarefa.entregas.push({
        aluno: userId,
        respostaTexto,
        anexos: anexosUrls,
        dataEntrega: agora,
        status: 'entregue'
      });
    }

    await tarefa.save();

    res.json({
      success: true,
      message: 'Tarefa entregue com sucesso!',
      data: {
        tarefa,
        progresso: tarefa.progresso,
        status: 'entregue'
      }
    });

  } catch (error) {
    console.error('Erro ao entregar tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao entregar tarefa',
      error: error.message
    });
  }
};


export const devolverTarefa = async (req, res) => {
  try {
    const { id: tarefaId, alunoId } = req.params;
    const { feedback } = req.body;

    const tarefa = await Tarefa.findById(tarefaId);

    if (!tarefa) {
      return res.status(404).json({ success: false, message: 'Tarefa não encontrada' });
    }

    if (!tarefa.professor.equals(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Você não tem permissão para devolver esta tarefa' });
    }

    const entregaIndex = tarefa.entregas.findIndex(ent => ent.aluno.equals(alunoId));
    if (entregaIndex === -1) {
      return res.status(404).json({ success: false, message: 'Entrega do aluno não encontrada' });
    }

    tarefa.entregas[entregaIndex].status = 'devolvida';
    tarefa.entregas[entregaIndex].feedback = {
      texto: feedback || "Revisão solicitada",
      dataCorrecao: new Date()
    };

    await tarefa.save();

    res.json({ 
      success: true, 
      message: 'Tarefa devolvida para revisão!',
      status: 'devolvida'
    });

  } catch (error) {
    console.error('Erro ao devolver tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao devolver tarefa',
      error: error.message
    });
  }
};

export const corrigirEntrega = async (req, res) => {
  try {
    const { id: tarefaId, alunoId } = req.params;
    const { feedback, nota } = req.body;

    const tarefa = await Tarefa.findById(tarefaId);

    if (!tarefa) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Verifica se é o professor responsável
    if (!tarefa.professor.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para corrigir esta tarefa'
      });
    }

    // Procura a entrega do aluno
    const entregaIndex = tarefa.entregas.findIndex(ent => ent.aluno.equals(alunoId));
    if (entregaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Entrega do aluno não encontrada'
      });
    }

    // Se não há feedback fornecido, gera com IA
    const feedbackFinal = feedback || await generateSemanalFeedback(tarefa.entregas[entregaIndex].respostaTexto);

    // Atualiza a entrega
    tarefa.entregas[entregaIndex].status = 'corrigida';
    tarefa.entregas[entregaIndex].feedback = {
      texto: feedbackFinal,
      nota: nota, // <- aqui dentro
      dataCorrecao: new Date()
    };

    await tarefa.save();

    res.json({
      success: true,
      message: 'Entrega corrigida com sucesso!',
      data: tarefa.entregas[entregaIndex]
    });

  } catch (error) {
    console.error('Erro ao corrigir entrega:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao corrigir entrega',
      error: error.message
    });
  }
};


export const atualizarTarefa = async (req, res) => {
  try {
    const { titulo, descricao, dataEntrega, valor, turmas } = req.body;
    const tarefa = await Tarefa.findById(req.params.id);

    if (!tarefa) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Verifica se é o professor responsável
    const professor = await User.findOne({
      _id: req.user.id,
      role: 'professor'
    });

    if (!professor || !tarefa.professor.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar esta tarefa'
      });
    }

    tarefa.titulo = titulo || tarefa.titulo;
    tarefa.descricao = descricao || tarefa.descricao;
    tarefa.dataEntrega = dataEntrega || tarefa.dataEntrega;
    tarefa.valor = valor || tarefa.valor;

    if (turmas) {
      await Sala.updateMany(
        { _id: { $in: tarefa.turmas } },
        { $pull: { tarefas: tarefa._id } }
      );

      await Sala.updateMany(
        { _id: { $in: turmas } },
        { $push: { tarefas: tarefa._id } }
      );

      tarefa.turmas = turmas;
    }

    await tarefa.save();

    res.json({
      success: true,
      message: 'Tarefa atualizada com sucesso!',
      data: tarefa
    });

  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar tarefa',
      error: error.message
    });
  }
};

export const removerTarefa = async (req, res) => {
  try {
    const tarefa = await Tarefa.findById(req.params.id);

    if (!tarefa) {
      return res.status(404).json({
        success: false,
        message: 'Tarefa não encontrada'
      });
    }

    // Verifica se é o professor responsável
    const professor = await User.findOne({
      _id: req.user.id,
      role: 'professor'
    });

    if (!professor || !tarefa.professor.equals(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para remover esta tarefa'
      });
    }

    await Sala.updateMany(
      { _id: { $in: tarefa.turmas } },
      { $pull: { tarefas: tarefa._id } }
    );

    // Remove a imagem associada
    if (tarefa.imagemUrl) {
      const imagePath = path.join(__dirname, '..', 'public', tarefa.imagemUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Remove os anexos associados
    if (tarefa.anexos && tarefa.anexos.length > 0) {
      tarefa.anexos.forEach(anexo => {
        const filePath = path.join(__dirname, '..', 'public', anexo.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }

    await tarefa.deleteOne();

    res.json({
      success: true,
      message: 'Tarefa removida com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao remover tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao remover tarefa',
      error: error.message
    });
  }
};

export const listarTarefasPendentes = async (req, res) => {
  try {
    const userId = req.user.id;

    // Busca todas as tarefas visíveis atribuídas ao aluno
    const tarefasAtribuidas = await Tarefa.find({
      alunosAtribuidos: userId,
      visivelParaAlunos: true
    }).sort({ dataEntrega: 1 });

    // Filtra as que ainda não foram entregues por esse aluno
    const tarefasPendentes = tarefasAtribuidas.filter(tarefa => {
      return !tarefa.entregas.some(entrega =>
        entrega.aluno.toString() === userId && 
        (entrega.status === 'entregue' || entrega.status === 'corrigida')
      );
    });

    res.json({
      success: true,
      count: tarefasPendentes.length,
      data: tarefasPendentes
    });

  } catch (error) {
    console.error('Erro ao listar tarefas pendentes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar tarefas pendentes',
      error: error.message
    });
  }
};

// Método depreciado - mantido para compatibilidade
export const corrigirTarefa = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: 'Método depreciado. Use o endpoint /:id/corrigir/:alunoId para corrigir entregas individuais'
    });
  } catch (error) {
    console.error('Erro ao corrigir tarefa:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao corrigir tarefa',
      error: error.message
    });
  }
};
