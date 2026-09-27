import { createHash } from 'node:crypto';

function readKey(name) {
  return String(process.env[name] || '').trim();
}

function keyEntries() {
  return [
    { slot: 'groq-1', key: readKey('GROQ_API_KEY_1') || readKey('GROQ_API_KEY') },
    { slot: 'groq-2', key: readKey('GROQ_API_KEY_2') },
  ];
}

function bucketFor(identity) {
  const digest = createHash('sha256').update(String(identity || 'anonymous')).digest();
  return digest[0] % 2;
}

export function getGroqKeyCandidates(identity) {
  const entries = keyEntries();
  const order = bucketFor(identity) === 0 ? [0, 1] : [1, 0];
  return order.map((index) => entries[index]).filter((entry) => entry.key);
}

export function isGroqConfigured() {
  return keyEntries().some((entry) => Boolean(entry.key));
}

export function hasBothGroqKeys() {
  const entries = keyEntries();
  return Boolean(entries[0].key && entries[1].key);
}

export function groqConfiguration() {
  const entries = keyEntries();
  return {
    key1: Boolean(entries[0].key),
    key2: Boolean(entries[1].key),
    both: Boolean(entries[0].key && entries[1].key),
  };
}
