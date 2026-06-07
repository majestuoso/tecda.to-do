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
  color?: string;
  assignedTo?: string;
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

  // --- ESTADOS PARA COLORES DE LAS COLUMNAS ---
  const [todoBg, setTodoBg] = useState('#ebecf0');
  const [progressBg, setProgressBg] = useState('#ebecf0');
  const [doneBg, setDoneBg] = useState('#ebecf0');

  // --- ESTADOS PARA LA VENTANA DE TAREA (MODAL) ---
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalDescription, setModalDescription] = useState('');
  const [modalColor, setModalColor] = useState('#ffffff');
  const [modalAssignee, setModalAssignee] = useState('');

  useEffect(() => {
    if (workspaceId) {
      fetchTasks();
      fetchMembers();
      setTodoBg('#ebecf0');
      setProgressBg('#ebecf0');
      setDoneBg('#ebecf0');
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
      status: 'todo',
      color: '#ffffff',
      description: '',
      assignedTo: ''
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

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Seguro que querés eliminar esta tarea?")) return;
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`);
      fetchTasks();
      if (selectedTask?.id === taskId) setSelectedTask(null);
    } catch (err) {
      console.error("Error al eliminar tarea:", err);
    }
  };

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setModalDescription(task.description || '');
    setModalColor(task.color || '#ffffff');
    setModalAssignee(task.assignedTo || '');
  };

  const handleSaveModalChanges = async () => {
    if (!selectedTask) return;
    try {
      await axios.patch(`${API_URL}/tasks/${selectedTask.id}`, {
        description: modalDescription,
        color: modalColor,
        assignedTo: modalAssignee
      });
      setSelectedTask(null);
      fetchTasks();
    } catch (err) {
      console.error("Error al guardar detalles:", err);
    }
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  return (
    <div className="board-container" style={{ width: '100%', overflowX: 'auto' }}>
      {/* Barra superior de acciones */}
      <div style={{ display: 'flex', gap: '30px', marginBottom: '25px', flexWrap: 'wrap', maxWidth: '1000px' }}>
        <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '10px', flex: '1', minWidth: '260px' }}>
          <input 
            type="text" 
            placeholder="Escribí una nueva tarea..." 
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}
          />
          <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#1a6fa8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            + Añadir
          </button>
        </form>

        <div className="members-box" style={{ padding: '6px 12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #ddd' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#555' }}>👥 Equipo:</span>
          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
            {members.map(m => (
              <span key={m.id} title={m.email} style={{ padding: '2px 6px', backgroundColor: '#e2e8f0', borderRadius: '12px', fontSize: '11px', color: '#4a5568' }}>
                {m.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Columnas Kanban más delgadas */}
      <div className="kanban-grid" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Columna: Por Hacer */}
        <div className="kanban-column" style={{ backgroundColor: todoBg, padding: '12px', borderRadius: '8px', width: '250px', minHeight: '400px', transition: 'background-color 0.3s', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#c0392b', fontSize: '14px', fontWeight: 'bold' }}>🔴 Por Hacer ({todoTasks.length})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="color" value={todoBg} onChange={e => setTodoBg(e.target.value)} style={{ width: '18px', height: '18px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todoTasks.map(t => {
              const assignedUser = members.find(m => m.id === t.assignedTo);
              return (
                <div key={t.id} onClick={() => openTaskModal(t)} className="task-card" style={{ backgroundColor: t.color || '#fff', padding: '10px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-word', paddingRight: '4px' }}>{t.title}</span>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                      <button title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#7f8c8d', padding: '2px' }}>✏️</button>
                      <button title="Mover" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, t.status); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>👉</button>
                      <button title="Eliminar" onClick={(e) => handleDeleteTask(t.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }}>🗑️</button>
                    </div>
                  </div>
                  {assignedUser && <small style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>👤 {assignedUser.name}</small>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna: En Proceso */}
        <div className="kanban-column" style={{ backgroundColor: progressBg, padding: '12px', borderRadius: '8px', width: '250px', minHeight: '400px', transition: 'background-color 0.3s', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#d35400', fontSize: '14px', fontWeight: 'bold' }}>🟠 En Proceso ({inProgressTasks.length})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="color" value={progressBg} onChange={e => setProgressBg(e.target.value)} style={{ width: '18px', height: '18px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {inProgressTasks.map(t => {
              const assignedUser = members.find(m => m.id === t.assignedTo);
              return (
                <div key={t.id} onClick={() => openTaskModal(t)} className="task-card" style={{ backgroundColor: t.color || '#fff', padding: '10px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, wordBreak: 'break-word', paddingRight: '4px' }}>{t.title}</span>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                      <button title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#7f8c8d', padding: '2px' }}>✏️</button>
                      <button title="Mover" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, t.status); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>👉</button>
                      <button title="Eliminar" onClick={(e) => handleDeleteTask(t.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }}>🗑️</button>
                    </div>
                  </div>
                  {assignedUser && <small style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>👤 {assignedUser.name}</small>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Columna: Terminado */}
        <div className="kanban-column" style={{ backgroundColor: doneBg, padding: '12px', borderRadius: '8px', width: '250px', minHeight: '400px', transition: 'background-color 0.3s', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: '#27ae60', fontSize: '14px', fontWeight: 'bold' }}>🟢 Terminado ({doneTasks.length})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="color" value={doneBg} onChange={e => setDoneBg(e.target.value)} style={{ width: '18px', height: '18px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {doneTasks.map(t => {
              const assignedUser = members.find(m => m.id === t.assignedTo);
              return (
                <div key={t.id} onClick={() => openTaskModal(t)} className="task-card" style={{ backgroundColor: t.color || '#fff', padding: '10px', borderRadius: '4px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', borderLeft: '3px solid #27ae60' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, textDecoration: 'line-through', color: '#7f8c8d', wordBreak: 'break-word', paddingRight: '4px' }}>{t.title}</span>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                      <button title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#7f8c8d', padding: '2px' }}>✏️</button>
                      <button title="Reiniciar" onClick={(e) => { e.stopPropagation(); handleUpdateStatus(t.id, t.status); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}>🔄</button>
                      <button title="Eliminar" onClick={(e) => handleDeleteTask(t.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px' }}>🗑️</button>
                    </div>
                  </div>
                  {assignedUser && <small style={{ fontSize: '10px', color: '#7f8c8d', fontStyle: 'italic' }}>👤 {assignedUser.name}</small>}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* --- MODAL FLOTANTE DE EDICIÓN --- */}
      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>📝 Editar Tarea</h3>
              <button onClick={() => setSelectedTask(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>&times;</button>
            </div>

            <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#333' }}>
              {selectedTask.title}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>Descripción de la actividad:</label>
              <textarea 
                rows={3}
                placeholder="Detallá los requisitos de esta tarea..."
                value={modalDescription}
                onChange={e => setModalDescription(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>👤 Asignar a un miembro:</label>
              <select 
                value={modalAssignee}
                onChange={e => setModalAssignee(e.target.value)}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
              >
                <option value="">Sin asignar (Nadie)</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>🎨 Color de fondo de la tarjeta:</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={modalColor}
                  onChange={e => setModalColor(e.target.value)}
                  style={{ width: '35px', height: '30px', padding: 0, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12px', color: '#666' }}>Elegí el color de la tarjeta</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button onClick={() => setSelectedTask(null)} style={{ padding: '6px 12px', backgroundColor: '#7f8c8d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
              <button onClick={handleSaveModalChanges} style={{ padding: '6px 14px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                Guardar Cambios
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}