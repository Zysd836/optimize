import { useRef, useState, useTransition, useEffect, useLayoutEffect, useCallback } from 'react'

export interface UseBatchedUpdatesOptions {
  /**
   * Maximum time to wait before flushing batched updates (ms)
   * Default: 1000ms
   */
  maxBatchDelay?: number
  /**
   * Maximum number of updates to batch before forcing a flush
   * Default: 50
   */
  maxBatchSize?: number
}

/**
 * Hook that debounces/batches state updates using useTransition
 * Update logic is handled externally through updater function
 * Automatically flushes after maxBatchDelay to ensure UI rerenders
 * 
 * @template T - The type of state
 * 
 * @param initialState - Initial state value
 * @param options - Configuration options for batching
 * 
 * @returns An object containing:
 *   - state: Current state (debounced)
 *   - setState: Function to update state (update logic handled externally)
 *   - flushUpdates: Function to manually flush pending updates
 *   - isPending: Whether there are pending transitions
 * 
 * @example
 * ```tsx
 * // Only pass initial state
 * const { state, setState } = useBatchedState<DataItem[]>([])
 * 
 * // Update logic handled externally
 * setState(prev => {
 *   // Your logic here
 *   return [...prev, newItem]
 * })
 * 
 * // Hook will automatically batch and flush after maxBatchDelay to rerender
 * ```
 */
export function useBatchedState<T>(
  initialState: T,
  options: UseBatchedUpdatesOptions = {}
): {
  state: T
  setState: (updater: (prevState: T) => T) => void
  flushUpdates: () => void
  isPending: boolean
} {
  const { maxBatchDelay = 1000, maxBatchSize = 50 } = options

  const [state, setState] = useState<T>(initialState)
  const [isPending, startTransition] = useTransition()

  // Use refs to store pending updaters and timeout
  const pendingUpdatersRef = useRef<Array<(prevState: T) => T>>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTransitionRef = useRef(startTransition)

  // Keep refs up to date using useLayoutEffect (runs synchronously after render)
  useLayoutEffect(() => {
    startTransitionRef.current = startTransition
  })

  const flushUpdates = useCallback(() => {
    if (pendingUpdatersRef.current.length === 0) return

    const updaters = pendingUpdatersRef.current
    pendingUpdatersRef.current = []

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Apply all pending updates and force rerender
    startTransitionRef.current(() => {
      setState((prevState) => {
        let newState = prevState
        // Apply all updater functions from outside
        for (const updater of updaters) {
          newState = updater(newState)
        }
        return newState
      })
    })
  }, [])

  const batchedSetState = useCallback(
    (updater: (prevState: T) => T) => {
      // Store updater function from outside
      pendingUpdatersRef.current.push(updater)

      // Flush immediately if batch is too large
      if (pendingUpdatersRef.current.length >= maxBatchSize) {
        flushUpdates()
        return
      }

      // Schedule flush after maxBatchDelay to ensure rerender
      // Create new timeout if one doesn't exist
      if (timeoutRef.current === null) {
        timeoutRef.current = setTimeout(() => {
          flushUpdates()
        }, maxBatchDelay)
      }
    },
    [maxBatchSize, maxBatchDelay, flushUpdates]
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

  return {
    state,
    setState: batchedSetState,
    flushUpdates,
    isPending,
  }
}

