import { useCallback, useEffect, useState } from 'react'
import { ApiError, isAbort, toApiError } from './api'

export type AsyncState<T> =
  | { status: 'idle'; data?: undefined; error?: undefined }
  | { status: 'loading'; data?: T; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: ApiError }

/** Runs an abortable async fn whenever deps change. Pass null to stay idle. Keeps old data while reloading. */
export function useAsync<T>(
  fn: ((signal: AbortSignal) => Promise<T>) | null,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'idle' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!fn) {
      setState({ status: 'idle' })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ status: 'loading', data: s.data }))
    fn(ctrl.signal).then(
      (data) => {
        if (!ctrl.signal.aborted) setState({ status: 'ready', data })
      },
      (e) => {
        if (ctrl.signal.aborted || isAbort(e)) return
        setState({ status: 'error', error: toApiError(e) })
      },
    )
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
