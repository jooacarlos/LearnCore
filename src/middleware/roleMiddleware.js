/**
 * @file Middleware de controle de acesso por roles
 * @description Verifica os perfis de usuário para autorização de rotas
 */

import { ForbiddenError } from '../utils/errorHandler.js';

/**
 * @middleware isProfessor
 * @description Verifica se o usuário é um professor
 * @throws {ForbiddenError} Se o usuário não tiver perfil de professor
 */
export const isProfessor = (req, res, next) => {
  // Verificação adicional de segurança
  if (!req.user) {
    return res.status(500).json({
      success: false,
      code: 'AUTH_MIDDLEWARE_MISSING',
      message: 'Middleware de autenticação não foi executado corretamente'
    });
  }

  if (req.user.role !== 'professor') {
    throw new ForbiddenError(
      'Acesso restrito a professores',
      {
        currentRole: req.user.role,
        requiredRole: 'professor',
        action: 'Solicite acesso de professor ao administrador'
      }
    );
  }

  // Adiciona flag para uso em middlewares subsequentes
  req.isProfessor = true;
  next();
};

/**
 * @middleware isAluno
 * @description Verifica se o usuário é um aluno
 * @throws {ForbiddenError} Se o usuário não tiver perfil de aluno
 */
export const isAluno = (req, res, next) => {
  if (!req.user) {
    return res.status(500).json({
      success: false,
      code: 'AUTH_MIDDLEWARE_MISSING',
      message: 'Middleware de autenticação não foi executado corretamente'
    });
  }

  if (req.user.role !== 'aluno') {
    throw new ForbiddenError(
      'Acesso restrito a alunos',
      {
        currentRole: req.user.role,
        requiredRole: 'aluno',
        action: 'Faça login como aluno para acessar este recurso'
      }
    );
  }

  req.isAluno = true;
  next();
};

/**
 * @middleware isAdmin
 * @description Verifica se o usuário é um administrador
 * @throws {ForbiddenError} Se o usuário não tiver perfil de admin
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(500).json({
      success: false,
      code: 'AUTH_MIDDLEWARE_MISSING',
      message: 'Middleware de autenticação não foi executado corretamente'
    });
  }

  if (req.user.role !== 'admin') {
    throw new ForbiddenError(
      'Acesso restrito a administradores',
      {
        currentRole: req.user.role,
        requiredRole: 'admin',
        action: 'Contate o administrador do sistema'
      }
    );
  }

  req.isAdmin = true;
  next();
};

/**
 * @middleware roleMiddleware
 * @description Middleware genérico para verificação de múltiplos perfis
 * @param {string[]} allowedRoles - Lista de perfis permitidos
 * @returns {Function} Middleware function
 * @throws {ForbiddenError} Se o usuário não tiver nenhum dos perfis permitidos
 */
export const roleMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(500).json({
        success: false,
        code: 'AUTH_MIDDLEWARE_MISSING',
        message: 'Middleware de autenticação não foi executado corretamente'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        'Acesso não autorizado para seu perfil',
        {
          currentRole: req.user.role,
          allowedRoles,
          action: 'Verifique se você possui os privilégios necessários'
        }
      );
    }

    // Adiciona flag específica do role
    req[`is${req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1)}`] = true;
    next();
  };
};

/**
 * @middleware canEditSala
 * @description Verifica se o usuário pode editar a sala (professor dono ou admin)
 */
export const canEditSala = async (req, res, next) => {
  try {
    if (!req.user) throw new Error('Middleware de autenticação não executado');

    // Admins têm acesso total
    if (req.user.role === 'admin') {
      req.hasFullAccess = true;
      return next();
    }

    // Professores só podem editar suas próprias salas
    if (req.user.role === 'professor') {
      const sala = await Sala.findById(req.params.id).select('professor');
      if (!sala) throw new NotFoundError('Sala não encontrada');
      
      if (sala.professor.toString() === req.user.id) {
        req.isOwner = true;
        return next();
      }
    }

    throw new ForbiddenError(
      'Você não tem permissão para editar esta sala',
      {
        required: 'Ser o professor responsável ou administrador'
      }
    );
  } catch (error) {
    next(error);
  }
};