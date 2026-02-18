# 🎓 Sistema de Gestão Escolar - API

API REST desenvolvida em **Node.js** para gerenciamento de usuários, salas, matérias, tarefas, avisos e upload de arquivos.

---

## 🚀 Tecnologias Utilizadas

- Node.js
- Express
- MongoDB
- Mongoose
- JWT (Autenticação)
- Multer (Upload de arquivos)
- Swagger (Documentação da API)

---

## 📦 Instalação

Clone o repositório:

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
````

Entre na pasta do projeto:

```bash
cd seu-repositorio
```

Instale as dependências:

```bash
npm install
```

---

## ⚙️ Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
PORT=3000
MONGO_URI=sua_string_do_mongodb
JWT_SECRET=sua_chave_secreta
```

---

## ▶️ Rodando o Projeto

Modo desenvolvimento:

```bash
npm run dev
```

Modo produção:

```bash
npm start
```

Servidor rodando em:

```
http://localhost:3000
```

---

## 🔐 Autenticação

A API utiliza autenticação via **JWT (Bearer Token)**.

### Fluxo:

1️⃣ Registrar usuário
`POST /api/users/register`

2️⃣ Fazer login
`POST /api/users/login`

3️⃣ Copiar o token retornado

4️⃣ Enviar no header:

```
Authorization: Bearer SEU_TOKEN_AQUI
```

No Swagger basta clicar em **Authorize** e colar o token.

---

## 📚 Documentação da API (Swagger)

A documentação interativa pode ser acessada em:

```
http://localhost:3000/api-docs
```

Ela permite:

* Testar endpoints
* Enviar arquivos
* Usar autenticação JWT
* Visualizar parâmetros e schemas

---

## 🧩 Estrutura da API

### 👤 Usuários

* Registro
* Login
* Atualização de perfil
* Listagem de alunos e professores
* Controle por role (admin, professor, aluno)

### 🏫 Salas

* Criar sala
* Adicionar/remover alunos
* Dashboard da turma
* Link de convite

### 📚 Matérias

* Criar matéria
* Vincular a salas
* Upload de materiais
* Remover materiais

### 📝 Tarefas

* Criar tarefa
* Entrega por aluno
* Correção por professor
* Devolução

### 📢 Avisos

* Criar aviso com anexos
* Listar avisos por turma
* Atualizar e remover avisos

### 📂 Upload

* Upload de arquivos via multipart/form-data

---

## 🛡️ Controle de Acesso

A API utiliza middleware de autorização baseado em **roles**:

* `admin`
* `professor`
* `aluno`

Cada rota possui permissões específicas.

---

## 📂 Estrutura do Projeto

```
src/
 ├── controllers/
 ├── routes/
 ├── middleware/
 ├── models/
 ├── config/
 └── app.js
```

---

## 🧪 Testando com Swagger

1️⃣ Faça login
2️⃣ Copie o token
3️⃣ Clique em **Authorize**
4️⃣ Cole:

```
Bearer SEU_TOKEN
```

5️⃣ Teste as rotas protegidas

---

## 📌 Melhorias Futuras

* Refresh Token
* Logs estruturados
* Testes automatizados (Jest)
* Deploy em produção (Render / Railway / AWS)


---

## 👨‍💻 Autor

João Carlos Gouvêa
GitHub: [https://github.com/jooacarlos]

---

## 📄 Licença

Este projeto está sob a licença MIT.

````
