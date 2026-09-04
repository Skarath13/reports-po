import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { REPORT_SECTION_KEYS } from '../constants/reportSections';

function createReviewRequestId() {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `section-review-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function replaceBySection(items, sectionKey, replacement) {
  return [
    ...(items || []).filter((item) => item.sectionKey !== sectionKey),
    replacement,
  ];
}

export function useSectionReviews({
  date,
  locationId,
  snapshots,
  isToday,
  enabled = true,
  onStale,
}) {
  const [data, setData] = useState({ contextKey: '', reviews: [], acknowledgements: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState({});
  const [pendingSections, setPendingSections] = useState(() => new Set());
  const pendingAcknowledgementsRef = useRef(new Set());
  const pendingSectionsRef = useRef(new Set());
  const requestSequenceRef = useRef(0);
  const contextRef = useRef('');
  const contextKey = `${date || ''}|${locationId || ''}`;
  contextRef.current = contextKey;

  const load = useCallback(async () => {
    if (!enabled || !date || !locationId) {
      setData({ contextKey: '', reviews: [], acknowledgements: [] });
      setLoading(false);
      return;
    }

    const sequence = ++requestSequenceRef.current;
    const requestedContext = `${date}|${locationId}`;
    setData({ contextKey: requestedContext, reviews: [], acknowledgements: [] });
    setLoading(true);
    setLoadError(null);
    setSectionErrors({});
    try {
      const response = await api.getSectionReviews(date, locationId);
      if (sequence !== requestSequenceRef.current || contextRef.current !== requestedContext) return;
      setData({
        contextKey: requestedContext,
        reviews: response?.reviews || [],
        acknowledgements: response?.acknowledgements || [],
      });
    } catch (error) {
      if (sequence !== requestSequenceRef.current || contextRef.current !== requestedContext) return;
      setLoadError(error.message || 'Section review status is unavailable.');
      setData({ contextKey: requestedContext, reviews: [], acknowledgements: [] });
    } finally {
      if (sequence === requestSequenceRef.current && contextRef.current === requestedContext) {
        setLoading(false);
      }
    }
  }, [date, enabled, locationId]);

  useEffect(() => {
    pendingAcknowledgementsRef.current.clear();
    pendingSectionsRef.current.clear();
    setPendingSections(new Set());
    load();
  }, [load]);

  const sectionStates = useMemo(() => {
    const contextualData = data.contextKey === contextKey
      ? data
      : { reviews: [], acknowledgements: [] };
    const reviews = new Map((contextualData.reviews || []).map((review) => [review.sectionKey, review]));
    const acknowledgements = new Map((contextualData.acknowledgements || []).map((acknowledgement) => [
      `${acknowledgement.sectionKey}:${acknowledgement.entryKey}`,
      acknowledgement,
    ]));

    return Object.fromEntries(REPORT_SECTION_KEYS.map((sectionKey) => {
      const snapshot = snapshots?.[sectionKey] || null;
      const review = reviews.get(sectionKey) || null;
      const baseline = new Map((review?.entries || []).map((entry) => [entry.entryKey, entry.contentVersion]));
      const current = new Map((snapshot?.entries || []).map((entry) => [entry.entryKey, entry.contentVersion]));
      const changedEntries = new Set();
      const unseenEntries = new Set();

      if (review && snapshot) {
        for (const entry of snapshot.entries || []) {
          if (baseline.get(entry.entryKey) === entry.contentVersion) continue;
          changedEntries.add(entry.entryKey);
          const acknowledgement = acknowledgements.get(`${sectionKey}:${entry.entryKey}`);
          if (acknowledgement?.contentVersion !== entry.contentVersion) {
            unseenEntries.add(entry.entryKey);
          }
        }
      }

      let removedCount = 0;
      if (review && snapshot) {
        for (const entryKey of baseline.keys()) {
          if (!current.has(entryKey)) removedCount += 1;
        }
      }

      return [sectionKey, {
        sectionKey,
        snapshot,
        review,
        ready: Boolean(snapshot?.snapshotHash && Array.isArray(snapshot?.entries)),
        signedOff: Boolean(review),
        changedCount: changedEntries.size + removedCount,
        unseenCount: unseenEntries.size,
        removedCount,
        changedEntries,
        unseenEntries,
        loading: pendingSections.has(sectionKey),
        error: sectionErrors[sectionKey] || null,
      }];
    }));
  }, [contextKey, data, pendingSections, sectionErrors, snapshots]);

  const signOffSection = useCallback(async (sectionKey) => {
    const requestedContext = contextRef.current;
    const snapshot = snapshots?.[sectionKey];
    if (!isToday || !snapshot?.snapshotHash || pendingSectionsRef.current.has(sectionKey)) return;

    pendingSectionsRef.current.add(sectionKey);
    setPendingSections((current) => new Set(current).add(sectionKey));
    setSectionErrors((current) => ({ ...current, [sectionKey]: null }));
    try {
      const response = await api.submitSectionSignoff({
        date,
        locationId,
        sectionKey,
        snapshotHash: snapshot.snapshotHash,
        requestId: createReviewRequestId(),
      });
      if (contextRef.current !== requestedContext) return;
      setData((current) => ({
        ...current,
        reviews: replaceBySection(current.reviews, sectionKey, response.review),
        acknowledgements: (current.acknowledgements || [])
          .filter((acknowledgement) => acknowledgement.sectionKey !== sectionKey),
      }));
    } catch (error) {
      if (contextRef.current !== requestedContext) return;
      setSectionErrors((current) => ({
        ...current,
        [sectionKey]: error.message || 'Unable to sign off this section.',
      }));
      if (error.code === 'REPORT_CHANGED' || error.code === 'SECTION_SNAPSHOT_NOT_OBSERVED') {
        onStale?.();
      }
    } finally {
      pendingSectionsRef.current.delete(sectionKey);
      if (contextRef.current === requestedContext) {
        setPendingSections((current) => {
          const next = new Set(current);
          next.delete(sectionKey);
          return next;
        });
      }
    }
  }, [date, isToday, locationId, onStale, snapshots]);

  const acknowledgeEntry = useCallback(async (sectionKey, entry) => {
    const requestedContext = contextRef.current;
    const snapshot = snapshots?.[sectionKey];
    const reviewState = sectionStates[sectionKey];
    const pendingKey = `${requestedContext}:${sectionKey}:${entry?.entryKey}:${entry?.contentVersion}`;
    if (
      !isToday ||
      !snapshot?.snapshotHash ||
      !reviewState?.unseenEntries.has(entry?.entryKey) ||
      pendingAcknowledgementsRef.current.has(pendingKey)
    ) return;

    pendingAcknowledgementsRef.current.add(pendingKey);
    const optimisticAcknowledgement = {
      sectionKey,
      entryKey: entry.entryKey,
      contentVersion: entry.contentVersion,
      observedSnapshotHash: snapshot.snapshotHash,
      acknowledgedAtUtc: new Date().toISOString(),
      optimistic: true,
    };
    setData((current) => ({
      ...current,
      acknowledgements: replaceBySectionEntry(
        current.acknowledgements,
        optimisticAcknowledgement
      ),
    }));
    setSectionErrors((current) => ({ ...current, [sectionKey]: null }));

    try {
      const response = await api.acknowledgeSectionEntry({
        date,
        locationId,
        sectionKey,
        snapshotHash: snapshot.snapshotHash,
        entryKey: entry.entryKey,
        contentVersion: entry.contentVersion,
      });
      if (contextRef.current !== requestedContext) return;
      if (response.acknowledgement) {
        setData((current) => ({
          ...current,
          acknowledgements: replaceBySectionEntry(
            current.acknowledgements,
            response.acknowledgement
          ),
        }));
      } else if (!response.acknowledged) {
        removeOptimisticAcknowledgement(setData, optimisticAcknowledgement);
      }
    } catch (error) {
      if (contextRef.current !== requestedContext) return;
      removeOptimisticAcknowledgement(setData, optimisticAcknowledgement);
      setSectionErrors((current) => ({
        ...current,
        [sectionKey]: error.message || 'Unable to mark this update seen.',
      }));
      if (error.code === 'REPORT_CHANGED' || error.code === 'ENTRY_CHANGED') {
        onStale?.();
      }
    } finally {
      pendingAcknowledgementsRef.current.delete(pendingKey);
    }
  }, [date, isToday, locationId, onStale, sectionStates, snapshots]);

  return {
    sectionStates,
    signOffSection,
    acknowledgeEntry,
    loading,
    loadError,
    reload: load,
  };
}

function replaceBySectionEntry(items, replacement) {
  return [
    ...(items || []).filter((item) => !(
      item.sectionKey === replacement.sectionKey && item.entryKey === replacement.entryKey
    )),
    replacement,
  ];
}

function removeOptimisticAcknowledgement(setData, acknowledgement) {
  setData((current) => ({
    ...current,
    acknowledgements: (current.acknowledgements || []).filter((item) => !(
      item.sectionKey === acknowledgement.sectionKey &&
      item.entryKey === acknowledgement.entryKey &&
      item.contentVersion === acknowledgement.contentVersion &&
      item.optimistic
    )),
  }));
}

export const _private = {
  createReviewRequestId,
  replaceBySection,
  replaceBySectionEntry,
};
