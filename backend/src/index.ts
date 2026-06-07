import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('database.db');

// IMPORTANTE: Habilitar el soporte de claves foráneas en SQLite para el borrado en cascada
db.exec('PRAGMA foreign_keys = ON;');

// =========================================================================
// 1. RE-ESTRUCTURACIÓN COMPLETA DE TABLAS (Modelo Multi-tenant)
// =========================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY, 
    name TEXT,
    owner_id TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'guest', -- 'owner' (dueño) o 'guest' (invitado)
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, 
    workspace_id TEXT, 
    name TEXT, 
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    title TEXT,
    status TEXT DEFAULT 'todo',
    assignedTo TEXT, -- Guarda el ID del usuario asignado
    description TEXT DEFAULT '',
    links TEXT DEFAULT '[]',
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(assignedTo) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Migraciones de seguridad para las columnas de notas
try { db.exec(`ALTER TABLE tasks ADD COLUMN description TEXT DEFAULT ''`); } catch (_) {}
try { db.exec(`ALTER TABLE tasks ADD COLUMN links TEXT DEFAULT '[]'`); } catch (_) {}


// =========================================================================
// 2. RUTAS DE AUTENTICACIÓN (LOGIN Y REGISTRO CON SANITIZACIÓN)
// =========================================================================

// Registro de nuevos integrantes con validación avanzada
app.post('/auth/register', [
  body('name').trim().notEmpty().withMessage('El nombre es obligatorio.').escape(),
  body('email').isEmail().withMessage('Por favor, ingresá un email válido.').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.')
], async (req: express.Request, res: express.Response) => {
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { name, email, password } = req.body;

  try {
    const id = 'u_' + Date.now().toString();
    const hashedPassword = await bcrypt.hash(password, 10); // Encriptado real
    
    db.prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)')
      .run(id, name, email, hashedPassword);

    res.status(201).json({ success: true, user: { id, name, email } });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: "El email ya está registrado." });
    res.status(500).json({ error: "Error al registrar usuario." });
  }
});

// Login con validación y normalización de email
app.post('/auth/login', [
  body('email').isEmail().withMessage('Formato de email inválido.').normalizeEmail(),
  body('password').notEmpty().withMessage('La contraseña es obligatoria.')
], async (req: express.Request, res: express.Response) => {

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  
  if (!user) return res.status(401).json({ error: "Credenciales incorrectas." });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(401).json({ error: "Credenciales incorrectas." });

  res.json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
});


// =========================================================================
// 3. MODELO 2: LÓGICA DEL ENLACE DE INVITACIÓN DIRECTA
// =========================================================================

// Unirse a un espacio mediante el clic del enlace copiado
app.post('/workspaces/join-via-link', (req, res) => {
  const { workspaceId, userId } = req.body;

  if (!workspaceId || !userId) return res.status(400).json({ error: "Faltan parámetros." });

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
  if (!workspace) return res.status(404).json({ error: "El espacio de trabajo no existe." });

  try {
    // Insertamos al usuario como invitado ('guest') en la tabla pivot
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)')
      .run(workspaceId, userId, 'guest');
    
    res.json({ success: true, message: "Te uniste con éxito al espacio." });
  } catch (err: any) {
    // Si ya existía el registro (el usuario ya era miembro), le damos paso libre sin error
    res.json({ success: true, message: "Ya eres miembro de este espacio." });
  }
});


// =========================================================================
// 4. RUTAS DE WORKSPACES PROTEGIDOS
// =========================================================================

// Trae exclusivamente los workspaces donde el usuario logueado TIENE ACCESO (Dueño o Invitado)
app.get('/workspaces/user/:userId', (req, res) => {
  const { userId } = req.params;
  const workspaces = db.prepare(`
    SELECT w.*, wm.role 
    FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
  `).all(userId);
  res.json(workspaces);
});

// Trae la lista de integrantes del espacio actual (para alimentar el selector de responsables)
app.get('/workspaces/:workspaceId/members', (req, res) => {
  const { workspaceId } = req.params;
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, wm.role
    FROM users u
    JOIN workspace_members wm ON u.id = wm.user_id
    WHERE wm.workspace_id = ?
  `).all(workspaceId);
  res.json(members);
});

// Crear un nuevo espacio asignando el creador como dueño (owner)
app.post('/workspaces', (req, res) => {
  const { id, name, ownerId } = req.body;
  try {
    db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(id, name, ownerId);
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(id, ownerId, 'owner');
    db.prepare('INSERT INTO projects (id, workspace_id, name) VALUES (?, ?, ?)').run(id + '_p', id, 'General');
    res.status(201).json({ message: "Creado con éxito" });
  } catch (err) { res.status(500).json({ error: "Error al crear espacio" }); }
});

// Eliminar espacio de trabajo
app.delete('/workspaces/:id', (req, res) => {
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.params.id);
  res.json({ message: "Eliminado con éxito" });
});


// =========================================================================
// 5. RUTA DE TAREAS (Relacionadas con IDs de usuarios reales)
// =========================================================================
app.get('/tasks/:workspaceId', (req, res) => {
  const projectId = req.params.workspaceId + '_p';
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(projectId) as any[];
  
  const parsed = tasks.map(t => ({
    id: t.id,
    project_id: t.project_id,
    title: t.title,
    status: t.status,
    assignedTo: t.assignedTo ?? t.assignedto ?? '', // Mapea el ID del usuario seleccionado
    description: t.description ?? '',
    links: (() => { try { return JSON.parse(t.links || '[]'); } catch { return []; } })()
  }));
  res.json(parsed);
});

app.post('/tasks', (req, res) => {
  const { id, project_id, title, status, assignedTo, description, links } = req.body;
  const responsible = assignedTo && assignedTo.trim() !== '' ? assignedTo : null;

  db.prepare('INSERT INTO tasks (id, project_id, title, status, assignedTo, description, links) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, project_id, title, status ?? 'todo', responsible, description ?? '', JSON.stringify(links ?? []));
  res.status(201).json({ message: "Tarea creada" });
});

app.patch('/tasks/:id', (req, res) => {
  const { status, title, assignedTo, description, links } = req.body;
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as any;

  if (!current) return res.status(404).json({ error: "No encontrada" });

  const oldStatus = current.status ?? 'todo';
  const oldTitle = current.title ?? '';
  const oldAssignedTo = current.assignedTo ?? current.assignedto ?? null;
  const oldDescription = current.description ?? '';
  const oldLinks = current.links ?? '[]';

  const newAssignedTo = assignedTo !== undefined ? (assignedTo.trim() !== '' ? assignedTo : null) : oldAssignedTo;

  try {
    db.prepare('UPDATE tasks SET status = ?, title = ?, "assignedTo" = ?, description = ?, links = ? WHERE id = ?')
      .run(
        status      !== undefined ? status      : oldStatus,
        title       !== undefined ? title       : oldTitle,
        newAssignedTo, 
        description !== undefined ? description : oldDescription,
        links       !== undefined ? JSON.stringify(links) : oldLinks,
        req.params.id
      );

    res.json({ success: true, message: "Modificado con éxito" });
  } catch (error) {
    console.error("❌ Error en el UPDATE:", error);
    res.status(500).json({ error: "Error interno al actualizar" });
  }
});

app.delete('/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: "Eliminado" });
});

app.listen(5000, () => console.log('🚀 Servidor Multi-tenant activo y blindado en puerto 5000'));