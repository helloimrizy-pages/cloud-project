import { useState, useEffect, useCallback, useRef } from 'react';

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

  const execute = useCallback(() => {
    cancelRef.current?.();
    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    if (data === null) setLoading(true);
    setError(null);

    fetcher()
      .then(d => { if (!cancelled) setData(d); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    execute();
    return () => { cancelRef.current?.(); };
  }, [execute]);

  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(execute, pollInterval);
    return () => clearInterval(id);
  }, [execute, pollInterval]);

  return { data, loading, error, refetch: execute };
}
