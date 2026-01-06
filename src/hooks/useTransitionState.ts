import { useRef, useState, useTransition, useEffect, useLayoutEffect, useCallback } from 'react'

export interface UseTransitionStateOptions {
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
 * Custom hook that batches state updates using useTransition to avoid blocking renders
 * 
 * @template T - The type of state
 * @template U - The type of update payload
 * 
 * @param initialData - Initial state data
 * @param updateFn - Function that applies updates to the state. Receives current state and array of updates, returns new state
 * @param options - Configuration options for batching
 * 
 * @returns An object containing:
 *   - state: Current state
 *   - scheduleUpdate: Function to schedule an update (will be batched)
 *   - flushUpdates: Function to manually flush pending updates
 *   - isPending: Whether there are pending transitions
 * 
 * @example
 * ```tsx
 * // Simple array updates
 * const { state, scheduleUpdate } = useTransitionState<DataItem[], DataItem>(
 *   [],
 *   (currentState, updates) => {
 *     return [...currentState, ...updates]
 *   }
 * )
 * 
 * // Complex updates with different types
 * const { state, scheduleUpdate } = useTransitionState<DataItem[], { type: 'PUSH' | 'UPDATE'; item: DataItem }>(
 *   [],
 *   (currentState, updates) => {
 *     let newState = [...currentState]
 *     for (const update of updates) {
 *       if (update.type === 'PUSH') {
 *         newState = [...newState, update.item]
 *       } else if (update.type === 'UPDATE') {
 *         const index = newState.findIndex(item => item.id === update.item.id)
 *         if (index !== -1) {
 *           newState[index] = update.item
 *         }
 *       }
 *     }
 *     return newState
 *   }
 * )
 * ```
 */
export function useTransitionState<T, U = T>(
  initialData: T,
  updateFn: (currentState: T, updates: U[]) => T,
  options: UseTransitionStateOptions = {}
): {
  state: T
  scheduleUpdate: (update: U) => void
  flushUpdates: () => void
  isPending: boolean
} {
  const { maxBatchDelay = 1000, maxBatchSize = 50 } = options

  const [state, setState] = useState<T>(initialData)
  const [isPending, startTransition] = useTransition()

  // Use refs to store pending updates and timeout
  const pendingUpdatesRef = useRef<U[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTransitionRef = useRef(startTransition)
  const updateFnRef = useRef(updateFn)

  // Keep refs up to date using useLayoutEffect (runs synchronously after render)
  useLayoutEffect(() => {
    startTransitionRef.current = startTransition
    updateFnRef.current = updateFn
  })

  const flushUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.length === 0) return

    const updates = pendingUpdatesRef.current
    pendingUpdatesRef.current = []

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    startTransitionRef.current(() => {
      setState((prevState) => {
        return updateFnRef.current(prevState, updates)
      })
    })
  }, [])

  const scheduleUpdate = useCallback(
    (update: U) => {
      pendingUpdatesRef.current.push(update)

      // Flush immediately if batch is too large
      if (pendingUpdatesRef.current.length >= maxBatchSize) {
        flushUpdates()
        return
      }

      // Schedule flush if not already scheduled
      if (timeoutRef.current === null) {
        timeoutRef.current = setTimeout(flushUpdates, maxBatchDelay)
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
    scheduleUpdate,
    flushUpdates,
    isPending,
  }
}

