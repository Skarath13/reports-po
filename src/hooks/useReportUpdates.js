import { useCallback, useEffect, useMemo, useState } from 'react';
import { REPORT_SECTION_KEYS } from '../constants/reportSections';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const validHash = (value) =>
  typeof value === 'string' && /^[\w-]{1,256}$/.test(value);
const versions = (entries) =>
  Object.fromEntries(
    (entries || [])
      .filter(
        (entry) => validHash(entry.entryKey) && validHash(entry.contentVersion),
      )
      .map((entry) => [entry.entryKey, entry.contentVersion]),
  );
const cleanHashes = (items) =>
  Object.fromEntries(
    Object.entries(items || {}).filter(
      ([key, value]) => validHash(key) && validHash(value),
    ),
  );

function pruneContexts(contexts) {
  return Object.fromEntries(
    Object.entries(contexts)
      .filter(
        ([, value]) =>
          Number.isFinite(value?.updatedAt) &&
          value.updatedAt >= Date.now() - RETENTION_MS,
      )
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, 14),
  );
}

function loadContexts(storageKey) {
  try {
    if (!storageKey) return {};
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    return pruneContexts(
      Object.fromEntries(
        Object.entries(parsed || {}).flatMap(([key, value]) => {
          if (!/^\d{4}-\d{2}-\d{2}\|[a-z-]+$/.test(key) || !value) return [];
          const sections = Object.fromEntries(
            REPORT_SECTION_KEYS.flatMap((section) => {
              const item = value.sections?.[section];
              if (!validHash(item?.hash)) return [];
              const entries = Object.fromEntries(
                Object.entries(item.entries || {}).flatMap(
                  ([entryKey, entry]) =>
                    validHash(entryKey) && validHash(entry?.version)
                      ? [
                          [
                            entryKey,
                            {
                              version: entry.version,
                              seen: validHash(entry.seen) ? entry.seen : null,
                              unread: entry.unread === true,
                            },
                          ],
                        ]
                      : [],
                ),
              );
              return [
                [
                  section,
                  {
                    hash: item.hash,
                    entries,
                    removed: cleanHashes(item.removed),
                    removedSeen: cleanHashes(item.removedSeen),
                  },
                ],
              ];
            }),
          );
          return [[key, { updatedAt: value.updatedAt, sections }]];
        }),
      ),
    );
  } catch {
    return {};
  }
}

