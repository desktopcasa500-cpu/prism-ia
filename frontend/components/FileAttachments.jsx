import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import './file-attachments.css';

const ACCEPT = '.pdf,.docx,.csv,.txt,.html,.odt,.rtf,.epub,.json,.xlsx,.js,.ts,.jsx,.tsx,.css,.md,.py,.java,.go,.rs,.sql,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip';
const MAX = 10 * 1024 * 1024;

function formatSize(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`; return `${Math.round(bytes / 104857.6) / 10} MB`; }
function readBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.')); reader.readAsDataURL(file); }); }

export default function FileAttachments({ value = [], onChange, projectId = null, disabled = false, label = 'Adicionar arquivo' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  async function addFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      const next = [...value];
      for (const file of files) {
        if (file.size > MAX) throw new Error(`${file.name} excede o limite de 10 MB.`);
        const dataBase64 = await readBase64(file);
        const result = await api.post('/uploads', { name: file.name, mimeType: file.type, dataBase64, projectId });
        if (!result?.upload?.id) throw new Error(`Não foi possível enviar ${file.name}.`);
        next.push({ ...result.upload, size_bytes: file.size });
      }
      onChange?.(next.filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index));
    } catch (cause) { setError(cause.message || 'Não foi possível enviar o arquivo.'); }
    finally { setUploading(false); }
  }
  function remove(id) { onChange?.(value.filter((item) => item.id !== id)); }
  return <div className="file-attachments">
    <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
    <div className="file-attachments-row">
      <button type="button" className="attach-trigger" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>{uploading ? 'Enviando…' : `＋ ${label}`}</button>
      {value.map((file) => <div className="attachment-chip" key={file.id}><span title={file.name}>{file.name}</span><small>{formatSize(Number(file.size_bytes || 0))}</small><button type="button" onClick={() => remove(file.id)} disabled={disabled} aria-label={`Remover ${file.name}`}>×</button></div>)}
    </div>
    {error && <div className="file-attachments-error" role="alert">{error}</div>}
  </div>;
}
