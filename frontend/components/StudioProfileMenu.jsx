import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import './studio-profile-menu.css';

export default function StudioProfileMenu({ user, updateUser, logout }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || 'Usuário');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  useEffect(() => setName(user?.name || 'Usuário'), [user?.name]);

  useEffect(() => {
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  async function saveName(event) {
    event.preventDefault();
    const value = name.trim();
    if (!value || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await api.patch('/user/me', { name: value });
      updateUser(result.user);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Não foi possível alterar seu nome.');
    } finally {
      setSaving(false);
    }
  }

  function replayCodex() {
    localStorage.removeItem('prism_codex_intro_seen');
    setOpen(false);
    navigate('/codex');
  }

  function signOut() {
    setOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  const displayName = user?.name || 'Usuário';
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="studio-profile-root" ref={rootRef}>
      {open && (
        <div className="studio-profile-menu" role="menu">
          <div className="studio-profile-menu-head">
            <div className="studio-profile-avatar large">{initial}</div>
            <div className="studio-profile-identity"><strong>{displayName}</strong><span>{user?.email || 'Conta Prism'}</span></div>
          </div>

          {editing ? (
            <form className="studio-profile-edit" onSubmit={saveName}>
              <label htmlFor="studio-profile-name">Nome</label>
              <input id="studio-profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />
              {error && <p className="studio-profile-error">{error}</p>}
              <div className="studio-profile-edit-actions">
                <button type="button" onClick={() => { setEditing(false); setError(''); }}>Cancelar</button>
                <button type="submit" className="primary" disabled={saving || !name.trim()}>{saving ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </form>
          ) : (
            <>
              <button className="studio-profile-item" role="menuitem" onClick={() => setEditing(true)}><span className="item-index">01</span><span><strong>Alterar nome</strong><small>Editar como você aparece no Prism</small></span><b>↗</b></button>
              <button className="studio-profile-item codex" role="menuitem" onClick={replayCodex}><span className="item-index">02</span><span><strong>Apresentação do Prism Codex</strong><small>Reproduzir a introdução cinematográfica</small></span><b>↗</b></button>
              <div className="studio-profile-rule" />
              <button className="studio-profile-item danger" role="menuitem" onClick={signOut}><span className="item-index">03</span><span><strong>Sair da conta</strong><small>Encerrar esta sessão neste dispositivo</small></span><b>↗</b></button>
            </>
          )}
        </div>
      )}

      <button className={`studio-profile-trigger ${open ? 'open' : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        <div className="studio-profile-avatar">{initial}</div>
        <div className="studio-profile-trigger-copy"><strong>{displayName}</strong><span>{user?.plan || 'free'} · conta pessoal</span></div>
        <span className="studio-profile-chevron">⌃</span>
      </button>
    </div>
  );
}