// Only opaque server identities/versions are persisted, scoped to viewer, date and location.
// Downloading a snapshot establishes what exists; it never records an item as viewed.
export function useReportUpdates({
  userKey,
  date,
  locationId,
  snapshots,
  reviewStates = {},
  isToday = true,
}) {
  const storageKey = userKey ? `reports_updates_v2:${userKey}` : null;
  const contextKey = `${date}|${locationId}`;
  const [store, setStore] = useState(() => ({
    key: storageKey,
    contexts: loadContexts(storageKey),
  }));
  const contexts = useMemo(
    () => (store.key === storageKey ? store.contexts : {}),
    [store, storageKey],
  );
  const setContexts = useCallback(
    (update) => {
      setStore((current) => {
        const previous =
          current.key === storageKey
            ? current.contexts
            : loadContexts(storageKey);
        const next = update(previous);
        return current.key === storageKey && next === previous
          ? current
          : { key: storageKey, contexts: next };
      });
    },
    [storageKey],
  );
  const serialized = JSON.stringify(
    Object.fromEntries(
      REPORT_SECTION_KEYS.flatMap((section) => {
        const snapshot = snapshots?.[section];
        return validHash(snapshot?.snapshotHash) &&
          Array.isArray(snapshot.entries)
          ? [
              [
                section,
                {
                  hash: snapshot.snapshotHash,
                  entries: versions(snapshot.entries),
                },
              ],
            ]
          : [];
      }),
    ),
  );
  const currentSnapshots = useMemo(() => JSON.parse(serialized), [serialized]);
  const serializedReviews = JSON.stringify(
    Object.fromEntries(
      REPORT_SECTION_KEYS.flatMap((section) => {
        const state = reviewStates[section];
        return isToday && state?.signedOff && state.ready
          ? [[section, [...state.unseenEntries]]]
          : [];
      }),
    ),
  );
  const reviewedUpdates = useMemo(
    () => JSON.parse(serializedReviews),
    [serializedReviews],
  );

  useEffect(() => {
    setContexts((current) => {
      const sections = { ...current[contextKey]?.sections };
      let changed = false;
      for (const [section, snapshot] of Object.entries(currentSnapshots)) {
        const previous = sections[section];
        const authoritativeUnread =
          reviewedUpdates[section] && new Set(reviewedUpdates[section]);
        if (
          previous?.hash === snapshot.hash &&
          (!authoritativeUnread ||
            Object.entries(previous.entries).every(
              ([key, entry]) => entry.unread === authoritativeUnread.has(key),
            ))
        )
          continue;
        const entries = Object.fromEntries(
          Object.entries(snapshot.entries).map(([key, version]) => {
            const old = previous?.entries[key];
            return [
              key,
              {
                version,
                seen: old?.seen || null,
                unread: authoritativeUnread
                  ? authoritativeUnread.has(key)
                  : old?.version === version
                    ? old.unread
                    : Boolean(previous && old?.seen !== version),
              },
            ];
          }),
        );
        const removed = { ...previous?.removed };
        const removedSeen = { ...previous?.removedSeen };
        for (const [key, entry] of Object.entries(previous?.entries || {})) {
          if (!entries[key]) removed[key] = entry.version;
        }
        for (const key of Object.keys(entries)) {
          delete removed[key];
          delete removedSeen[key];
        }
        sections[section] = {
          hash: snapshot.hash,
          entries,
          removed,
          removedSeen,
        };
        changed = true;
      }
      return changed
        ? pruneContexts({
            ...current,
            [contextKey]: { updatedAt: Date.now(), sections },
          })
        : current;
    });
  }, [contextKey, currentSnapshots, reviewedUpdates, setContexts]);

  useEffect(() => {
    if (!storageKey || store.key !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(contexts));
    } catch {
      // Tracking still works for this session if browser storage is unavailable.
    }
  }, [contexts, storageKey, store.key]);

  const sectionStates = Object.fromEntries(
    REPORT_SECTION_KEYS.map((section) => {
      const state = reviewStates[section] || {};
      const local = contexts[contextKey]?.sections[section];
      const useReview = isToday && state.signedOff;
      const unseenEntries =
        useReview && state.ready
          ? state.unseenEntries
          : new Set(
              Object.entries(local?.entries || {})
                .filter(([, item]) => item.unread)
                .map(([key]) => key),
            );
      const currentVersions = state.snapshot
        ? versions(state.snapshot.entries)
        : Object.fromEntries(
            Object.entries(local?.entries || {}).map(([key, entry]) => [
              key,
              entry.version,
            ]),
          );
      const removed = useReview
        ? Object.fromEntries(
            Object.entries(versions(state.review?.entries)).filter(
              ([key]) => !currentVersions[key],
            ),
          )
        : local?.removed || {};
      const unseenRemoved = Object.fromEntries(
        Object.entries(removed).filter(
          ([key, version]) => local?.removedSeen?.[key] !== version,
        ),
      );
      return [
        section,
        {
          ...state,
          unseenEntries,
          unseenCount: unseenEntries?.size || 0,
          unseenRemoved,
          unseenRemovedCount: Object.keys(unseenRemoved).length,
        },
      ];
    }),
  );

  const markEntrySeen = useCallback(
    (section, entry) => {
      if (
        !entry ||
        currentSnapshots[section]?.entries[entry.entryKey] !==
          entry.contentVersion
      )
        return;
      setContexts((current) => {
        const context = current[contextKey];
        const saved = context?.sections[section];
        const item = saved?.entries[entry.entryKey];
        if (
          !item ||
          item.version !== entry.contentVersion ||
          (item.seen === item.version && !item.unread)
        )
          return current;
        return {
          ...current,
          [contextKey]: {
            updatedAt: Date.now(),
            sections: {
              ...context.sections,
              [section]: {
                ...saved,
                entries: {
                  ...saved.entries,
                  [entry.entryKey]: {
                    ...item,
                    seen: item.version,
                    unread: false,
                  },
                },
              },
            },
          },
        };
      });
    },
    [contextKey, currentSnapshots, setContexts],
  );

  const markRemovedSeen = (section) => {
    if (!currentSnapshots[section]) return;
    const removed = sectionStates[section]?.unseenRemoved;
    setContexts((current) => {
      const context = current[contextKey];
      const saved = context?.sections[section];
      if (!saved || !Object.keys(removed || {}).length) return current;
      return {
        ...current,
        [contextKey]: {
          updatedAt: Date.now(),
          sections: {
            ...context.sections,
            [section]: {
              ...saved,
              removedSeen: { ...saved.removedSeen, ...removed },
            },
          },
        },
      };
    });
  };

  const unreadSections = REPORT_SECTION_KEYS.filter(
    (section) =>
      sectionStates[section].unseenCount +
        sectionStates[section].unseenRemovedCount >
      0,
  );
  return { unreadSections, sectionStates, markEntrySeen, markRemovedSeen };
}
