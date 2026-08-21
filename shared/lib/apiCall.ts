/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";

type AnyFn = (...args: any[]) => any;

type ExtractData<F extends AnyFn> =
  Awaited<ReturnType<F>> extends {
    data: infer D;
  }
    ? D
    : unknown;

type ExtractError<F extends AnyFn> =
  Awaited<ReturnType<F>> extends {
    error: infer E;
  }
    ? E
    : unknown;

export function useApiCall<F extends AnyFn>(
  fetcher: F,
  options: Parameters<F>[0],
): {
  data: ExtractData<F> | null;
  loading: boolean;
  error: ExtractError<F> | Error | null;
} {
  const [data, setData] = useState<ExtractData<F> | null>(null);
  const [error, setError] = useState<ExtractError<F> | Error | null>(null);
  const [loading, setLoading] = useState(true);

  const optionsKey = useMemo(() => JSON.stringify(options ?? {}), [options]);

  useEffect(() => {
    let mounted = true;
    const controller =
      typeof AbortController !== "undefined"
        ? new AbortController()
        : undefined;

    setLoading(true);
    setError(null);

    const withSignal =
      controller && options && typeof options === "object"
        ? { ...options, signal: controller.signal }
        : options;

    Promise.resolve(fetcher(withSignal))
      .then((result: any) => {
        if (!mounted) return;
        if (result?.error) {
          setError(result.error);
          setData(null);
        } else {
          setData(result?.data as ExtractData<F>);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setData(null);
        setError(err);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
      controller?.abort();
    };
  }, [fetcher, optionsKey]);

  return { data, loading, error };
}
