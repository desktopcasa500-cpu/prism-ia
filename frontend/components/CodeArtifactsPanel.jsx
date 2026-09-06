import { useEffect, useMemo, useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-clike.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markdown.js';
import 'prismjs/components/prism-sql.js';
import { languageDisplayName } from '../lib/codeBlocks.js';

const PRISM_LANGUAGE_ALIASES = {
  markup: 'markup', html: 'markup', xml: 'markup', svg: 'markup',
  javascript: 'javascript', jsx: 'jsx', typescript: 'typescript', tsx: 'tsx',
  css: 'css', scss: 'css', python: 'python', json: 'json', bash: 'bash', shell: 'bash',
  yaml: 'yaml', markdown: 'markdown', sql: 'sql', java: 'java', c: 'clike', cpp: 'clike',
  csharp: 'csharp', go: 'go', rust: 'rust', php: 'php', ruby: 'ruby', swift: 'swift', kotlin: 'kotlin',
  text: 'plain',
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function highlight(code, language) {
  const grammarName = PRISM_LANGUAGE_ALIASES[language] || language;
  const grammar = grammarName && Prism.languages[grammarName];
  if (!grammar) return escapeHtml(code);
  try { return Prism.highlight(code, grammar, grammarName); } catch { return escapeHtml(code); }
}

function downloadBlob(filename, body, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

export default function CodeArtifactsPanel({ open, artifacts, activeId, onSelect, onClose, onUpdateArtifact }) {
  const active = artifacts.find((item) => item.id === activeId) || artifacts[0] || null;
  const [copied, setCopied] = useState(false);
  const lineCount = useMemo(() => active?.code.split('\n').length || 1, [active?.code]);
  const highlighted = useMemo(() => active ? highlight(active.code, active.language) : '', [active]);
  const filename = active?.filename || 'snippet.txt';

  useEffect(() => { setCopied(false); }, [activeId]);
  if (!open || !active) return null;

  const onCopy = async () => {
    try {
      await copyText(active.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const onDownloadCode = () => downloadBlob(filename, active.code);
  const onDownloadMarkdown = () => {
    const language = active.languageLabel || active.language || '';
    const markdown = `# ${filename}\n\n\`\`\`${language}\n${active.code}\n\`\`\`\n`;
    const markdownName = `${filename.replace(/\.[^.]+$/, '') || 'codigo'}.md`;
    downloadBlob(markdownName, markdown, 'text/markdown;charset=utf-8');
  };

  return (
    <section className="code-artifacts-panel" aria-label="Código gerado">
      <header className="code-artifacts-header">
        <div className="code-artifacts-title-wrap">
          <button className="code-artifacts-back" onClick={onClose} aria-label="Voltar ao chat">←</button>
          <div className="code-artifacts-heading">
            <span>CÓDIGO</span>
            <strong>Arquivos gerados</strong>
          </div>
        </div>
        <button className="code-artifacts-close" onClick={onClose} aria-label="Fechar painel">Fechar</button>
      </header>

      <div className="code-artifacts-tabs" role="tablist" aria-label="Arquivos de código">
        {artifacts.map((artifact) => (
          <button key={artifact.id} role="tab" aria-selected={artifact.id === active.id} className={artifact.id === active.id ? 'active' : ''} onClick={() => onSelect(artifact.id)}>
            <strong>{artifact.filename}</strong><small>{languageDisplayName(artifact.language)}</small>
          </button>
        ))}
      </div>

      <div className="code-artifact-toolbar">
        <div className="code-artifact-file">
          <input value={active.filename} onChange={(event) => onUpdateArtifact(active.id, { filename: event.target.value })} aria-label="Nome do arquivo" spellCheck="false" />
        </div>
        <div className="code-artifact-actions">
          <button onClick={onCopy} title="Copiar código">{copied ? 'Copiado' : 'Copiar'}</button>
          <button onClick={onDownloadCode} title="Baixar código">Baixar</button>
          <button onClick={onDownloadMarkdown} title="Baixar Markdown">Markdown</button>
        </div>
      </div>

      <div className="code-viewer" role="region" aria-label={`Código ${filename}`}>
        <div className="code-gutter" aria-hidden="true">{Array.from({ length: lineCount }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        <pre><code dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
      </div>
    </section>
  );
}
