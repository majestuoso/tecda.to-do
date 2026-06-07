import { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

// 🌐 CONFIGURACIÓN DE URL (Producción en Render)
const API_URL = "https://tecda-backend.onrender.com";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Board({ workspaceId }: { workspaceId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Cargar tareas y miembros cuando cambia el espacio de trabajo
  useEffect(() => {
    if (workspaceId) {
      fetchTasks();
      fetchMembers();
    }
  }, [workspaceId]);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_URL}/tasks/${workspaceId}`);
      setTasks(res.data);
    } catch (err) {
      console.error("Error al cargar tareas:", err);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API_URL}/workspaces/${workspaceId}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error("Error al cargar miembros:", err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const taskData = {
      id: 't_' + Date.now().toString(),
      workspaceId,
      title: newTaskTitle.trim(),
      status: 'todo'
    };

    try {
      await axios.post(`${API_URL}/tasks`, taskData);
      setNewTaskTitle('');
      fetchTasks();
    } catch (err) {
      console.error("Error al crear tarea:", err);
    }
  };

  const handleUpdateStatus = async (taskId: string, currentStatus: string) => {
    let nextStatus: 'todo' | 'in_progress' | 'done' = 'todo';
    if (currentStatus === 'todo') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'done';
    else if (currentStatus === 'done') nextStatus = 'todo';

    try {
      await axios.patch(`${API_URL}/tasks/${taskId}`, { status: nextStatus });
      fetchTasks();
    } catch (err) {
      console.error("Error al actualizar estado:", err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("¿Seguro que querés eliminar esta tarea?")) return;
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`);
      fetchTasks();
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
    }
  };

  // Filtrar tareas por columnas
  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="board-container">
      {/* Sección superior: Agregar tarea y ver equipo */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '25px', flexWrap: 'wrap' }}>
        <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px', flex: '1', minWidth: '300px' }}>
          <input 
            type="text" 
            placeholder="Escribí una nueva tarea..." 
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#1a6fa8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            + Añadir
          </button>
        </form>

        <div className="members-box" style={{ padding: '10px 15px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #ddd', minWidth: '25px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>👥 Equipo en este espacio:</span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
            {members.map(m => (
              <span key={m.id} title={m.email} style={{ padding: '3px 8px', backgroundColor: '#e2e8f0', borderRadius: '12px', fontSize: '12px', color: '#4a5568' }}>
                {m.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Columnas del Tablero Kanban */}
      <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Columna: Por Hacer */}
        <div className="kanban-column" style={{ backgroundColor: '#ebecf0', padding: '15px', borderRadius: '8px', minHeight: '400px' }}>
          <h3 style={{ marginBottom: '15px', color: '#c0392b' }}>🔴 Por Hacer ({todoTasks.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todoTasks.map(t => (
              <div key={t.id} className="task-card" style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{t.title}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button title="Mover a En Proceso" onClick={() => handleUpdateStatus(t.id, t.status)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>👉</button>
                  <button title="Eliminar" onClick={() => handleDeleteTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna: En Proceso */}
        <div className="kanban-column" style={{ backgroundColor: '#ebecf0', padding: '15px', borderRadius: '8px', minHeight: '400px' }}>
          <h3 style={{ marginBottom: '15px', color: '#d35400' }}>🟠 En Proceso ({inProgressTasks.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {inProgressTasks.map(t => (
              <div key={t.id} className="task-card" style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{t.title}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button title="Mover a Terminado" onClick={() => handleUpdateStatus(t.id, t.status)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>👉</button>
                  <button title="Eliminar" onClick={() => handleDeleteTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna: Terminado */}
        <div className="kanban-column" style={{ backgroundColor: '#ebecf0', padding: '15px', borderRadius: '8px', minHeight: '400px' }}>
          <h3 style={{ marginBottom: '15px', color: '#27ae60' }}>🟢 Terminado ({doneTasks.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {doneTasks.map(t => (
              <div key={t.id} className="task-card" style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid #27ae60' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, textDecoration: 'line-through', color: '#7f8c8d' }}>{t.title}</span>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button title="Reiniciar tarea" onClick={() => handleUpdateStatus(t.id, t.status)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>🔄</button>
                  <button title="Eliminar" onClick={() => handleDeleteTask(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}