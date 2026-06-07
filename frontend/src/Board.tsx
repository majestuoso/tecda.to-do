import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_URL = "https://tecda-backend.onrender.com";

export default function Board({ workspaceId }: { workspaceId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [topAssignee, setTopAssignee] = useState('');
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Estados del Modal
  const [modalDesc, setModalDesc] = useState('');
  const [modalStatus, setModalStatus] = useState('todo');
  const [modalColor, setModalColor] = useState('#ffffff');
  const [modalAssignee, setModalAssignee] = useState('');

  useEffect(() => {
    if (workspaceId) loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        axios.get(`${API_URL}/tasks/${workspaceId}`),
        axios.get(`${API_URL}/workspaces/${workspaceId}/members`)
      ]);
      setTasks(tRes.data || []);
      setMembers(mRes.data || []);
    } catch (err) { console.error(err); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: 'tmp_' + Date.now(),
      workspaceId,
      title: newTaskTitle.trim(),
      status: 'todo',
      color: '#ffffff',
      assignedTo: topAssignee
    };

    // 1. Actualización visual instantánea
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    setTopAssignee('');

    // 2. Persistencia en servidor
    try {
      await axios.post(`${API_URL}/tasks`, newTask);
      loadData(); // Refresca para obtener el ID real de DB
    } catch (err) { console.error("Error al persistir:", err); }
  };

  const handleUpdateStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'todo' ? 'in_progress' : currentStatus === 'in_progress' ? 'done' : 'todo';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    try { await axios.patch(`${API_URL}/tasks/${taskId}`, { status: nextStatus }); } 
    catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try { await axios.delete(`${API_URL}/tasks/${taskId}`); } 
    catch (err) { console.error(err); }
  };

  const openModal = (t: any) => {
    setSelectedTask(t);
    setModalDesc(t.description || '');
    setModalStatus(t.status);
    setModalColor(t.color || '#ffffff');
    setModalAssignee(t.assignedTo || '');
  };

  const saveModal = async () => {
    setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, description: modalDesc, status: modalStatus, color: modalColor, assignedTo: modalAssignee } : t));
    try {
      await axios.patch(`${API_URL}/tasks/${selectedTask.id}`, { description: modalDesc, status: modalStatus, color: modalColor, assignedTo: modalAssignee });
      setSelectedTask(null);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="board-container" style={{ padding: '20px' }}>
      <form onSubmit={handleAddTask} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nueva tarea..." style={{ padding: '8px', flex: 1 }} />
        <select value={topAssignee} onChange={e => setTopAssignee(e.target.value)}>
          <option value="">Asignar a...</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button type="submit">+ Añadir</button>
      </form>

      <div style={{ display: 'flex', gap: '20px' }}>
        {['todo', 'in_progress', 'done'].map(status => (
          <div key={status} style={{ width: '300px', background: '#ebecf0', padding: '10px', minHeight: '400px' }}>
            <h3>{status.toUpperCase()}</h3>
            {tasks.filter(t => t.status === status).map(t => (
              <div key={t.id} onClick={() => openModal(t)} style={{ background: t.color || '#fff', margin: '5px 0', padding: '10px', cursor: 'pointer', borderRadius: '4px' }}>
                {t.title}
                <button onClick={(e) => handleDeleteTask(t.id, e)}>🗑️</button>
                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, t.status); }}>👉</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '20px', width: '400px', borderRadius: '8px' }}>
            <h2>Editar Tarea</h2>
            <input value={modalDesc} onChange={e => setModalDesc(e.target.value)} placeholder="Descripción" style={{ width: '100%', marginBottom: '10px' }} />
            <select value={modalStatus} onChange={e => setModalStatus(e.target.value)} style={{ width: '100%', marginBottom: '10px' }}>
              <option value="todo">Por Hacer</option>
              <option value="in_progress">En Proceso</option>
              <option value="done">Terminado</option>
            </select>
            <input type="color" value={modalColor} onChange={e => setModalColor(e.target.value)} />
            <button onClick={saveModal}>Guardar Cambios</button>
            <button onClick={() => setSelectedTask(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}