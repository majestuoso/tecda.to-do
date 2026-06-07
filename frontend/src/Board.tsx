import { useState, useEffect } from 'react';
import axios from 'axios';

interface Task {
  id: string;
  title: string;
  assignedTo: string; // Guardará el ID del usuario
  status: string;
  description?: string;
  links?: string[];
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

const parseLinks = (links: any): string[] => {
  if (Array.isArray(links)) return links;
  if (typeof links === 'string') {
    try { return JSON.parse(links); } catch { return []; }
  }
  return [];
};

export default function Board({ workspaceId }: { workspaceId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]); // <-- NUEVO: Integrantes del espacio
  const [newTask, setNewTask] = useState({ title: '', assignedTo: '' });
  const [colors, setColors] = useState({ todo: '#c8b400', 'in-progress': '#1a6fa8', done: '#1a8c52' });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelData, setPanelData] = useState({ title: '', assignedTo: '', description: '', status: 'todo', links: [] as string[] });
  const [newLink, setNewLink] = useState('');
  const [saving, setSaving] = useState(false);

  // Cada vez que cambia el espacio de trabajo, cargamos tareas Y miembros
  useEffect(() => { 
    if (workspaceId) {
      fetchTasks(); 
      fetchMembers();
    } 
  }, [workspaceId]);

  const normalizeTasks = (data: any[]): Task[] =>
    data.map(t => ({
      ...t,
      assignedTo: t.assignedTo ?? t.assignedto ?? '',
      links: parseLinks(t.links)
    }));

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/tasks/${workspaceId}`);
      setTasks(normalizeTasks(res.data));
    } catch (err) { console.error("Error al cargar tareas:", err); }
  };

  // NUEVO: Trae los usuarios invitados a este espacio desde el backend
  const fetchMembers = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/workspaces/${workspaceId}/members`);
      setMembers(res.data);
    } catch (err) { console.error("Error al cargar miembros:", err); }
  };

  // Función auxiliar para buscar el nombre del usuario a partir de su ID
  const getUserName = (userId: string) => {
    const member = members.find(m => m.id === userId);
    return member ? member.name : 'Sin asignar';
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    const task = { 
      id: Date.now().toString(), 
      project_id: workspaceId + '_p', 
      title: newTask.title,
      assignedTo: newTask.assignedTo || null, // Guarda el ID o null si no se eligió nadie
      status: 'todo', 
      description: '', 
      links: [] 
    };
    await axios.post('http://localhost:5000/tasks', task);
    setNewTask({ title: '', assignedTo: '' });
    fetchTasks();
  };

  const openPanel = (task: Task) => {
    setSelectedTask(task);
    setPanelData({
      title: task.title,
      assignedTo: task.assignedTo || '',
      description: task.description || '',
      status: task.status,
      links: parseLinks(task.links),
    });
    setNewLink('');
  };

  const closePanel = () => setSelectedTask(null);

  const savePanel = async () => {
    if (!selectedTask || saving) return;
    const taskId = selectedTask.id;
    
    const dataToSend = {
      title: panelData.title,
      assignedTo: panelData.assignedTo, 
      status: panelData.status,
      description: panelData.description,
      links: panelData.links
    };

    setSaving(true);
    try {
      await axios.patch(`http://localhost:5000/tasks/${taskId}`, dataToSend);

      setTasks(prevTasks => {
        return prevTasks.map(t =>
          t.id === taskId 
            ? { 
                ...t, 
                title: panelData.title, 
                assignedTo: panelData.assignedTo, 
                status: panelData.status,
                description: panelData.description,
                links: panelData.links 
              } 
            : t
        );
      });

      closePanel();
      
      setTimeout(() => {
        fetchTasks();
      }, 100);

    } catch (err) {
      console.error("Error al guardar la tarea:", err);
    }
    setSaving(false);
  };

  const addLink = () => {
    const trimmed = newLink.trim();
    if (!trimmed) return;
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    setPanelData(prev => ({ ...prev, links: [...prev.links, url] }));
    setNewLink('');
  };

  const removeLink = (idx: number) => {
    setPanelData(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== idx) }));
  };

  const changeStatus = async (id: string, status: string) => {
    await axios.patch(`http://localhost:5000/tasks/${id}`, { status });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const deleteTask = async (id: string) => {
    await axios.delete(`http://localhost:5000/tasks/${id}`);
    if (selectedTask?.id === id) closePanel();
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const statusLabel: Record<string, string> = {
    todo: 'Hacer', 'in-progress': 'En curso', done: 'Hecho',
  };
  const columnLabel: Record<string, string> = {
    todo: 'HACER', 'in-progress': 'EN CURSO', done: 'HECHO',
  };

  return (
    <div className="board-wrapper">
      {/* FORMULARIO DE ALTA DE TAREAS MODIFICADO */}
      <div className="task-form-container">
        <input
          placeholder="Nombre de la tarea"
          value={newTask.title}
          onChange={e => setNewTask({ ...newTask, title: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        
        {/* REEMPLAZO: Selector desplegable de integrantes para asignar al crear */}
        <select
          value={newTask.assignedTo}
          onChange={e => setNewTask({ ...newTask, assignedTo: e.target.value })}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">Asignar integrante...</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        
        <button onClick={addTask}>+ Agregar</button>
      </div>

      <div className="board-grid">
        {['todo', 'in-progress', 'done'].map(status => (
          <div key={status} className="column" style={{ backgroundColor: colors[status as keyof typeof colors] }}>
            <div className="column-header">
              <h3>{columnLabel[status]}</h3>
              <input
                type="color"
                value={colors[status as keyof typeof colors]}
                onChange={e => setColors({ ...colors, [status]: e.target.value })}
              />
            </div>
            <div className="tasks-list">
              {tasks.filter(t => t.status === status).map(t => (
                <div
                  key={`${t.id}-${t.assignedTo}`}
                  className={`task-card ${selectedTask?.id === t.id ? 'task-card--active' : ''}`}
                  onClick={() => openPanel(t)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="task-content">
                    <div style={{ width: '100%' }}>
                      <strong>{t.title}</strong><br />
                      {/* TRUCO: Mostramos el nombre real del usuario usando su ID */}
                      <small>👤 {getUserName(t.assignedTo)}</small>
                      {(t.description || (t.links && t.links.length > 0)) && (
                        <div className="task-meta-icons">
                          {t.description && <span title="Tiene descripción">📝</span>}
                          {t.links && t.links.length > 0 && <span title={`${t.links.length} enlace(s)`}>🔗 {t.links.length}</span>}
                        </div>
                      )}
                    </div>
                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                      <select value={t.status} onChange={e => changeStatus(t.id, e.target.value)}>
                        <option value="todo">Hacer</option>
                        <option value="in-progress">En curso</option>
                        <option value="done">Hecho</option>
                      </select>
                      <button className="delete-btn" onClick={() => deleteTask(t.id)}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selectedTask && (
        <>
          <div className="panel-overlay" onClick={closePanel} />
          <div className="task-panel">
            <div className="panel-header">
              <span
                className="panel-status-badge"
                style={{ backgroundColor: colors[panelData.status as keyof typeof colors] }}
              >
                {statusLabel[panelData.status] || panelData.status}
              </span>
              <button className="panel-close-btn" onClick={closePanel}>✕</button>
            </div>

            <div className="panel-section">
              <label className="panel-label">Título</label>
              <input
                className="panel-input"
                value={panelData.title}
                onChange={e => setPanelData({ ...panelData, title: e.target.value })}
              />
            </div>

            {/* REEMPLAZO: Selector desplegable de responsables dentro del panel lateral */}
            <div className="panel-section">
              <label className="panel-label">Responsable</label>
              <select
                className="panel-select"
                value={panelData.assignedTo}
                onChange={e => setPanelData({ ...panelData, assignedTo: e.target.value })}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Sin asignar</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="panel-section">
              <label className="panel-label">Estado</label>
              <select
                className="panel-select"
                value={panelData.status}
                onChange={e => setPanelData({ ...panelData, status: e.target.value })}
              >
                <option value="todo">Hacer</option>
                <option value="in-progress">En curso</option>
                <option value="done">Hecho</option>
              </select>
            </div>

            <div className="panel-section">
              <label className="panel-label">Descripción / Notas</label>
              <textarea
                className="panel-textarea"
                placeholder="Agregá notas, contexto, instrucciones..."
                value={panelData.description}
                onChange={e => setPanelData({ ...panelData, description: e.target.value })}
                rows={5}
              />
            </div>

            <div className="panel-section">
              <label className="panel-label">🔗 Enlaces</label>
              <div className="link-input-row">
                <input
                  className="panel-input"
                  placeholder="Pegá una URL..."
                  value={newLink}
                  onChange={e => setNewLink(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addLink()}
                />
                <button className="link-add-btn" onClick={addLink}>+ Agregar</button>
              </div>
              <div className="links-list">
                {panelData.links.map((link, idx) => (
                  <div key={idx} className="link-item">
                    <a href={link} target="_blank" rel="noopener noreferrer" className="link-url">{link}</a>
                    <button className="link-remove-btn" onClick={() => removeLink(idx)}>✕</button>
                  </div>
                ))}
                {panelData.links.length === 0 && <p className="no-links">No hay enlaces todavía</p>}
              </div>
            </div>

            <div className="panel-footer">
              <button 
                type="button"
                className="panel-save-btn"
                onClick={savePanel}
                disabled={saving}
              >
                {saving ? 'Guardando...' : '💾 Guardar y cerrar'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}