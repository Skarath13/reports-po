import { useCallback, useEffect, useState } from 'react';
import { REPORT_SECTION_KEYS } from '../constants/reportSections';

const MAX_CONTEXTS = 14;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const validHash = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 256;

function pruneContexts(contexts) {
  return Object.fromEntries(
    Object.entries(contexts)
      .filter(
        ([, value]) =>
          Number.isFinite(value?.updatedAt) &&
          value.updatedAt >= Date.now() - RETENTION_MS,
      )
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_CONTEXTS),
  );
}

function loadContexts(storageKey) {
  if (!storageKey) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    const contexts = Object.fromEntries(
      Object.entries(parsed || {}).flatMap(([key, value]) => {
        if (!/^\d{4}-\d{2}-\d{2}\|[a-z-]+$/.test(key) || !value) return [];
        const sections = Object.fromEntries(
          REPORT_SECTION_KEYS.flatMap((section) => {
            const item = value.sections?.[section];
            return validHash(item?.seen) && validHash(item?.latest)
              ? [[section, { seen: item.seen, latest: item.latest }]]
              : [];
          }),
        );
        return [[key, { updatedAt: value.updatedAt, sections }]];
      }),
    );
    return pruneContexts(contexts);
  } catch {
    return {};
  }
}

// Store only opaque server fingerprints, never appointment or note contents.
export function useReportUpdates({ userKey, date, locationId, snapshots }) {
  const storageKey = userKey ? `reports_updates_v1:${userKey}` : null;
  const contextKey = `${date}|${locationId}`;
  const [contexts, setContexts] = useState(() => loadContexts(storageKey));
  const serializedHashes = JSON.stringify(
    Object.fromEntries(
      REPORT_SECTION_KEYS.flatMap((section) => {
        const hash = snapshots?.[section]?.snapshotHash;
        return validHash(hash) ? [[section, hash]] : [];
      }),
    ),
  );

  useEffect(() => {
    const hashes = JSON.parse(serializedHashes);
    if (!Object.keys(hashes).length) return;
    setContexts((current) => {
      const sections = { ...current[contextKey]?.sections };
      let changed = false;
      for (const [section, hash] of Object.entries(hashes)) {
        if (sections[section]?.latest === hash) continue;
        sections[section] = {
          seen: sections[section]?.seen || hash,
          latest: hash,
        };
        changed = true;
      }
      if (!changed) return current;
      return pruneContexts({
        ...current,
        [contextKey]: { updatedAt: Date.now(), sections },
      });
    });
  }, [contextKey, serializedHashes]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(contexts));
    } catch {
      // Updates remain available in memory if local storage is unavailable.
    }
  }, [contexts, storageKey]);

  const markSeen = useCallback(
    (section) => {
      // Only clear a dot when this section has successfully loaded in the current scope.
      if (!JSON.parse(serializedHashes)[section]) return;
      setContexts((current) => {
        const context = current[contextKey];
        const entry = context?.sections[section];
        if (!entry || entry.seen === entry.latest) return current;
        return {
          ...current,
          [contextKey]: {
            updatedAt: Date.now(),
            sections: {
              ...context.sections,
              [section]: { seen: entry.latest, latest: entry.latest },
            },
          },
        };
      });
    },
    [contextKey, serializedHashes],
  );

  const unreadSections = REPORT_SECTION_KEYS.filter((section) => {
    const entry = contexts[contextKey]?.sections[section];
    return entry && entry.seen !== entry.latest;
  });
  return { unreadSections, markSeen };
}
