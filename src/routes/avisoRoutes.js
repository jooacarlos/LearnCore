import express from "express";
import {
  criarAviso,
  listarAvisos,
  getAvisoPorId,
  atualizarAviso,
  deletarAviso
} from "../controllers/avisoController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { upload, handleUploadErrors } from "../config/multerConfig.js";


const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Rotas para avisos de turma
router.post("/turmas/:turmaId/avisos",
  upload.array('anexos', 3),
  criarAviso
);
// Rota alternativa para teste com JSON
router.post("/turmas/:turmaId/avisos/json", 
  authMiddleware,
  (req, res, next) => {
    req.body.anexos = []; // Força anexos vazios
    next();
  },
  criarAviso
);
router.get("/turmas/:turmaId/avisos", listarAvisos);

// Rotas para avisos específicos
router.get("/avisos/:id", getAvisoPorId);
router.put("/avisos/:id", upload.array('anexos', 3), atualizarAviso);
router.delete("/avisos/:id", deletarAviso);

export default router;