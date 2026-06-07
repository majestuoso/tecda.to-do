import { useState, useEffect } from 'react';
import axios from 'axios';

// 🌐 URL de tu backend en Render
const API_URL = "https://tecda-backend.onrender.com";

interface Task {
  id: string;
  title: string;
  assignedTo: string;
  status: string;
  description?: string;
  links?: string[];
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
  const [newTask, setNewTask] = useState({ title: '', assignedTo: '' });
  const [colors, setColors] = useState({ todo: '#c8b400', 'in-progress': '#1a6fa8', done: '#1a8c52' });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [panelData, setPanelData] = useState({ title: '', assignedTo: '', description: '', status: 'todo', links: [] as string[] });
  const [newLink, setNewLink] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (workspaceId) fetchTasks(); }, [workspaceId]);

  const normalizeTasks = (data: any[]): Task[] =>
    data.map(t => ({
      ...t,
      assignedTo: t.assignedTo ?? t.assignedto ?? '',
      links: parseLinks(t.links)
    }));

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks/${workspaceId}`);
      setTasks(normalizeTasks(res.data));
    } catch (err) { console.error("Error al cargar tareas:", err); }
  };

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    const task = { id: Date.now().toString(), project_id: workspaceId + '_p', ...newTask, status: 'todo', description: '', links: [] };
    await axios.post(`${API_URL}/tasks`, task);
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
      await axios.patch(`${API_URL}/tasks/${taskId}`, dataToSend);

      setTasks(prevTasks => {
        return prevTasks.map(t =>
          t.id === taskId 
            ? { ...t, title: panelData.title, assignedTo: panelData.assignedTo, status: panelData.status, description: panelData.description, links: panelData.links } 
            : t
        );
      });

      closePanel();
      
      setTimeout(() => { fetchTasks(); }, 100);
    } catch (err) { console.error("Error al guardar la tarea:", err); }
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
    await axios.patch(`${API_URL}/tasks/${id}`, { status });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const deleteTask = async (id: string) => {
    await axios.delete(`${API_URL}/tasks/${id}`);
    if (selectedTask?.id === id) closePanel();
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const statusLabel: Record<string, string> = { todo: 'Hacer', 'in-progress': 'En curso', done: 'Hecho' };
  const columnLabel: Record<string, string> = { todo: 'HACER', 'in-progress': 'EN CURSO', done: 'HECHO' };

  return (
    <div className="board-wrapper">
      <div className="task-form-container">
        <input placeholder="Nombre de la tarea" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} onKeyDown={e => e.key === 'Enter' && addTask()} />
        <input placeholder="Responsable" value={newTask.assignedTo} onChange={e => setNewTask({ ...newTask, assignedTo: e.target.value })} onKeyDown={e => e.key === 'Enter' && addTask()} />
        <button onClick={addTask}>+ Agregar</button>
      </div>

      <div className="board-grid">
        {['todo', 'in-progress', 'done'].map(status => (
          <div key={status} className="column" style={{ backgroundColor: colors[status as keyof typeof colors] }}>
            <div className="column-header">
              <h3>{columnLabel[status]}</h3>
              <input type="color" value={colors[status as keyof typeof colors]} onChange={e => setColors({ ...colors, [status]: e.target.value })} />
            </div>
            <div className="tasks-list">
              {tasks.filter(t => t.status === status).map(t => (
                <div key={`${t.id}-${t.assignedTo}`} className={`task-card ${selectedTask?.id === t.id ? 'task-card--active' : ''}`} onClick={() => openPanel(t)} style={{ cursor: 'pointer' }}>
                  <div className="task-content">
                    <div style={{ width: '100%' }}>
                      <strong>{t.title}</strong><br />
                      <small>👤 {t.assignedTo || 'Sin asignar'}</small>
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
            {/* Panel de edición */}
            <div className="panel-header">
              <span className="panel-status-badge" style={{ backgroundColor: colors[panelData.status as keyof typeof colors] }}>{statusLabel[panelData.status] || panelData.status}</span>
              <button className="panel-close-btn" onClick={closePanel}>✕</button>
            </div>
            <div className="panel-section">
              <label>Título</label>
              <input className="panel-input" value={panelData.title} onChange={e => setPanelData({ ...panelData, title: e.target.value })} />
            </div>
            <div className="panel-section">
              <label>Responsable</label>
              <input className="panel-input" value={panelData.assignedTo} onChange={e => setPanelData({ ...panelData, assignedTo: e.target.value })} />
            </div>
            <div className="panel-section">
              <label>Estado</label>
              <select className="panel-select" value={panelData.status} onChange={e => setPanelData({ ...panelData, status: e.target.value })}>
                <option value="todo">Hacer</option>
                <option value="in-progress">En curso</option>
                <option value="done">Hecho</option>
              </select>
            </div>
            <div className="panel-section">
              <label>Descripción</label>
              <textarea className="panel-textarea" value={panelData.description} onChange={e => setPanelData({ ...panelData, description: e.target.value })} rows={5} />
            </div>
            <div className="panel-section">
              <label>🔗 Enlaces</label>
              <input className="panel-input" placeholder="Pegá URL..." value={newLink} onChange={e => setNewLink(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} />
              <button onClick={addLink}>+ Agregar</button>
              {panelData.links.map((link, idx) => (
                <div key={idx} className="link-item"><a href={link} target="_blank" rel="noopener noreferrer">{link}</a><button onClick={() => removeLink(idx)}>✕</button></div>
              ))}
            </div>
            <button className="panel-save-btn" onClick={savePanel} disabled={saving}>{saving ? 'Guardando...' : '💾 Guardar'}</button>
          </div>
        </>
      )}
    </div>
  );
}