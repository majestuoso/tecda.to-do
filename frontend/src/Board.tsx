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

  // Estados para el Modal de edición
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
    } catch (err) { console.error("Error al cargar tareas:", err); }
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
        // Reemplazamos la tarea temporal por la real del servidor
        setTasks(prev => prev.map(t => t.id === tempTask.id ? res.data : t));
      }
    } catch (err) {
      console.error("Error al persistir:", err);
      // No eliminamos la tarea, dejamos que el usuario vea que está en local
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
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px', marginBottom: '30px', background: '#f0f2f5', padding: '15px', borderRadius: '8px' }}>
        <input style={{ flex: 1, padding: '10px' }} value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="¿Qué hay que hacer?" />
        <select style={{ padding: '10px' }} value={topAssignee} onChange={e => setTopAssignee(e.target.value)}>
          <option value="">Asignar a...</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }} type="submit">Agregar</button>
      </form>

      <div style={{ display: 'flex', gap: '20px' }}>
        {['todo', 'in_progress', 'done'].map(status => (
          <div key={status} style={{ width: '33%', background: '#ebecf0', padding: '15px', borderRadius: '8px' }}>
            <h3 style={{ textTransform: 'uppercase', fontSize: '14px', marginBottom: '15px' }}>{status.replace('_', ' ')}</h3>
            {tasks.filter(t => t.status === status).map(t => (
              <div key={t.id} onClick={() => openTaskModal(t)} style={{ background: t.color, padding: '12px', marginBottom: '10px', borderRadius: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <strong>{t.title}</strong>
                <div style={{ marginTop: '10px', display: 'flex', gap: '5px' }}>
                  <button onClick={(e) => handleDeleteTask(t.id, e)}>🗑️</button>
                  <button onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, t.status); }}>➡️</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {selectedTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', width: '400px' }}>
            <h3>Editar: {selectedTask.title}</h3>
            <textarea style={{ width: '100%', marginBottom: '10px' }} value={modalDescription} onChange={e => setModalDescription(e.target.value)} placeholder="Descripción" />
            <select style={{ width: '100%', marginBottom: '10px' }} value={modalStatus} onChange={e => setModalStatus(e.target.value as any)}>
              <option value="todo">Por Hacer</option>
              <option value="in_progress">En Proceso</option>
              <option value="done">Terminado</option>
            </select>
            <input type="color" value={modalColor} onChange={e => setModalColor(e.target.value)} />
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button onClick={handleSaveModalChanges}>Guardar</button>
              <button onClick={() => setSelectedTask(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}