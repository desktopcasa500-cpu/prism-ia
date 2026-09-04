import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'prism-codex';
const STORE = 'sessions';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function cacheSession(sessionId, messages) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ sessionId, messages, savedAt: Date.now() }, sessionId);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

async function readCachedSession(sessionId) {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(sessionId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
  db.close();
  return value?.messages || null;
}

export function usePersistentCodex(preferenceKey = 'prism_codex_preferences') {
  const [preferences, setPreferences] = useState(() => {
    try { return JSON.parse(localStorage.getItem(preferenceKey) || '{}'); } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
  }, [preferenceKey, preferences]);

  const updatePreference = useCallback((key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  }, []);

  const cachedSession = useCallback((sessionId) => readCachedSession(sessionId), []);

  return { preferences, updatePreference, cacheSession, cachedSession };
}
