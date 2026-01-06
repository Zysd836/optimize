import { useRef, memo, useEffect, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FakeSocket } from '../utils/fakeSocket'
import type { DataItem } from '../types'
import { useBatchedUpdates } from '../hooks/useBatchedUpdates'

interface VirtualizedListProps {
  height?: number
  itemHeight?: number
}

interface VirtualItemProps {
  item: DataItem
  virtualItem: {
    size: number
    start: number
  }
}

type BatchOperation = 
  | { type: 'push'; item: DataItem }
  | { type: 'update'; item: DataItem }

// Memoized VirtualItem component to prevent unnecessary re-renders
const VirtualItem = memo(({ item, virtualItem }: VirtualItemProps) => {
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getStatusColor = (status: DataItem['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`,
      }}
      className="px-4 py-2 border-b border-gray-200 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-700">ID: {item.id}</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(item.status)}`}>
              {item.status}
            </span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Value: {item.value.toFixed(2)} | Time: {formatTimestamp(item.timestamp)}
          </div>
        </div>
      </div>
    </div>
  )
})

VirtualItem.displayName = 'VirtualItem'

const VirtualizedList = ({ height = 600, itemHeight = 50 }: VirtualizedListProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const socket = useMemo(() => new FakeSocket(), [])

  // State for items - updated in batches
  const [items, setItems] = useState<DataItem[]>([])

  // Callback to process batched operations
  const handleFlush = useCallback((operations: BatchOperation[]) => {
    console.log("🚀 ---------------------------------------------🚀")
    console.log("🚀 ~ VirtualizedList ~ operations:", operations)
    console.log("🚀 ---------------------------------------------🚀")
    setItems((prevItems) => {
      let newItems = [...prevItems]
      
      // Process all operations in the batch
      for (const operation of operations) {
        if (operation.type === 'push') {
          // Add new item
          newItems = [...newItems, operation.item]
        } else if (operation.type === 'update') {
          // Update existing item
          const index = newItems.findIndex((item) => item.id === operation.item.id)
          if (index !== -1) {
            const existingItem = newItems[index]
            // Only update if the item actually changed
            if (
              existingItem.value !== operation.item.value ||
              existingItem.status !== operation.item.status ||
              existingItem.timestamp !== operation.item.timestamp
            ) {
              // Ensure we have a new array reference before mutating
              if (newItems === prevItems) {
                newItems = [...newItems]
              }
              newItems[index] = operation.item
            }
          }
        }
      }
      
      return newItems
    })
  }, [])

  // Use batch updates hook with new API
  const { addToBatch } = useBatchedUpdates<BatchOperation>({
    delay: 150, // Wait 150ms before flushing
    maxDelay: 5000, // Force flush after 5 seconds
    maxBatchSize: 50, // Force flush after 50 updates
    onFlush: handleFlush,
    enabled: true,
  })

  useEffect(() => {
    // Subscribe to push events - add to batch
    const unsubscribePush = socket.onPush((item) => {
      addToBatch({ type: 'push', item })
    })

    // Subscribe to update events - add to batch
    const unsubscribeUpdate = socket.onUpdate((updatedItem) => {
      addToBatch({ type: 'update', item: updatedItem })
    })

    return () => {
      unsubscribePush()
      unsubscribeUpdate()
    }
  }, [socket, addToBatch])

  // Sort items by ID in descending order (highest ID first)
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => b.id - a.id)
  }, [items])

  // Virtualizer will automatically handle updates efficiently
  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
  })

  return (
    <div className="w-full">
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-bold mb-2">Virtualized List (useBatchUpdates)</h2>
        <p className="text-sm text-gray-600">Total items: {items.length}</p>
        <p className="text-xs text-gray-500 mt-1">Batches updates with delay: 150ms, maxDelay: 5s, maxBatchSize: 50</p>
      </div>
      <div
        ref={parentRef}
        className="border border-gray-300 rounded-lg overflow-auto"
        style={{ height: `${height}px` }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = sortedItems[virtualItem.index]
            if (!item) return null
            return <VirtualItem key={item.id} item={item} virtualItem={virtualItem} />
          })}
        </div>
      </div>
    </div>
  )
}

export default VirtualizedList
