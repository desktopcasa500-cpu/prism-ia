import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import './file-attachments.css';

const ACCEPT = '.pdf,.docx,.csv,.txt,.html,.odt,.rtf,.epub,.json,.xlsx,.js,.ts,.jsx,.tsx,.css,.md,.py,.java,.go,.rs,.sql,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip';
const MIME_BY_EXT = {
  pdf: 'application/pdf', zip: 'application/zip', js: 'text/javascript', ts: 'text/plain', jsx: 'text/plain', tsx: 'text/plain',
  html: 'text/html', css: 'text/css', json: 'application/json', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  py: 'text/x-python', java: 'text/x-java-source', go: 'text/plain', rs: 'text/plain', sql: 'application/sql',
};
const MAX = 10 * 1024 * 1024;
const MAX_FILES = 20;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function extension(name) {
  return String(name || '').split('.').pop()?.toLowerCase() || '';
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
  const files = [];
  const seen = new Set();
  for (const file of [...(data?.files || [])]) {
    if (file && file.size >= 0) {
      const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
      if (!seen.has(key)) { seen.add(key); files.push(file); }
    }
  }
  for (const item of [...(data?.items || [])]) {
    if (item?.kind !== 'file') continue;
    const file = item.getAsFile?.();
    if (!file) continue;
    const key = `${file.name}:${file.size}:${file.lastModified}:${file.type}`;
    if (!seen.has(key)) { seen.add(key); files.push(file); }
  }
  return files;
}

function isImage(file) {
  return String(file?.mime_type || file?.type || '').startsWith('image/');
}

export default function FileAttachments({ value = [], onChange, projectId = null, disabled = false, label = 'Adicionar arquivo', onUploadingChange }) {
  const inputRef = useRef(null);
  const objectUrlsRef = useRef(new Map());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onUploadingChange?.(uploading);
    return () => { onUploadingChange?.(false); };
  }, [uploading, onUploadingChange]);

  useEffect(() => () => {
    for (const url of objectUrlsRef.current.values()) URL.revokeObjectURL(url);
    objectUrlsRef.current.clear();
  }, []);

  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length || disabled || uploading) return;
    setError('');
    if (value.length + files.length > MAX_FILES) {
      setError(`Você pode anexar no máximo ${MAX_FILES} arquivos por mensagem.`);
      return;
    }
    setUploading(true);
    try {
      const next = [...value];
      for (const file of files) {
        const name = String(file.name || '').trim();
        if (!name) continue;
        if (file.size > MAX) throw new Error(`${name} excede o limite de 10 MB.`);
        const ext = extension(name);
        if (!MIME_BY_EXT[ext]) throw new Error(`${name}: tipo de arquivo não suportado.`);
        const dataBase64 = await readBase64(file);
        const mimeType = MIME_BY_EXT[ext];
        const result = await api.post('/uploads', { name, mimeType, dataBase64, projectId });
        if (!result?.upload?.id) throw new Error(`Não foi possível enviar ${name}.`);
        const upload = { ...result.upload, size_bytes: file.size, mime_type: result.upload.mime_type || mimeType };
        if (isImage(file)) {
          const old = objectUrlsRef.current.get(upload.id);
          if (old) URL.revokeObjectURL(old);
          objectUrlsRef.current.set(upload.id, URL.createObjectURL(file));
          upload.previewUrl = objectUrlsRef.current.get(upload.id);
        }
        next.push(upload);
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
    window.addEventListener('paste', onPaste, true);
    return () => window.removeEventListener('paste', onPaste, true);
  }, [disabled, uploading, value, projectId]);

  function remove(id) {
    const previewUrl = objectUrlsRef.current.get(id);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      objectUrlsRef.current.delete(id);
    }
    onChange?.(value.filter((item) => item.id !== id));
  }

  return (
    <div className="file-attachments">
      <input ref={inputRef} type="file" multiple accept={ACCEPT} hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} />
      <div className="file-attachments-row">
        <button type="button" className="attach-trigger" onClick={() => inputRef.current?.click()} disabled={disabled || uploading} aria-label={uploading ? 'Enviando arquivo' : label} title={uploading ? 'Enviando…' : label}>
          <span aria-hidden="true">+</span>
        </button>
        {value.map((file) => (
          isImage(file) ? (
            <div className="attachment-image-card" key={file.id}>
              {file.previewUrl ? <img src={file.previewUrl} alt={file.name || 'Imagem anexada'} /> : <div className="attachment-image-fallback">Imagem</div>}
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
      {uploading && <div className="attachment-uploading">Enviando…</div>}
      {error && <div className="file-attachments-error" role="alert">{error}</div>}
    </div>
  );
}
