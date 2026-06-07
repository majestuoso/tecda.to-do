import { useState, useEffect } from 'react';
import axios from 'axios';
import Board from './Board';
import './index.css';

// 🌐 CONFIGURACIÓN DE URLS (Producción en internet)
const APP_URL = "https://tecda-workspace.netlify.app"; 
const API_URL = "http://localhost:5000"; // Cambialo por el link de Render cuando lo tengamos

export default function App() {
  // --- ESTADOS DE AUTENTICACIÓN Y SESIÓN ---
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // --- ESTADOS DEL TABLERO ---
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWs, setSelectedWs] = useState<any>(null);

  // --- CONTROLADOR DE LA VENTANA DE INVITACIÓN ---
  const [showActiveLink, setShowActiveLink] = useState(false);

  // --- DETECTAR ENLACES DE INVITACIÓN ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');

    if (inviteToken) {
      try {
        const workspaceIdReal = atob(inviteToken);
        localStorage.setItem('pending_invite', workspaceIdReal);
        if (!localStorage.getItem('user')) {
          setIsRegistering(true);
        }
      } catch (error) {
        console.error("❌ Link de invitación corrupto.");
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    setShowActiveLink(false);
  }, [selectedWs]);

  // --- TRAER WORKSPACES FILTRADOS POR USUARIO ---
  useEffect(() => {
    if (user) {
      fetchWorkspaces();
      checkPendingInvite(user.id);
    }
  }, [user]);

  const fetchWorkspaces = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_URL}/workspaces/user/${user.id}`);
      setWorkspaces(res.data);
    } catch (err) {
      console.error("Error al traer espacios:", err);
    }
  };

  const checkPendingInvite = async (userId: string) => {
    const pendingWsId = localStorage.getItem('pending_invite');
    if (!pendingWsId) return;

    try {
      await axios.post(`${API_URL}/workspaces/join-via-link`, {
        workspaceId: pendingWsId,
        userId: userId
      });
      localStorage.removeItem('pending_invite');
      fetchWorkspaces();
      alert("🎉 ¡Te uniste con éxito al espacio de trabajo!");
    } catch (err) {
      console.error("Error al unirse:", err);
    }
  };

  // --- LÓGICA DE ENTRADA / REGISTRO ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        const res = await axios.post(`${API_URL}/auth/register`, authForm);
        if (res.data.success) {
          const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: authForm.email,
            password: authForm.password
          });
          setUser(loginRes.data.user);
          localStorage.setItem('user', JSON.stringify(loginRes.data.user));
        }
      } else {
        const res = await axios.post(`${API_URL}/auth/login`, {
          email: authForm.email,
          password: authForm.password
        });
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'Ocurrió un error en la autenticación');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedWs(null);
    localStorage.removeItem('user');
  };

  // --- ACCIONES DE ESPACIOS DE TRABAJO ---
  const addWs = async () => {
    if (!user) return;
    const name = prompt("Nombre del nuevo espacio:");
    if (!name) return;
    
    const wsId = 'w_' + Date.now().toString();
    const newWs = { id: wsId, name, ownerId: user.id };
    
    try {
      await axios.post(`${API_URL}/workspaces`, newWs);
      fetchWorkspaces();
    } catch (err) {
      console.error("Error al crear espacio:", err);
    }
  };

  // Permite al colaborador unirse usando el código explicativo
  const joinWithCode = async () => {
    if (!user) return;
    const code = prompt("Ingresá el código del espacio de trabajo:");
    if (!code) return;

    try {
      await axios.post(`${API_URL}/workspaces/join-via-link`, {
        workspaceId: code.trim(),
        userId: user.id
      });
      fetchWorkspaces();
      alert("🎉 ¡Te uniste al espacio de trabajo con éxito!");
    } catch (err) {
      alert("❌ Código inválido o ya estás unido a este espacio.");
    }
  };

  const deleteWs = async (e: React.MouseEvent, ws: any) => {
    e.stopPropagation();
    if (ws.role !== 'owner') {
      alert("❌ No podés borrar este espacio porque sos un invitado.");
      return;
    }
    if (!confirm(`¿Borrar el espacio "${ws.name}"?`)) return;
    try {
      await axios.delete(`${API_URL}/workspaces/${ws.id}`);
      setWorkspaces(workspaces.filter(w => w.id !== ws.id));
      if (selectedWs?.id === ws.id) setSelectedWs(null);
    } catch (err) {
      console.error(err);
    }
  };

  const editWs = async (e: React.MouseEvent, ws: any) => {
    e.stopPropagation();
    const newName = prompt("Nuevo nombre:", ws.name);
    if (!newName) return;
    try {
      await axios.patch(`${API_URL}/workspaces/${ws.id}`, { name: newName });
      setWorkspaces(workspaces.map(w => w.id === ws.id ? { ...w, name: newName } : w));
      if (selectedWs?.id === ws.id) setSelectedWs({ ...selectedWs, name: newName });
    } catch (err) {
      console.error(err);
    }
  };

  // --- Arma el texto instructivo completo con formato de WhatsApp para colaboradores ---
  const handleCopyCode = async (code: string, workspaceName: string) => {
    const mensajeCompleto = `📌 *Invitación a Tecda 3°*\n¡Hola! Te invito a unirte a nuestro espacio de trabajo: *${workspaceName}*\n\n🔗 *Link de la aplicación:* ${APP_URL}\n🔑 *Código de acceso:* \`${code}\`\n\n_Ingresá a la plataforma con el link de arriba y pegá este código en el botón "Unirse con Código" para entrar al tablero._`;

    try {
      await navigator.clipboard.writeText(mensajeCompleto);
      setShowActiveLink(false); // Cierra la ventanita
      alert("📋 ¡Mensaje completo copiado!\n\nYa podés pegarlo en WhatsApp. Tus colaboradores recibirán el link de la app y el código con la explicación de cómo usarlo.");
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // RENDER INTERFAZ
  // ==========================================
  if (!user) {
    return (
      <div className="auth-container" style={{ maxWidth: '400px', margin: '100px auto', padding: '30px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
        {authError && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{authError}</p>}
        
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isRegistering && (
            <input 
              type="text" placeholder="Nombre completo" required
              value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          )}
          <input 
            type="email" placeholder="Correo electrónico" required
            value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input 
            type="password" placeholder="Contraseña" required
            value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
            style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '12px', backgroundColor: '#1a6fa8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            {isRegistering ? 'Registrarse' : 'Ingresar'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          {isRegistering ? '¿Ya tenés cuenta?' : '¿Sos nuevo?'} {' '}
          <button type="button" onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} style={{ color: '#1a6fa8', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none' }}>
            {isRegistering ? 'Iniciá sesión' : 'Registrate acá'}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header" style={{ paddingBottom: '15px', borderBottom: '1px solid #444', marginBottom: '15px' }}>
          <h2>Tecda 3°</h2>
          <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '10px' }}>👤 {user.name}</div>
          <button onClick={handleLogout} style={{ padding: '5px 10px', backgroundColor: '#c0392b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
            🚪 Cerrar Sesión
          </button>
        </div>

        <h3>Espacios de Trabajo</h3>
        {workspaces.map(ws => (
          <div key={ws.id} className={`workspace-card ${selectedWs?.id === ws.id ? 'active' : ''}`} onClick={() => setSelectedWs(ws)}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span>{ws.name}</span>
              <small style={{ fontSize: '10px', color: ws.role === 'owner' ? '#2ecc71' : '#3498db' }}>
                {ws.role === 'owner' ? '👑 Dueño' : '👥 Invitado'}
              </small>
            </div>
            <div className="ws-actions" onClick={e => e.stopPropagation()}>
              <button title="Ver código de espacio" onClick={() => setShowActiveLink(true)}>🔑</button>
              <button title="Editar" onClick={(e) => editWs(e, ws)}>✏️</button>
              <button title="Borrar" onClick={(e) => deleteWs(e, ws)} style={{ opacity: ws.role === 'owner' ? 1 : 0.3 }}>🗑️</button>
            </div>
          </div>
        ))}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
          <button onClick={addWs} className="add-btn" style={{ width: '100%' }}>+ Nuevo Espacio</button>
          <button onClick={joinWithCode} className="add-btn" style={{ width: '100%', backgroundColor: '#34495e' }}>🔑 Unirse con Código</button>
        </div>
      </aside>

      <main className="main-content">
        {selectedWs ? (
          <div className="board-wrapper">
            <div className="header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', minHeight: '50px' }}>
              <h1>{selectedWs.name}</h1>
              
              {!showActiveLink ? (
                <button 
                  onClick={() => setShowActiveLink(true)}
                  style={{ padding: '10px 16px', backgroundColor: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                >
                  🟩 Invitar al espacio
                </button>
              ) : (
                <div style={{ padding: '8px 12px', backgroundColor: '#f0f8ff', border: '2px solid #0056b3', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '420px', width: '100%' }}>
                  <span style={{ fontSize: '13px', color: '#333', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🔑 Código:</span>
                  <input 
                    type="text"
                    readOnly
                    value={selectedWs.id}
                    style={{ flex: 1, padding: '6px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', color: '#0056b3', fontWeight: 'bold', textAlign: 'center', letterSpacing: '1px' }}
                    onFocus={e => e.target.select()}
                  />
                  <button
                    onClick={() => handleCopyCode(selectedWs.id, selectedWs.name)}
                    style={{ padding: '6px 12px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 'bold' }}
                  >
                    📋 Copiar Invitación
                  </button>
                </div>
              )}
            </div>

            <Board workspaceId={selectedWs.id} />
          </div>
        ) : (
          <p className="placeholder">
            👋 ¡Hola, {user.name}! Seleccioná un espacio de trabajo o usá un código para empezar.
          </p>
        )}
      </main>
    </div>
  );
}