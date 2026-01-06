import { useRef, useTransition, useEffect, useLayoutEffect, useCallback } from 'react'

export interface UseBatchedCallbackOptions {
  /**
   * Maximum time to wait before flushing batched updates (ms)
   * Default: 1000ms
   */
  maxBatchDelay?: number
}

/**
 * Hook that creates a batched setter function for state updates
 * All updates made through the batched setter are batched together
 * Automatically flushes after maxBatchDelay
 * 
 * @template T - The type of state
 * 
 * @param setState - The original setState function from useState
 * @param options - Configuration options for batching
 * 
 * @returns A batched setter function
 * 
 * @example
 * ```tsx
 * const [items, setItems] = useState<DataItem[]>([])
 * const batchedSetItems = useBatchedCallback(setItems, { 
 *   maxBatchDelay: 1000
 * })
 * 
 * // Use batched setter in callbacks
 * socket.onPush((item) => {
 *   batchedSetItems(prev => [...prev, item])
 * })
 * ```
 */
export function useBatchedCallback<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  options: UseBatchedCallbackOptions = {}
): React.Dispatch<React.SetStateAction<T>> {
  const { maxBatchDelay = 1000 } = options

  const [, startTransition] = useTransition()
  const startTransitionRef = useRef(startTransition)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setStateRef = useRef(setState)
  const pendingUpdatersRef = useRef<Array<React.SetStateAction<T>>>([])

  // Keep refs up to date
  useLayoutEffect(() => {
    startTransitionRef.current = startTransition
  })

  useEffect(() => {
    setStateRef.current = setState
  }, [setState])

  const flushUpdates = useCallback(() => {
    if (pendingUpdatersRef.current.length === 0) return

    const updaters = pendingUpdatersRef.current
    pendingUpdatersRef.current = []

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Apply all pending updates in a single transition
    // Apply all updaters sequentially to the same state value
    startTransitionRef.current(() => {
      setStateRef.current((prevState) => {
        let currentState = prevState
        // Apply all updater functions sequentially
        for (const updater of updaters) {
          if (typeof updater === 'function') {
            currentState = (updater as (prevState: T) => T)(currentState)
          } else {
            currentState = updater
          }
        }
        return currentState
      })
    })
  }, [])

  const batchedSetState = useCallback(
    (updater: React.SetStateAction<T>) => {
      // Store updater function
      pendingUpdatersRef.current.push(updater)

      // Schedule flush after maxBatchDelay
      // Create new timeout if one doesn't exist
      if (timeoutRef.current === null) {
        timeoutRef.current = setTimeout(() => {
          flushUpdates()
        }, maxBatchDelay)
      }
    },
    [maxBatchDelay, flushUpdates]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      // Flush any pending updates on unmount
      flushUpdates()
    }
  }, [flushUpdates])

  return batchedSetState
}

