// Core Modules
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Third-party Modules
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Custom Modules
import { errorHandler } from './src/utils/errorHandler.js';
import userRoutes from './src/routes/userRoutes.js';
import tarefaRoutes from './src/routes/tarefaRoutes.js';
import salaRoutes from './src/routes/salaRoutes.js';
import materiaRoutes from './src/routes/materiaRoutes.js';
import feedbackRoutes from './src/routes/feedbackRoutes.js';
import avisoRoutes from './src/routes/avisoRoutes.js';
import uploadRoutes from './src/routes/uploadRoutes.js';

// Setup
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas requisições geradas, tente novamente mais tarde',
  skip: (req) => req.originalUrl.includes('/health')
});
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        'script-src-attr': ["'self'", "'unsafe-inline'"], 
        'img-src': ["'self'", "data:", "https://i.pravatar.cc"],
      },
    },
  })
);



app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// WebSocket attach
app.use((req, res, next) => {
  req.io = io;
  next();
});

// MongoDB
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI não configurado.');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
.then(() => console.log('✅ Conectado ao MongoDB'))
.catch((error) => {
  console.error('❌ Erro ao conectar ao MongoDB:', error);
  process.exit(1);
});


// WebSocket Events
io.on('connection', (socket) => {
  console.log(`🔌 Nova conexão WebSocket: ${socket.id}`);

  socket.on('subscribe_feedback', (alunoId) => {
    socket.join(`feedback_${alunoId}`);
    console.log(`👂 Socket inscrito em updates do aluno ${alunoId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Conexão WebSocket fechada: ${socket.id}`);
  });
});

// Criação de pastas para uploads
const uploadsDir = path.join(__dirname, 'uploads');
const subdirs = ['atividades', 'materiais', 'entregas'];
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  subdirs.forEach(subdir => {
    fs.mkdirSync(path.join(uploadsDir, subdir), { recursive: true });
  });
}

// Arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/docs', express.static('docs'));
app.use(express.static(path.join(__dirname, 'public')));


// Rotas
app.use('/api/users', userRoutes);
app.use('/api/tarefas', tarefaRoutes);
app.use('/api/salas', salaRoutes);
app.use('/api/materias', materiaRoutes);
app.use('/api/feedback', apiLimiter, feedbackRoutes);
app.use('/api/avisos', avisoRoutes);
app.use('/api', uploadRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  res.json({
    status: 'operational',
    services: {
      database: dbStatus,
      ia: process.env.OLLAMA_URL ? 'available' : 'unconfigured',
      websocket: io.engine.clientsCount > 0 ? 'active' : 'inactive'
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
    suggestion: 'Verifique a documentação em /api/docs'
  });
});

// Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔌 WebSocket disponível em ws://localhost:${PORT}`);
  if (!process.env.OLLAMA_URL) {
    console.warn('⚠️  Funcionalidades de IA limitadas - OLLAMA_URL não configurado');
  }
});

// Graceful Shutdown
const gracefulShutdown = () => {
  console.log('🛑 Recebido sinal de desligamento');

  httpServer.close(() => {
    console.log('❌ Servidor HTTP fechado');

    io.close(() => {
      console.log('❌ WebSocket fechado');

      mongoose.connection.close(false, () => {
        console.log('❌ Conexão com MongoDB fechada');
        process.exit(0);
      });
    });
  });

  setTimeout(() => {
    console.error('⏰ Forçando encerramento por timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
