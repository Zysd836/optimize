import { useRef, useTransition, useEffect, useLayoutEffect, useCallback, useState } from 'react'

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
 * Hook that batches state updates using useTransition
 * Pattern similar to useDebounceValue - only receives state and options
 * Returns batched state and batched setter function
 * Update logic is handled externally through updater function
 * Automatically flushes after maxBatchDelay to ensure UI rerenders
 * 
 * @template T - The type of state
 * 
 * @param value - State value (passed from outside, similar to useDebounceValue)
 * @param options - Configuration options for batching
 * 
 * @returns Object containing:
 *   - value: Batched state value
 *   - setValue: Function to update state (update logic handled externally)
 * 
 * @example
 * ```tsx
 * // State managed externally
 * const [items, setItems] = useState<DataItem[]>([])
 * 
 * // Hook only receives state from outside, similar to useDebounceValue
 * const { value: batchedItems, setValue: setBatchedItems } = useBatchedUpdates(items, {
 *   maxBatchDelay: 5000,
 *   maxBatchSize: 50
 * })
 * 
 * // Update logic handled externally
 * setBatchedItems(prev => {
 *   return [...prev, newItem]
 * })
 * ```
 */
export function useBatchedUpdates<T>(
  value: T,
  options: UseBatchedUpdatesOptions = {}
): {
  value: T
  setValue: (updater: (prevState: T) => T) => void
} {
  const { maxBatchDelay = 1000, maxBatchSize = 50 } = options

  const [batchedValue, setBatchedValue] = useState<T>(value)
  const [, startTransition] = useTransition()

  // Use refs to store pending updaters and timeout
  const pendingUpdatersRef = useRef<Array<(prevState: T) => T>>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTransitionRef = useRef(startTransition)
  const valueRef = useRef(value)

  // Sync with external value when value changes (similar to useDebounceValue)
  // Use timeout to debounce sync, avoid calling setState in effect
  useEffect(() => {
    valueRef.current = value
    
    // Only sync if there are no pending updates
    if (pendingUpdatersRef.current.length === 0) {
      const id = setTimeout(() => {
        if (pendingUpdatersRef.current.length === 0) {
          setBatchedValue(valueRef.current)
        }
      }, 0)
      
      return () => clearTimeout(id)
    }
  }, [value])

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
      setBatchedValue((prevState) => {
        let newState = prevState
        // Apply all updater functions from outside
        for (const updater of updaters) {
          newState = updater(newState)
        }
        return newState
      })
    })
  }, [])

  const batchedSetValue = useCallback(
    (updater: (prevState: T) => T) => {
      // Store updater function from outside
      pendingUpdatersRef.current.push(updater)

      // Clear existing timeout if it exists
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Flush if batch is too large, but defer to avoid calling startTransition during render
      if (pendingUpdatersRef.current.length >= maxBatchSize) {
        timeoutRef.current = setTimeout(() => {
          flushUpdates()
        }, 0)
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
    value: batchedValue,
    setValue: batchedSetValue,
  }
}

