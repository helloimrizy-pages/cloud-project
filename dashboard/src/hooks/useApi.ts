import { useState, useEffect, useCallback, useRef } from 'react';

export const POLL_INTERVAL = 15_000;

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  pollInterval?: number,
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const initialLoadDone = useRef(false);
  const inFlight = useRef(false);

  const execute = useCallback(() => {
    if (inFlight.current) return;
    cancelRef.current?.();
    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    if (!initialLoadDone.current) setLoading(true);
    setError(null);
    inFlight.current = true;

    fetcher()
      .then(d => { if (!cancelled) { setData(d); initialLoadDone.current = true; } })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { inFlight.current = false; if (!cancelled) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
    return () => { cancelRef.current?.(); };
  }, [execute]);

  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(() => {
      if (!document.hidden) execute();
    }, pollInterval);
    return () => clearInterval(id);
  }, [execute, pollInterval]);

  return { data, loading, error, refetch: execute };
}
