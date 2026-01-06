import { useRef, useCallback, useEffect } from "react";

export interface UseBatchUpdatesOptions<T> {
  /** Delay in milliseconds before flushing the batch (default: 150ms) */
  delay?: number;
  /** Maximum delay in milliseconds before forcing a flush (default: 500ms) */
  /** This ensures data is updated even if socket keeps sending updates continuously */
  maxDelay?: number;
  /** Maximum batch size before forcing a flush (default: 50) */
  /** This prevents memory issues with very large batches */
  maxBatchSize?: number;
  /** Callback to process the batched items */
  onFlush: (batch: T[]) => void;
  /** Whether batching is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Hook to batch multiple updates together with debouncing
 * 
 * Useful for optimizing frequent updates (e.g., WebSocket events, rapid state changes)
 * by grouping them into batches and processing them together.
 * 
 * Features:
 * - Debounce: Waits for delay ms before flushing (default: 150ms)
 * - Maximum delay: Forces flush after maxDelay ms to ensure real-time updates (default: 500ms)
 * - Maximum batch size: Forces flush when batch reaches maxBatchSize items (default: 50)
 * 
 * This ensures:
 * 1. Optimized batching when updates are frequent
 * 2. Real-time updates even if socket keeps sending continuously
 * 3. Memory safety by limiting batch size
 * 
 * @example
 * ```tsx
 * const { addToBatch } = useBatchUpdates({
 *   delay: 150,
 *   maxDelay: 500,  // Force flush after 500ms even if updates continue
 *   maxBatchSize: 50,  // Force flush when batch reaches 50 items
 *   onFlush: (items) => {
 *     // Process all items at once
 *     updateCache(items);
 *   },
 * });
 * 
 * // Add items to batch
 * addToBatch(newItem);
 * ```
 */
export const useBatchedUpdates = <T>({
  delay = 150,
  maxDelay = 500,
  maxBatchSize = 50,
  onFlush,
  enabled = true,
}: UseBatchUpdatesOptions<T>) => {
  const batchQueueRef = useRef<T[]>([]);
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxDelayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchStartTimeRef = useRef<number | null>(null);

  // Flush the current batch
  const flushBatch = useCallback(() => {
    if (!enabled) return;
    
    const batch = batchQueueRef.current;
    if (batch.length === 0) return;

    // Clear queue immediately to prevent duplicate processing
    batchQueueRef.current = [];
    
    // Reset batch start time
    batchStartTimeRef.current = null;

    // Clear all timeouts
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
    if (maxDelayTimeoutRef.current) {
      clearTimeout(maxDelayTimeoutRef.current);
      maxDelayTimeoutRef.current = null;
    }

    // Process the batch
    onFlush(batch);
  }, [enabled, onFlush]);

  // Schedule batch flush with debounce
  const scheduleBatchFlush = useCallback(() => {
    if (!enabled) return;
    
    // Clear existing debounce timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    
    // Schedule normal debounce flush
    batchTimeoutRef.current = setTimeout(() => {
      flushBatch();
    }, delay);
    
    // Schedule maximum delay flush if not already scheduled
    // This ensures data is updated even if socket keeps sending updates continuously
    if (!maxDelayTimeoutRef.current && batchStartTimeRef.current !== null) {
      const elapsed = Date.now() - batchStartTimeRef.current;
      const remainingDelay = Math.max(0, maxDelay - elapsed);
      
      if (remainingDelay > 0) {
        maxDelayTimeoutRef.current = setTimeout(() => {
          // Check if batch still has items before flushing
          if (batchQueueRef.current.length > 0) {
            flushBatch();
          } else {
            maxDelayTimeoutRef.current = null;
          }
        }, remainingDelay);
      } else {
        // If maxDelay has already passed, flush immediately
        flushBatch();
      }
    }
  }, [enabled, delay, maxDelay, flushBatch]);

  // Add item to batch queue
  const addToBatch = useCallback(
    (item: T) => {
      if (!enabled) {
        // If disabled, process immediately
        onFlush([item]);
        return;
      }

      // Track batch start time for maxDelay calculation (only for first item in batch)
      const isFirstItemInBatch = batchStartTimeRef.current === null;
      if (isFirstItemInBatch) {
        batchStartTimeRef.current = Date.now();
      }

      batchQueueRef.current.push(item);

      // Force flush if batch size exceeds maximum
      if (batchQueueRef.current.length >= maxBatchSize) {
        flushBatch();
        return;
      }

      scheduleBatchFlush();
    },
    [enabled, maxBatchSize, scheduleBatchFlush, onFlush, flushBatch]
  );

  // Cleanup timeout and flush remaining batch on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (maxDelayTimeoutRef.current) {
        clearTimeout(maxDelayTimeoutRef.current);
      }
      // Flush remaining batch before unmount
      if (batchQueueRef.current.length > 0) {
        flushBatch();
      }
    };
  }, [flushBatch]);

  return {
    addToBatch,
    flushBatch,
  };
};

