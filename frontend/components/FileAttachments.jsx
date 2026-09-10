import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import './file-attachments.css';

const ACCEPT = '.pdf,.docx,.csv,.txt,.html,.odt,.rtf,.epub,.json,.xlsx,.js,.ts,.jsx,.tsx,.css,.md,.py,.java,.go,.rs,.sql,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip';
const MAX = 10 * 1024 * 1024;
const MAX_FILES = 20;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function clipboardFiles(data) {
  const files = [...(data?.files || [])].filter(Boolean);
  const itemFiles = [...(data?.items || [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile?.())
    .filter(Boolean);

  const unique = new Map();
  for (const file of [...files, ...itemFiles]) {
    const key = `${file.name || ''}|${file.size || 0}|${file.type || ''}|${file.lastModified || 0}`;
    if (!unique.has(key)) unique.set(key, file);
  }
  return [...unique.values()];
}

function isImage(file) {
  return String(file?.mime_type || file?.type || '').startsWith('image/');
}

export default function FileAttachments({ value = [], onChange, projectId = null, disabled = false, label = 'Adicionar arquivo', onUploadingChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length) return;
    if (value.length + files.length > MAX_FILES) {
      setError(`Você pode anexar no máximo ${MAX_FILES} arquivos por mensagem.`);
      return;
    }
    setError('');
    setUploading(true);
    try {
      const next = [...value];
      for (const file of files) {
        const name = String(file.name || '').trim();
        if (!name) continue;
        if (file.size > MAX) throw new Error(`${name} excede o limite de 10 MB.`);
        const dataBase64 = await readBase64(file);
        const result = await api.post('/uploads', { name, mimeType: file.type || undefined, dataBase64, projectId });
        if (!result?.upload?.id) throw new Error(`Não foi possível enviar ${name}.`);
        next.push({ ...result.upload, size_bytes: file.size });
      }
      onChange?.(next.filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index));
    } catch (cause) {
      setError(cause.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    const onPaste = (event) => {
      if (disabled || uploading) return;
      const files = clipboardFiles(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files);
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [disabled, uploading, value, projectId]);

  function remove(id) {
    onChange?.(value.filter((item) => item.id !== id));
  }

  return (
    <div className="file-attachments">
      <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
      <div className="file-attachments-row">
        <button type="button" className="attach-trigger" onClick={() => inputRef.current?.click()} disabled={disabled || uploading} aria-label={uploading ? 'Enviando arquivo' : label} title={label}>
          <span aria-hidden="true">+</span>
        </button>
        {uploading && <span className="attachment-uploading">Enviando…</span>}
        {value.map((file) => (
          isImage(file) ? (
            <div className="attachment-image-card" key={file.id}>
              <img src={`/api/uploads/${encodeURIComponent(file.id)}`} alt={file.name || 'Imagem anexada'} />
              <button type="button" onClick={() => remove(file.id)} disabled={disabled} aria-label={`Remover ${file.name || 'imagem'}`}>×</button>
            </div>
          ) : (
            <div className="attachment-chip" key={file.id}>
              <span title={file.name}>{file.name}</span>
              <small>{formatSize(Number(file.size_bytes || 0))}</small>
              <button type="button" onClick={() => remove(file.id)} disabled={disabled} aria-label={`Remover ${file.name}`}>×</button>
            </div>
          )
        ))}
      </div>
      {error && <div className="file-attachments-error" role="alert">{error}</div>}
    </div>
  );
}
