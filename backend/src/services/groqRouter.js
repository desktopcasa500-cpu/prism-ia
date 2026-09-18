import { createHash } from 'node:crypto';

const getKey1 = () => process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY || '';
const getKey2 = () => process.env.GROQ_API_KEY_2 || '';

function bucketFor(identity) {
  const value = String(identity || '');
  const digest = createHash('sha256').update(value).digest();
  return digest[0] % 2;
}

export function getGroqKeyCandidates(identity) {
  const entries = [
    { slot: 'groq-1', key: getKey1() },
    { slot: 'groq-2', key: getKey2() },
  ];

  const order = bucketFor(identity) === 0 ? [0, 1] : [1, 0];
  return order.map((index) => entries[index]).filter((entry) => Boolean(entry.key));
}

export function isGroqConfigured() {
  return Boolean(getKey1() || getKey2());
}

export function hasBothGroqKeys() {
  return Boolean(getKey1() && getKey2());
}
