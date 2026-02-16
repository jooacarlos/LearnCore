import jwt from 'jsonwebtoken';

/**
 * @desc    Middleware de autenticação JWT
 * @param   {Object} req - Objeto de requisição
 * @param   {Object} res - Objeto de resposta
 * @param   {Function} next - Função para passar para o próximo middleware
 * @returns {void|Object} Retorna erro ou passa para o próximo middleware
 */
export const authMiddleware = (req, res, next) => {
    // Verifica múltiplos locais onde o token pode estar
    const token = req.headers.authorization?.split(' ')[1] || 
                 req.cookies?.token || 
                 req.query?.token;

    if (!token) {
        return res.status(401).json({ 
            success: false,
            code: 'MISSING_TOKEN',
            message: 'Token de autenticação não fornecido.',
            action: 'Faça login para obter um token válido'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultSecret');
        
        // Verificação adicional do payload
        if (!decoded.id || !decoded.role) {
            return res.status(403).json({
                success: false,
                code: 'INVALID_TOKEN_PAYLOAD',
                message: 'Estrutura do token inválida'
            });
        }

        req.user = {
            id: decoded.id,
            role: decoded.role,
            email: decoded.email,
            // Adiciona outros campos úteis se existirem
            ...(decoded.firstName && { firstName: decoded.firstName }),
            ...(decoded.lastName && { lastName: decoded.lastName })
        };

        // Log para desenvolvimento (remova em produção)
        console.log(`Usuário autenticado: ${req.user.email} (${req.user.role})`);

        next();
    } catch (error) {
        let status = 403;
        let code = 'INVALID_TOKEN';
        let message = 'Token inválido';

        if (error.name === 'TokenExpiredError') {
            status = 401;
            code = 'TOKEN_EXPIRED';
            message = 'Token expirado';
        } else if (error.name === 'JsonWebTokenError') {
            code = 'MALFORMED_TOKEN';
            message = 'Token malformado';
        }

        return res.status(status).json({
            success: false,
            code,
            message,
            action: 'Renove seu token ou faça login novamente'
        });
    }
};

/**
 * @desc    Middleware para verificar role de professor
 * @param   {Object} req - Objeto de requisição
 * @param   {Object} res - Objeto de resposta
 * @param   {Function} next - Função para passar para o próximo middleware
 * @returns {void|Object} Retorna erro ou passa para o próximo middleware
 */
export const isProfessor = (req, res, next) => {
    // Verifica se o authMiddleware foi executado primeiro
    if (!req.user) {
        return res.status(500).json({
            success: false,
            code: 'AUTH_MIDDLEWARE_MISSING',
            message: 'Middleware de autenticação não foi executado'
        });
    }

    if (req.user.role !== 'professor') {
        return res.status(403).json({
            success: false,
            code: 'PROFESSOR_REQUIRED',
            message: 'Acesso permitido apenas para professores',
            currentRole: req.user.role,
            requiredRole: 'professor'
        });
    }

    // Adiciona flag adicional para uso posterior
    req.isProfessor = true;
    next();
};

/**
 * @desc    Middleware para verificar role de admin
 * @param   {Object} req - Objeto de requisição
 * @param   {Object} res - Objeto de resposta
 * @param   {Function} next - Função para passar para o próximo middleware
 * @returns {void|Object} Retorna erro ou passa para o próximo middleware
 */
export const isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(500).json({
            success: false,
            code: 'AUTH_MIDDLEWARE_MISSING',
            message: 'Middleware de autenticação não foi executado'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            code: 'ADMIN_REQUIRED',
            message: 'Acesso permitido apenas para administradores',
            currentRole: req.user.role,
            requiredRole: 'admin'
        });
    }

    req.isAdmin = true;
    next();
};

/**
 * @desc    Middleware genérico para verificar roles
 * @param   {Array} allowedRoles - Lista de roles permitidos
 * @returns {Function} Middleware function
 */
export const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(500).json({
                success: false,
                code: 'AUTH_MIDDLEWARE_MISSING',
                message: 'Middleware de autenticação não foi executado'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                code: 'ROLE_NOT_ALLOWED',
                message: 'Seu perfil não tem acesso a este recurso',
                currentRole: req.user.role,
                allowedRoles
            });
        }

        next();
    };
};