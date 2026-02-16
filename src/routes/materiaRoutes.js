import express from "express";
import {
  criarMateria,
  vincularSala,
  listarMaterias,
  getMateriaDetalhes,
  atualizarMateria,
  desvincularSala,
  deletarMateria,
  listarMateriaisPorSala, // Nova função
  uploadMaterial, // Nova função
  removerMaterial // Nova função
} from "../controllers/materiaController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { roleMiddleware } from "../middleware/roleMiddleware.js";
import { upload, handleUploadErrors } from "../config/multerConfig.js";




const router = express.Router();

// Aplica autenticação em todas as rotas
router.use(authMiddleware);

// Rotas básicas de matéria
router.post("/", 
  roleMiddleware(['professor']), 
  criarMateria
);

router.get("/", 
  roleMiddleware(['professor', 'admin']), 
  listarMaterias
);

router.get("/:id", 
  roleMiddleware(['professor', 'admin', 'aluno']), // Adicionado aluno
  getMateriaDetalhes
);

router.put("/:id", 
  roleMiddleware(['professor']), 
  atualizarMateria
);

router.delete("/:id", 
  roleMiddleware(['professor']), 
  deletarMateria
);

// Rotas de relacionamento com salas
router.post("/:materiaId/salas/:salaId", 
  roleMiddleware(['professor']), 
  vincularSala
);

router.delete("/:materiaId/salas/:salaId", 
  roleMiddleware(['professor']), 
  desvincularSala
);

// Nova rota para materiais por sala (acessível a alunos)
router.get("/salas/:salaId", 
  roleMiddleware(['professor', 'aluno']),
  listarMateriaisPorSala
);

// Novas rotas para upload/remoção de materiais
router.post("/:id/materiais",
  roleMiddleware(['professor']),
  upload.array('arquivos', 5),
  uploadMaterial
);

router.delete("/:id/materiais/:materialId",
  roleMiddleware(['professor']),
  removerMaterial
);

export default router;