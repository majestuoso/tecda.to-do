import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database('database.db');
db.exec('PRAGMA foreign_keys = ON;');

// =========================================================================
// 1. INICIALIZACIÓN DE TABLAS
// =========================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT, owner_id TEXT, FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE SET NULL);
  CREATE TABLE IF NOT EXISTS workspace_members (workspace_id TEXT, user_id TEXT, role TEXT DEFAULT 'guest', PRIMARY KEY (workspace_id, user_id), FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, workspace_id TEXT, name TEXT, FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE);
  CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, project_id TEXT, title TEXT, status TEXT DEFAULT 'todo', assignedTo TEXT, description TEXT DEFAULT '', links TEXT DEFAULT '[]', FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE, FOREIGN KEY(assignedTo) REFERENCES users(id) ON DELETE SET NULL);
`);

// =========================================================================
// 2. RUTAS DE AUTENTICACIÓN
// =========================================================================
app.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const id = 'u_' + Date.now().toString();
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)').run(id, name, email, hashedPassword);
    res.status(201).json({ success: true });
  } catch (err) { res.status(400).json({ error: "Email ya registrado." }); }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (user && await bcrypt.compare(password, user.password)) {
    res.json({ success: true, user: { id: user.id, name: user.name } });
  } else {
    res.status(401).json({ error: "Credenciales inválidas." });
  }
});

// =========================================================================
// 3. RUTAS DE WORKSPACES
// =========================================================================
app.get('/workspaces/user/:userId', (req, res) => {
  const data = db.prepare('SELECT w.*, wm.role FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = ?').all(req.params.userId);
  res.json(data);
});

app.post('/workspaces', (req, res) => {
  const { id, name, ownerId } = req.body;
  try {
    db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(id, name, ownerId);
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(id, ownerId, 'owner');
    db.prepare('INSERT INTO projects (id, workspace_id, name) VALUES (?, ?, ?)').run(id + '_p', id, 'General');
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: "Error al crear" }); }
});

app.patch('/workspaces/:id', (req, res) => {
  const { name } = req.body;
  try {
    db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json({ success: true });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: "Error al actualizar" }); 
  }
});

app.delete('/workspaces/:id', (req, res) => {
  db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/workspaces/join-via-link', (req, res) => {
  const { workspaceId, userId } = req.body;
  try {
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(workspaceId, userId, 'guest');
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: "Ya es miembro" }); }
});

app.get('/workspaces/:workspaceId/members', (req, res) => {
  const members = db.prepare('SELECT u.id, u.name FROM users u JOIN workspace_members wm ON u.id = wm.user_id WHERE wm.workspace_id = ?').all(req.params.workspaceId);
  res.json(members);
});

// =========================================================================
// 4. RUTAS DE TAREAS
// =========================================================================
app.get('/tasks/:workspaceId', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(req.params.workspaceId + '_p');
  res.json(tasks);
});

app.post('/tasks', (req, res) => {
  const { id, project_id, title, status, assignedTo, description } = req.body;
  const resp = (assignedTo && assignedTo.trim() !== '') ? assignedTo : null;
  db.prepare('INSERT INTO tasks (id, project_id, title, status, assignedTo, description) VALUES (?, ?, ?, ?, ?, ?)').run(id, project_id, title, status || 'todo', resp, description || '');
  res.status(201).json({ success: true });
});

// --- RUTA PATCH TAREAS CORREGIDA ---
app.patch('/tasks/:id', (req, res) => {
  const { status, title, assignedTo, description } = req.body;
  const resp = (assignedTo && assignedTo.trim() !== '') ? assignedTo : null;
  
  try {
    const info = db.prepare('UPDATE tasks SET status = ?, title = ?, assignedTo = ?, description = ? WHERE id = ?')
      .run(status, title, resp, description, req.params.id);
      
    if (info.changes === 0) return res.status(404).json({ error: "Tarea no encontrada" });
    res.json({ success: true });
  } catch (err) { 
    console.error("Error SQL:", err);
    res.status(500).json({ error: "Error al actualizar tarea" }); 
  }
});

app.listen(5000, () => console.log('🚀 Servidor activo en puerto 5000'));