'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadAll,
  putBucket,
  deleteBucket as dbDeleteBucket,
  putSnippet,
  deleteSnippet as dbDeleteSnippet,
  setActiveBucketId as dbSetActiveBucketId,
  setBucketOrder as dbSetBucketOrder,
  getStorageEstimate,
  requestPersistence,
  newId,
  now,
  SNIPPET_RETENTION_MS,
  MAX_BUCKETS,
  type Bucket,
  type Snippet,
  type StorageEstimate,
} from '@/lib/snippetStore';

export type { Bucket, Snippet, StorageEstimate };
export { MAX_BUCKETS };

const DEFAULT_BUCKET_NAME = 'Bucket 1';

export interface UseSnippets {
  ready: boolean;
  buckets: Bucket[];
  snippets: Snippet[];
  snippetsByBucket: (bucketId: string) => Snippet[];
  activeBucketId: string | null;
  activeBucket: Bucket | null;
  storageEstimate: StorageEstimate | null;
  setActiveBucket: (bucketId: string) => void;
  addBucket: (name?: string) => string | null;
  removeBucket: (bucketId: string) => void;
  renameBucket: (bucketId: string, name: string) => void;
  addSnippet: (text: string, bucketId?: string) => void;
  removeSnippet: (snippetId: string) => void;
  moveBucket: (bucketId: string, direction: 'up' | 'down') => void;
}

export function useSnippets(): UseSnippets {
  const [ready, setReady] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [activeBucketId, setActiveBucketIdState] = useState<string | null>(null);
  const [storageEstimate, setStorageEstimate] = useState<StorageEstimate | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      await requestPersistence();
      const data = await loadAll();
      if (!mounted.current) return;

      let { buckets: loadedBuckets } = data;
      let active = data.activeBucketId;

      // Seed a default bucket on first run so auto-save always has a target.
      if (loadedBuckets.length === 0) {
        const seed: Bucket = { id: newId(), name: DEFAULT_BUCKET_NAME, createdAt: now() };
        await putBucket(seed);
        loadedBuckets = [seed];
        active = seed.id;
        await dbSetActiveBucketId(seed.id);
      }

      // Ensure the active bucket still exists; otherwise fall back to the first.
      if (!active || !loadedBuckets.some((b) => b.id === active)) {
        active = loadedBuckets[0]?.id ?? null;
        await dbSetActiveBucketId(active);
      }

      setBuckets(loadedBuckets);
      setSnippets(data.snippets);
      setActiveBucketIdState(active);
      setReady(true);

      // Initial storage estimate
      const est = await getStorageEstimate(data.snippets);
      if (mounted.current) setStorageEstimate(est);
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  const snippetsByBucket = useCallback(
    (bucketId: string) => snippets.filter((s) => s.bucketId === bucketId),
    [snippets],
  );

  const setActiveBucket = useCallback((bucketId: string) => {
    setActiveBucketIdState(bucketId);
    void dbSetActiveBucketId(bucketId);
  }, []);

  const addBucket = useCallback(
    (name?: string): string | null => {
      let createdId: string | null = null;
      setBuckets((prev) => {
        if (prev.length >= MAX_BUCKETS) return prev;
        const trimmed = (name ?? '').trim();
        const bucket: Bucket = {
          id: newId(),
          name: trimmed || `Bucket ${prev.length + 1}`,
          createdAt: now(),
        };
        createdId = bucket.id;
        void putBucket(bucket);
        const next = [...prev, bucket];
        void dbSetBucketOrder(next.map((b) => b.id));
        return next;
      });
      return createdId;
    },
    [],
  );

  const removeBucket = useCallback(
    (bucketId: string) => {
      void dbDeleteBucket(bucketId);
      setSnippets((prev) => prev.filter((s) => s.bucketId !== bucketId));
      setBuckets((prev) => {
        const next = prev.filter((b) => b.id !== bucketId);
        void dbSetBucketOrder(next.map((b) => b.id));
        // If we removed the active bucket, move the selection to the first
        // remaining bucket (or null if none remain).
        setActiveBucketIdState((curActive) => {
          if (curActive !== bucketId) return curActive;
          const fallback = next[0]?.id ?? null;
          void dbSetActiveBucketId(fallback);
          return fallback;
        });
        return next;
      });
    },
    [],
  );

  const renameBucket = useCallback((bucketId: string, name: string) => {
    setBuckets((prev) =>
      prev.map((b) => {
        if (b.id !== bucketId) return b;
        const updated = { ...b, name: name.trim() || b.name };
        void putBucket(updated);
        return updated;
      }),
    );
  }, []);

  const refreshStorage = useCallback((snips: Snippet[]) => {
    void getStorageEstimate(snips).then((est) => {
      if (mounted.current) setStorageEstimate(est);
    });
  }, []);

  const addSnippet = useCallback(
    (text: string, bucketId?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const target = bucketId ?? activeBucketId;
      if (!target) return;

      setSnippets((prev) => {
        // Dedup: skip if identical text already exists in this bucket
        if (prev.some((s) => s.bucketId === target && s.text === trimmed)) return prev;

        const created = now();
        const snippet: Snippet = {
          id: newId(),
          bucketId: target,
          text: trimmed,
          createdAt: created,
          expiresAt: created + SNIPPET_RETENTION_MS,
        };
        void putSnippet(snippet);
        const next = [snippet, ...prev];
        refreshStorage(next);
        return next;
      });
    },
    [activeBucketId, refreshStorage],
  );

  const moveBucket = useCallback((bucketId: string, direction: 'up' | 'down') => {
    setBuckets((prev) => {
      const idx = prev.findIndex((b) => b.id === bucketId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      void dbSetBucketOrder(next.map((b) => b.id));
      return next;
    });
  }, []);

  const removeSnippet = useCallback((snippetId: string) => {
    void dbDeleteSnippet(snippetId);
    setSnippets((prev) => {
      const next = prev.filter((s) => s.id !== snippetId);
      refreshStorage(next);
      return next;
    });
  }, [refreshStorage]);

  const activeBucket = useMemo(
    () => buckets.find((b) => b.id === activeBucketId) ?? null,
    [buckets, activeBucketId],
  );

  return {
    ready,
    buckets,
    snippets,
    snippetsByBucket,
    activeBucketId,
    activeBucket,
    storageEstimate,
    setActiveBucket,
    addBucket,
    removeBucket,
    renameBucket,
    addSnippet,
    removeSnippet,
    moveBucket,
  };
}
