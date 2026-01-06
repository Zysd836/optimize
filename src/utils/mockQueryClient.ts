/**
 * Mock QueryClient for demo purposes
 * Simulates react-query's QueryClient.setQueryData behavior
 */
export class MockQueryClient {
  private cache: Map<string, unknown> = new Map()
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map()
  private renderCount: number = 0

  /**
   * Set query data in cache (similar to react-query's setQueryData)
   */
  setQueryData<TData>(
    queryKey: unknown[],
    updater: ((oldData: TData | undefined) => TData | undefined) | TData
  ): TData | undefined {
    const key = JSON.stringify(queryKey)
    
    const oldData = this.cache.get(key) as TData | undefined
    const newData = typeof updater === 'function' 
      ? (updater as (oldData: TData | undefined) => TData | undefined)(oldData)
      : updater

    // Only update cache if newData is not undefined
    if (newData !== undefined) {
      this.cache.set(key, newData)
      this.renderCount++

      // Notify listeners (simulating react-query's re-render mechanism)
      const listeners = this.listeners.get(key)
      if (listeners) {
        listeners.forEach((listener) => {
          listener(newData)
        })
      }
    }

    return newData
  }

  /**
   * Get query data from cache
   */
  getQueryData<TData>(queryKey: unknown[]): TData | undefined {
    const key = JSON.stringify(queryKey)
    return this.cache.get(key) as TData | undefined
  }

  /**
   * Subscribe to query data changes (for demo purposes)
   */
  subscribe(queryKey: unknown[], listener: (data: unknown) => void): () => void {
    const key = JSON.stringify(queryKey)
    
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    
    this.listeners.get(key)!.add(listener)

    // Immediately call with current data
    const currentData = this.cache.get(key)
    if (currentData !== undefined) {
      listener(currentData)
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          this.listeners.delete(key)
        }
      }
    }
  }

  /**
   * Get render count (for demo purposes to show batching effectiveness)
   */
  getRenderCount(): number {
    return this.renderCount
  }

  /**
   * Reset render count
   */
  resetRenderCount(): void {
    this.renderCount = 0
  }
}

