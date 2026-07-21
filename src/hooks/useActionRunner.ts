import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';

export interface RunOptions {
  /** Toast shown on success. Omit for silent success. */
  success?: string;
  /** Per-call `code → message` overrides layered over the central registry. */
  errorOverrides?: Record<string, string>;
  /** Suppress the automatic error toast (caller handles it). */
  silentError?: boolean;
  onError?: (err: unknown) => void;
}

/**
 * Standard mutation runner: one in-flight action key, a success toast, and
 * centralized error → toast mapping. Domain action hooks build on this so every
 * write follows the same loading/toast/error contract.
 */
export function useActionRunner() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const run = useCallback(
    async <T>(key: string, action: () => Promise<T>, opts: RunOptions = {}): Promise<T | null> => {
      setPendingKey(key);
      try {
        const result = await action();
        if (opts.success) toast.success(opts.success);
        return result;
      } catch (err) {
        if (!opts.silentError) toast.error(getApiErrorMessage(err, opts.errorOverrides));
        opts.onError?.(err);
        return null;
      } finally {
        setPendingKey(null);
      }
    },
    [],
  );

  return {
    pendingKey,
    run,
    isPending: useCallback((key: string) => pendingKey === key, [pendingKey]),
    isBusy: pendingKey !== null,
  };
}
