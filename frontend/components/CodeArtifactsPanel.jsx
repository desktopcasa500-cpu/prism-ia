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
import { extensionForLanguage, languageDisplayName } from '../lib/codeBlocks.js';

const PRISM_LANGUAGE_ALIASES = {
  markup: 'markup', html: 'markup', xml: 'markup', svg: 'markup',
  javascript: 'javascript', jsx: 'jsx', typescript: 'typescript', tsx: 'tsx',
  css: 'css', scss: 'css', python: 'python', json: 'json', bash: 'bash', shell: 'bash',
  yaml: 'yaml', markdown: 'markdown', sql: 'sql', java: 'clike', c: 'clike', cpp: 'clike',
  csharp: 'clike', go: 'clike', rust: 'clike', php: 'clike', ruby: 'clike', swift: 'clike', kotlin: 'clike',
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

function ensureExtension(filename, language) {
  const clean = String(filename || '').trim() || 'snippet';
  return /\.[a-z0-9]{1,8}$/i.test(clean) ? clean : `${clean}.${extensionForLanguage(language)}`;
}

function filenameOf(artifact) {
  return String(artifact?.filename || '').split(/[\\/]/).pop()?.toLowerCase() || '';
}

function isHtmlArtifact(artifact) {
  return artifact?.language === 'markup' || /\.html?$/.test(filenameOf(artifact));
}

function isCssArtifact(artifact) {
  return artifact?.language === 'css' || /\.css$/.test(filenameOf(artifact));
}

function isJsArtifact(artifact) {
  return ['javascript', 'jsx', 'typescript', 'tsx'].includes(artifact?.language) || /\.(?:js|jsx|ts|tsx)$/.test(filenameOf(artifact));
}

function removeLocalAssetReferences(html, files) {
  const names = new Set(files.map((file) => filenameOf(file)).filter(Boolean));
  let result = String(html || '');
  result = result.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi, (tag, href) => {
    const clean = String(href).split(/[?#]/)[0].split('/').pop()?.toLowerCase();
    return names.has(clean) ? '' : tag;
  });
  result = result.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi, (tag, src) => {
    const clean = String(src).split(/[?#]/)[0].split('/').pop()?.toLowerCase();
    return names.has(clean) ? '' : tag;
  });
  return result;
}

function buildPreviewDocument(artifacts) {
  const htmlArtifact = artifacts.find(isHtmlArtifact) || null;
  if (!htmlArtifact) return '';

  const htmlFiles = artifacts.filter(isHtmlArtifact);
  const cssFiles = artifacts.filter(isCssArtifact);
  const jsFiles = artifacts.filter(isJsArtifact);
  let documentText = removeLocalAssetReferences(htmlArtifact.code, [...cssFiles, ...jsFiles]);
  const css = cssFiles.map((file) => `/* ${file.filename} */\n${file.code}`).join('\n\n');
  const js = jsFiles.map((file) => `// ${file.filename}\n${file.code}`).join('\n\n');
  const styleTag = css ? `<style data-prism-artifacts>\n${css}\n</style>` : '';
  const scriptTag = js ? `<script data-prism-artifacts>\n${js}\n<\/script>` : '';
  const headInjection = `${styleTag}${scriptTag ? '' : ''}`;
  const uniqueHtmlFiles = htmlFiles.length > 1 ? `<!-- Prism Preview: ${htmlFiles.length} HTML files generated; previewing ${htmlArtifact.filename}. -->` : '';

  if (/<head\b[^>]*>/i.test(documentText)) documentText = documentText.replace(/<head\b[^>]*>/i, (match) => `${match}${headInjection}`);
  else documentText = `${headInjection}${documentText}`;
  if (scriptTag) {
    if (/<\/body>/i.test(documentText)) documentText = documentText.replace(/<\/body>/i, `${scriptTag}</body>`);
    else documentText += scriptTag;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${uniqueHtmlFiles}${documentText.includes('<html') ? '' : ''}</head>${documentText.replace(/^<!doctype[^>]*>/i, '').replace(/^<html[^>]*>/i, '').replace(/<\/html>\s*$/i, '')}</html>`;
}

export default function CodeArtifactsPanel({ open, artifacts, activeId, onSelect, onClose, onUpdateArtifact }) {
  const active = artifacts.find((item) => item.id === activeId) || artifacts[0] || null;
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState('code');
  const lineCount = useMemo(() => active?.code.split('\n').length || 1, [active?.code]);
  const highlighted = useMemo(() => active ? highlight(active.code, active.language) : '', [active]);
  const previewDocument = useMemo(() => buildPreviewDocument(artifacts), [artifacts]);
  const filename = active?.filename || 'snippet.txt';
  const hasPreview = Boolean(previewDocument);

  useEffect(() => { setCopied(false); }, [activeId]);
  useEffect(() => { if (!hasPreview && view === 'preview') setView('code'); }, [hasPreview, view]);
  if (!open || !active) return null;

  const onCopy = async () => {
    try {
      await copyText(active.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const onDownloadCode = () => downloadBlob(ensureExtension(filename, active.language), active.code);
  const onDownloadMarkdown = () => {
    const language = active.languageLabel || active.language || '';
    const markdown = `# ${filename}\n\n\`\`\`${language}\n${active.code}\n\`\`\`\n`;
    const markdownName = `${filename.replace(/\.[^.]+$/, '') || 'codigo'}.md`;
    downloadBlob(markdownName, markdown, 'text/markdown;charset=utf-8');
  };

  return (
    <section className="code-artifacts-panel" aria-label="Arquivos gerados">
      <header className="code-artifacts-header">
        <div className="code-artifacts-title-wrap">
          <button className="code-artifacts-back" onClick={onClose} aria-label="Fechar arquivos gerados">←</button>
          <div className="code-artifacts-heading">
            <span>ARQUIVOS</span>
            <strong>Arquivos gerados</strong>
          </div>
        </div>
        <button className="code-artifacts-close" onClick={onClose} aria-label="Fechar painel">Fechar</button>
      </header>

      <div className="code-artifacts-file-tabs" role="tablist" aria-label="Arquivos">
        {artifacts.map((artifact) => (
          <button key={artifact.id} role="tab" aria-selected={artifact.id === active.id} className={artifact.id === active.id ? 'active' : ''} onClick={() => onSelect(artifact.id)}>
            <strong>{artifact.filename}</strong>
            <small>{languageDisplayName(artifact.language)}</small>
          </button>
        ))}
      </div>

      <div className="code-artifacts-view-tabs" role="tablist" aria-label="Visualização">
        <button role="tab" aria-selected={view === 'code'} className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}>Código</button>
        <button role="tab" aria-selected={view === 'preview'} className={`${view === 'preview' ? 'active' : ''} ${!hasPreview ? 'disabled' : ''}`} onClick={() => hasPreview && setView('preview')} aria-disabled={!hasPreview}>Preview</button>
      </div>

      {view === 'code' ? (
        <>
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
        </>
      ) : (
        <div className="code-preview-shell">
          {hasPreview ? <iframe title="Preview do projeto" className="code-preview-frame" srcDoc={previewDocument} sandbox="allow-scripts" /> : <div className="code-preview-empty"><strong>Preview indisponível</strong><span>Gere um arquivo HTML para visualizar o projeto.</span></div>}
        </div>
      )}
    </section>
  );
}
