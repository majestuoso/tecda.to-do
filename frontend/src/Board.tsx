import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_URL = "https://tecda-backend.onrender.com";

export default function Board({ workspaceId }: { workspaceId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [topAssignee, setTopAssignee] = useState('');
  
  // Estados para el Modal
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [modalDescription, setModalDescription] = useState('');
  const [modalStatus, setModalStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [modalColor, setModalColor] = useState('#ffffff');
  const [modalAssignee, setModalAssignee] = useState('');

  useEffect(() => {
    if (workspaceId) {
      fetchTasks();
      fetchMembers();
    }
  }, [workspaceId]);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks/${workspaceId}`);
      setTasks(res.data || []);
    } catch (err) { console.error("Error al cargar:", err); }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API_URL}/workspaces/${workspaceId}/members`);
      setMembers(res.data || []);
    } catch (err) { console.error("Error miembros:", err); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const tempTask = {
      id: 'temp_' + Date.now(),
      workspaceId,
      title: newTaskTitle.trim(),
      status: 'todo',
      color: '#ffffff',
      assignedTo: topAssignee || '',
      description: ''
    };

    setTasks(prev => [...prev, tempTask]);
    setNewTaskTitle('');
    setTopAssignee('');

    try {
      const res = await axios.post(`${API_URL}/tasks`, tempTask);
      if (res.data) {
        setTasks(prev => prev.map(t => t.id === tempTask.id ? res.data : t));
      }
    } catch (err) {
      setTasks(prev => prev.filter(t => t.id !== tempTask.id));
      alert("No se pudo guardar en el servidor.");
    }
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

  const openTaskModal = (task: any) => {
    setSelectedTask(task);
    setModalDescription(task.description || '');
    setModalStatus(task.status);
    setModalColor(task.color || '#ffffff');
    setModalAssignee(task.assignedTo || '');
  };

  const handleSaveModalChanges = async () => {
    if (!selectedTask) return;
    const updated = { ...selectedTask, description: modalDescription, status: modalStatus, color: modalColor, assignedTo: modalAssignee };
    setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t));
    try {
      await axios.patch(`${API_URL}/tasks/${selectedTask.id}`, updated);
      setSelectedTask(null);
    } catch (err) { console.error(err); }
  };

  return (
    <div className="board-container" style={{ width: '100%', padding: '20px' }}>
      <form onSubmit={handleAddTask} style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Nueva tarea..." style={{ padding: '8px', flex: 1 }} />
        <select value={topAssignee} onChange={e => setTopAssignee(e.target.value)}>
          <option value="">Asignar a...</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button type="submit">Añadir</button>
      </form>

      <div style={{ display: 'flex', gap: '20px' }}>
        {['todo', 'in_progress', 'done'].map(status => (
          <div key={status} style={{ width: '300px', background: '#ebecf0', padding: '10px' }}>
            <h3>{status.toUpperCase()}</h3>
            {tasks.filter(t => t.status === status).map(t => (
              <div key={t.id} onClick={() => openTaskModal(t)} style={{ background: t.color, margin: '5px 0', padding: '10px', cursor: 'pointer', border: '1px solid #ccc' }}>
                {t.title}
                <button onClick={(e) => handleDeleteTask(t.id, e)}>🗑️</button>
                <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, t.status); }}>➡️</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '20px', width: '300px' }}>
            <h2>Editar Tarea</h2>
            <textarea value={modalDescription} onChange={e => setModalDescription(e.target.value)} placeholder="Descripción..." />
            <select value={modalStatus} onChange={e => setModalStatus(e.target.value as any)}>
              <option value="todo">Por Hacer</option>
              <option value="in_progress">En Proceso</option>
              <option value="done">Terminado</option>
            </select>
            <input type="color" value={modalColor} onChange={e => setModalColor(e.target.value)} />
            <button onClick={handleSaveModalChanges}>Guardar</button>
            <button onClick={() => setSelectedTask(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}