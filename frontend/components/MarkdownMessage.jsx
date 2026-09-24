import { Fragment, useMemo, useState } from 'react';
import { extractCodeBlocks } from '../lib/codeBlocks.js';
import PrismIcon from './PrismIcon.jsx';

function inlineMarkdown(value, keyPrefix = 'inline') {
  const text = String(value || '');
  const pattern = /(\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*]+\*|_[^_]+_)/g;
  return text.split(pattern).map((part, index) => {
    if (!part) return null;
    if (/^`[^`]+`$/.test(part)) return <code key={keyPrefix + '-code-' + index}>{part.slice(1, -1)}</code>;
    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) return <strong key={keyPrefix + '-strong-' + index}>{part.slice(2, -2)}</strong>;
    if (/^~~[^~]+~~$/.test(part)) return <del key={keyPrefix + '-del-' + index}>{part.slice(2, -2)}</del>;
    if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) return <em key={keyPrefix + '-em-' + index}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^(https?:\/\/|mailto:)/i.test(link[2])) {
      return <a key={keyPrefix + '-link-' + index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    }
    return <Fragment key={keyPrefix + '-text-' + index}>{part}</Fragment>;
  });
}

function splitTableRow(line) {
  return String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line) {
  const cells = splitTableRow(line);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function CodeBlock({ block, onOpenCode }) {
  const [copied, setCopied] = useState(false);
  const code = String(block?.code || '');

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <figure className="prism-markdown-code">
      <figcaption className="prism-markdown-code__bar">
        <span>
          <strong>{block?.filename || 'codigo.txt'}</strong>
          <small>{block?.languageLabel || block?.language || 'texto'} · {code.split('\n').length} {code.split('\n').length === 1 ? 'linha' : 'linhas'}</small>
        </span>
        <span className="prism-markdown-code__actions">
          {onOpenCode && <button type="button" onClick={() => onOpenCode(block.id, block)}>Ver código</button>}
          <button type="button" onClick={copyCode} aria-label="Copiar código">
            {copied ? 'Copiado' : <><PrismIcon name="copy" size={12} />Copiar</>}
          </button>
        </span>
      </figcaption>
      <pre><code>{code}</code></pre>
    </figure>
  );
}

function renderTextLines(lines, keyPrefix) {
  const nodes = [];
  let index = 0;

  while (index < lines.length) {
    const trimmed = String(lines[index] || '').trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = Math.min(4, Math.max(2, heading[1].length));
      const Tag = 'h' + level;
      nodes.push(<Tag key={keyPrefix + '-h-' + index}>{inlineMarkdown(heading[2], keyPrefix + '-h-' + index)}</Tag>);
      index += 1;
      continue;
    }

    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
      nodes.push(<hr key={keyPrefix + '-hr-' + index} />);
      index += 1;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote = [];
      const start = index;
      while (index < lines.length && String(lines[index] || '').trim().startsWith('>')) {
        quote.push(String(lines[index]).trim().replace(/^>\s?/, ''));
        index += 1;
      }
      nodes.push(
        <blockquote key={keyPrefix + '-quote-' + start}>
          {quote.map((item, itemIndex) => <p key={itemIndex}>{inlineMarkdown(item, keyPrefix + '-quote-' + start + '-' + itemIndex)}</p>)}
        </blockquote>,
      );
      continue;
    }

    const unordered = [];
    const unorderedStart = index;
    while (index < lines.length) {
      const match = String(lines[index] || '').trim().match(/^[-*+]\s+(.+)$/);
      if (!match) break;
      unordered.push(match[1]);
      index += 1;
    }
    if (unordered.length) {
      nodes.push(
        <ul key={keyPrefix + '-ul-' + unorderedStart}>
          {unordered.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, keyPrefix + '-ul-' + unorderedStart + '-' + itemIndex)}</li>)}
        </ul>,
      );
      continue;
    }

    const ordered = [];
    const orderedStart = index;
    while (index < lines.length) {
      const match = String(lines[index] || '').trim().match(/^\d+[.)]\s+(.+)$/);
      if (!match) break;
      ordered.push(match[1]);
      index += 1;
    }
    if (ordered.length) {
      nodes.push(
        <ol key={keyPrefix + '-ol-' + orderedStart}>
          {ordered.map((item, itemIndex) => <li key={itemIndex}>{inlineMarkdown(item, keyPrefix + '-ol-' + orderedStart + '-' + itemIndex)}</li>)}
        </ol>,
      );
      continue;
    }

    if (index + 1 < lines.length && String(lines[index]).includes('|') && isTableDivider(lines[index + 1])) {
      const header = splitTableRow(lines[index]);
      const rows = [];
      index += 2;
      while (index < lines.length && String(lines[index] || '').trim() && String(lines[index]).includes('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      nodes.push(
        <div className="prism-markdown-table-wrap" key={keyPrefix + '-table-' + index}>
          <table>
            <thead>
              <tr>{header.map((cell, cellIndex) => <th key={cellIndex}>{inlineMarkdown(cell, keyPrefix + '-th-' + cellIndex)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((_, cellIndex) => <td key={cellIndex}>{inlineMarkdown(row[cellIndex] || '', keyPrefix + '-td-' + rowIndex + '-' + cellIndex)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraph = [trimmed];
    const paragraphStart = index;
    index += 1;
    while (index < lines.length) {
      const next = String(lines[index] || '').trim();
      if (
        !next ||
        /^#{1,6}\s+/.test(next) ||
        next.startsWith('>') ||
        /^[-*+]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next)
      ) break;
      paragraph.push(next);
      index += 1;
    }

    nodes.push(
      <p key={keyPrefix + '-p-' + paragraphStart}>
        {paragraph.map((item, itemIndex) => (
          <Fragment key={itemIndex}>
            {inlineMarkdown(item, keyPrefix + '-p-' + paragraphStart + '-' + itemIndex)}
            {itemIndex < paragraph.length - 1 ? ' ' : ''}
          </Fragment>
        ))}
      </p>,
    );
  }

  return nodes;
}

export default function MarkdownMessage({ content = '', messageId = 'message', onOpenCode }) {
  const source = String(content ?? '').replace(/\r\n?/g, '\n');

  const blocks = useMemo(() => {
    const lines = source.split('\n');
    const output = [];
    let textLines = [];

    const flushText = () => {
      if (!textLines.length) return;
      output.push({ type: 'markdown', lines: textLines });
      textLines = [];
    };

    for (let index = 0; index < lines.length; index += 1) {
      const opening = lines[index].match(/^\s*(?:\x60{3,}|~{3,})\s*(.*)$/);
      if (!opening) {
        textLines.push(lines[index]);
        continue;
      }

      flushText();
      const marker = lines[index].trim().startsWith('~~~') ? '~' : '\x60';
      const markerRegex = marker === '~' ? /^\s*~{3,}\s*$/ : /^\s*\x60{3,}\s*$/;
      const markerLength = lines[index].trim().startsWith('~~~')
        ? lines[index].trim().match(/^~{3,}/)[0].length
        : lines[index].trim().match(/^\x60{3,}/)[0].length;
      let end = -1;

      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (markerRegex.test(lines[cursor])) {
          end = cursor;
          break;
        }
      }

      const code = lines.slice(index + 1, end === -1 ? lines.length : end).join('\n');
      const languageInfo = opening[1].trim();
      const fence = marker === '~' ? '~'.repeat(markerLength) : '\x60'.repeat(markerLength);
      const parsed = extractCodeBlocks(
        fence + languageInfo + '\n' + code + '\n' + fence,
        messageId + '-' + index,
      )[0];

      output.push({
        type: 'code',
        block: parsed || {
          id: messageId + ':' + index,
          filename: languageInfo ? 'codigo.' + languageInfo.split(/\s+/)[0].toLowerCase() : 'codigo.txt',
          language: languageInfo || 'text',
          languageLabel: languageInfo || 'text',
          code,
        },
      });

      index = end === -1 ? lines.length : end;
    }

    flushText();
    return output;
  }, [source, messageId]);

  return (
    <div className="markdown-message">
      {blocks.map((block, index) => (
        block.type === 'code'
          ? <CodeBlock key={'code-' + index} block={block.block} onOpenCode={onOpenCode} />
          : <Fragment key={'md-' + index}>{renderTextLines(block.lines, messageId + '-' + index)}</Fragment>
      ))}
    </div>
  );
}
