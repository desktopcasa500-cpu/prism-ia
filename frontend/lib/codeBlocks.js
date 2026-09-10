const LANGUAGE_ALIASES = {
  js: 'javascript', javascript: 'javascript', mjs: 'javascript', cjs: 'javascript',
  jsx: 'jsx', ts: 'typescript', typescript: 'typescript', tsx: 'tsx',
  html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup',
  css: 'css', scss: 'css', sass: 'css', less: 'css',
  py: 'python', python: 'python',
  json: 'json', jsonc: 'json',
  sh: 'bash', shell: 'bash', bash: 'bash', zsh: 'bash',
  yml: 'yaml', yaml: 'yaml',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql', java: 'java', c: 'c', cpp: 'cpp', cxx: 'cpp',
  cs: 'csharp', csharp: 'csharp', go: 'go', rust: 'rust', rs: 'rust',
  php: 'php', ruby: 'ruby', rb: 'ruby', swift: 'swift', kotlin: 'kotlin', kt: 'kotlin',
  plaintext: 'text', text: 'text', txt: 'text',
};

const LANGUAGE_EXTENSIONS = {
  javascript: 'js', jsx: 'jsx', typescript: 'ts', tsx: 'tsx',
  markup: 'html', css: 'css', python: 'py', json: 'json', bash: 'sh',
  yaml: 'yml', markdown: 'md', sql: 'sql', java: 'java', c: 'c', cpp: 'cpp',
  csharp: 'cs', go: 'go', rust: 'rs', php: 'php', ruby: 'rb', swift: 'swift',
  kotlin: 'kt', text: 'txt',
};

function normalizeLanguage(value = '') {
  const raw = String(value).trim().toLowerCase().replace(/^language-/, '');
  return LANGUAGE_ALIASES[raw] || raw || 'text';
}

function inferLanguageFromFilename(filename = '') {
  const extension = String(filename).split('.').pop()?.toLowerCase();
  if (!extension) return 'text';
  return normalizeLanguage(extension);
}

function parseInfo(info = '') {
  const tokens = String(info).trim().split(/\s+/).filter(Boolean);
  const languageToken = tokens[0] || '';
  const language = normalizeLanguage(languageToken);
  const fileMatch = String(info).match(/(?:^|\s)(?:file|filename|path)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\S+))/i);
  let filename = fileMatch ? (fileMatch[1] || fileMatch[2] || fileMatch[3]) : '';

  if (!filename) {
    const candidate = tokens.slice(1).find((token) => /\.[a-z0-9]{1,8}$/i.test(token));
    filename = candidate ? candidate.replace(/^['"]|['"]$/g, '') : '';
  }

  return {
    language: language === 'text' && filename ? inferLanguageFromFilename(filename) : language,
    filename,
  };
}

function defaultFilename(language, index) {
  const extension = LANGUAGE_EXTENSIONS[language] || 'txt';
  const stem = language === 'markup' ? 'index' : 'snippet';
  return `${stem}-${index + 1}.${extension}`;
}

function findClosingFence(lines, startIndex, marker, minimumLength) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(`{3,}|~{3,})\s*$/);
    if (!match) continue;
    const candidate = match[1];
    if (candidate[0] === marker && candidate.length >= minimumLength) return index;
  }
  return -1;
}

export function extractCodeBlocks(content = '', messageId = 'message') {
  const source = String(content ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const blocks = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const opening = lines[cursor].match(/^\s*(`{3,}|~{3,})([^`]*)$/);
    if (!opening) {
      cursor += 1;
      continue;
    }

    const marker = opening[1][0];
    const markerLength = opening[1].length;
    const info = opening[2].trim();
    const closingIndex = findClosingFence(lines, cursor + 1, marker, markerLength);
    const end = closingIndex === -1 ? lines.length : closingIndex;
    const code = lines.slice(cursor + 1, end).join('\n');
    const metadata = parseInfo(info);
    const index = blocks.length;
    const id = `${messageId}:code:${index}`;

    blocks.push({
      id,
      messageId,
      index,
      language: metadata.language,
      languageLabel: info.split(/\s+/)[0] || metadata.language,
      filename: metadata.filename || defaultFilename(metadata.language, index),
      code,
      info,
    });

    cursor = closingIndex === -1 ? lines.length : closingIndex + 1;
  }

  return blocks;
}

export function splitMessageContent(content = '', messageId = 'message') {
  const source = String(content ?? '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');
  const parts = [];
  let textStart = 0;
  let cursor = 0;
  let codeIndex = 0;

  const pushText = (end) => {
    const value = lines.slice(textStart, end).join('\n');
    if (value.trim()) parts.push({ type: 'text', value });
  };

  while (cursor < lines.length) {
    const opening = lines[cursor].match(/^\s*(`{3,}|~{3,})([^`]*)$/);
    if (!opening) {
      cursor += 1;
      continue;
    }

    pushText(cursor);
    const marker = opening[1][0];
    const markerLength = opening[1].length;
    const info = opening[2].trim();
    const closingIndex = findClosingFence(lines, cursor + 1, marker, markerLength);
    const end = closingIndex === -1 ? lines.length : closingIndex;
    const code = lines.slice(cursor + 1, end).join('\n');
    const metadata = parseInfo(info);
    const index = codeIndex;
    const id = `${messageId}:code:${index}`;

    parts.push({
      type: 'code',
      block: {
        id,
        messageId,
        index,
        language: metadata.language,
        languageLabel: info.split(/\s+/)[0] || metadata.language,
        filename: metadata.filename || defaultFilename(metadata.language, index),
        code,
        info,
      },
    });

    codeIndex += 1;
    cursor = closingIndex === -1 ? lines.length : closingIndex + 1;
    textStart = cursor;
  }

  pushText(lines.length);
  return parts;
}

export function extensionForLanguage(language) {
  return LANGUAGE_EXTENSIONS[normalizeLanguage(language)] || 'txt';
}

export function languageDisplayName(language) {
  const normalized = normalizeLanguage(language);
  const names = {
    javascript: 'JavaScript', jsx: 'JSX', typescript: 'TypeScript', tsx: 'TSX', markup: 'HTML',
    css: 'CSS', python: 'Python', json: 'JSON', bash: 'Shell', yaml: 'YAML', markdown: 'Markdown',
    sql: 'SQL', java: 'Java', cpp: 'C++', csharp: 'C#', go: 'Go', rust: 'Rust', php: 'PHP',
    ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin', text: 'Texto',
  };
  return names[normalized] || String(language || 'Texto').toUpperCase();
}
