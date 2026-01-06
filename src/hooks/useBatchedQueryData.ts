  import { useCallback, useRef, useEffect } from 'react'
  import { useTransition } from 'react'
  // Note: In real app, import from @tanstack/react-query
  // For demo, we use a compatible interface
  export interface InfiniteData<TData> {
    pages: TData[]
    pageParams: unknown[]
  }

  export interface QueryClient {
    setQueryData<TData>(
      queryKey: unknown[],
      updater: ((oldData: TData | undefined) => TData | undefined) | TData
    ): TData | undefined
  }

  export interface UseBatchedQueryDataOptions {
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

  type QueryDataUpdater<TData> = (oldData: InfiniteData<TData> | undefined) => InfiniteData<TData> | undefined

  /**
   * Hook that batches queryClient.setQueryData calls for infinite queries
   * Useful when receiving rapid updates (e.g., from websocket) that need to update the cache
   * 
   * @template TData - The type of data in each page
   * 
   * @param queryClient - React Query QueryClient instance
   * @param queryKey - Query key for the infinite query
   * @param options - Configuration options for batching
   * 
   * @returns Function to batch setQueryData calls
   * 
   * @example
   * ```tsx
   * const queryClient = useQueryClient()
   * const batchedSetQueryData = useBatchedQueryData(
   *   queryClient,
   *   ['messages'],
   *   { maxBatchDelay: 500, maxBatchSize: 20 }
   * )
   * 
   * // Instead of calling queryClient.setQueryData directly:
   * // queryClient.setQueryData(['messages'], updater)
   * 
   * // Use batched version:
   * batchedSetQueryData(updater)
   * ```
   */
  export function useBatchedQueryData<TData>(
    queryClient: QueryClient,
    queryKey: unknown[],
    options: UseBatchedQueryDataOptions = {}
  ) {
    const { maxBatchDelay = 1000, maxBatchSize = 50 } = options
    const [, startTransition] = useTransition()

    // Store pending updaters
    const pendingUpdatersRef = useRef<QueryDataUpdater<TData>[]>([])
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const startTransitionRef = useRef(startTransition)
    const queryClientRef = useRef(queryClient)
    const queryKeyRef = useRef(queryKey)

    // Keep refs up to date
    useEffect(() => {
      startTransitionRef.current = startTransition
      queryClientRef.current = queryClient
      queryKeyRef.current = queryKey
    }, [startTransition, queryClient, queryKey])

    const flushUpdates = useCallback(() => {
      if (pendingUpdatersRef.current.length === 0) return

      const updaters = pendingUpdatersRef.current
      pendingUpdatersRef.current = []

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Apply all pending updates in a single setQueryData call
      startTransitionRef.current(() => {
        queryClientRef.current.setQueryData<InfiniteData<TData>>(
          queryKeyRef.current,
          (oldData) => {
            let currentData = oldData
            // Apply all updater functions sequentially
            for (const updater of updaters) {
              const result = updater(currentData)
              // Ensure we always return a valid value (fallback to oldData if updater returns undefined)
              currentData = result ?? currentData ?? {
                pages: [],
                pageParams: [],
              } as InfiniteData<TData>
            }
            return currentData
          }
        )
      })
    }, [])

    const batchedSetQueryData = useCallback(
      (updater: QueryDataUpdater<TData>) => {
        // Store updater function
        pendingUpdatersRef.current.push(updater)

        // Flush immediately if batch is too large
        if (pendingUpdatersRef.current.length >= maxBatchSize) {
          flushUpdates()
          return
        }

        // Schedule flush after maxBatchDelay
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

    return batchedSetQueryData
  }

