import { Fragment, useMemo } from 'react';
import { extractCodeBlocks } from '../lib/codeBlocks.js';

function inlineMarkdown(value) {
  const parts = String(value || '').split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (/^`[^`]+`$/.test(part)) return <code key={index}>{part.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export default function MarkdownMessage({ content = '', messageId = 'message', onOpenCode }) {
  const source = String(content ?? '').replace(/\r\n?/g, '\n');
  const blocks = useMemo(() => {
    const lines = source.split('\n');
    const output = [];
    let text = [];
    const flush = () => {
      if (!text.length) return;
      output.push({ type: 'markdown', value: text.join('\n') });
      text = [];
    };
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const opening = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
      if (!opening) {
        text.push(line);
        continue;
      }
      flush();
      const marker = opening[1][0];
      const markerLength = opening[1].length;
      let end = -1;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const closing = lines[cursor].match(/^\s*(`{3,}|~{3,})\s*$/);
        if (closing && closing[1][0] === marker && closing[1].length >= markerLength) { end = cursor; break; }
      }
      const code = lines.slice(index + 1, end === -1 ? lines.length : end).join('\n');
      const info = opening[2].trim();
      const parsed = extractCodeBlocks(`${opening[1]}${info ? info : ''}\n${code}\n${marker.repeat(markerLength)}`, `${messageId}-${index}`)[0];
      output.push({ type: 'code', block: parsed || { id: `${messageId}:${index}`, filename: 'codigo.txt', language: 'text', languageLabel: 'text', code } });
      index = end === -1 ? lines.length : end;
    }
    flush();
    return output;
  }, [source, messageId]);

  return <div className="markdown-message">
    {blocks.map((block, index) => {
      if (block.type === 'code') {
        return <button key={`code-${index}`} type="button" className="codex-code-card" onClick={() => onOpenCode?.(block.block.id, block.block)}>
          <span className="codex-code-card-main"><strong>{block.block.filename}</strong><small>{block.block.languageLabel || block.block.language} · {String(block.block.code || '').split('\n').length} {String(block.block.code || '').split('\n').length === 1 ? 'linha' : 'linhas'}</small></span>
          <span>Ver código</span>
        </button>;
      }
      const lines = block.value.split('\n');
      const nodes = [];
      let listItems = [];
      const flushList = () => {
        if (!listItems.length) return;
        nodes.push(<ul key={`list-${nodes.length}`}>{listItems.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item)}</li>)}</ul>);
        listItems = [];
      };
      lines.forEach((line, lineIndex) => {
        const trimmed = line.trim();
        const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
        const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
        const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (bullet) { listItems.push(bullet[1]); return; }
        if (ordered) { listItems.push(ordered[1]); return; }
        flushList();
        if (heading) { nodes.push(<h3 key={`h-${lineIndex}`}>{inlineMarkdown(heading[2])}</h3>); return; }
        if (!trimmed) { nodes.push(<br key={`br-${lineIndex}`} />); return; }
        nodes.push(<p key={`p-${lineIndex}`}>{inlineMarkdown(trimmed)}</p>);
      });
      flushList();
      return <Fragment key={`md-${index}`}>{nodes}</Fragment>;
    })}
  </div>;
}
