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

  // Estados para el Modal
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
      // Solo actualizamos si recibimos un array válido
      if (Array.isArray(res.data)) setTasks(res.data);
    } catch (err) { console.error("Error al cargar:", err); }
  };

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API_URL}/workspaces/${workspaceId}/members`);
      setMembers(res.data || []);
    } catch (err) { console.error("Error miembros:", err); }
  };

  // --- FUNCIÓN AGREGAR TAREA (BLINDADA) ---
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

    // 1. UI Inmediata
    setTasks(prev => [...prev, tempTask]);
    setNewTaskTitle('');
    setTopAssignee('');

    // 2. Persistencia en segundo plano
    try {
      const res = await axios.post(`${API_URL}/tasks`, tempTask);
      if (res.data) {
        // Actualizamos la tarea temporal por la que viene de DB (con su ID real)
        setTasks(prev => prev.map(t => t.id === tempTask.id ? res.data : t));
      }
    } catch (err) {
      console.error("Error al guardar, la tarea permanece en pantalla.");
    }
  };

  const handleUpdateStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'todo' ? 'in_progress' : currentStatus === 'in_progress' ? 'done' : 'todo';
    
    // UI Inmediata
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    
    try { await axios.patch(`${API_URL}/tasks/${taskId}`, { status: nextStatus }); }
    catch (err) { console.error(err); }
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta tarea?")) return;
    
    // UI Inmediata
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    try { await axios.delete(`${API_URL}/tasks/${taskId}`); }
    catch (err) { console.error(err); }
  };

  const handleSaveModalChanges = async () => {
    if (!selectedTask) return;
    
    const updated = { 
        ...selectedTask, 
        description: modalDescription, 
        status: modalStatus, 
        color: modalColor, 
        assignedTo: modalAssignee 
    };

    setTasks(prev => prev.map(t => t.id === selectedTask.id ? updated : t));
    
    try {
      await axios.patch(`${API_URL}/tasks/${selectedTask.id}`, updated);
      setSelectedTask(null);
    } catch (err) { console.error(err); }
  };

  // ... (Tu renderizado de columnas se mantiene igual)
  return (
    <div className="board-container">
        {/* Tu formulario y columnas aquí... */}
        {/* Asegúrate de usar los estados 'tasks' en tus .map() */}
    </div>
  );
}