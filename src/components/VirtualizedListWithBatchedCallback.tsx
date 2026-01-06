import { useRef, memo, useEffect, useMemo, useState, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FakeSocket } from '../utils/fakeSocket'
import type { DataItem } from '../types'
import { useBatchedCallback } from '../hooks/useBatchedCallback'

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

const VirtualizedListWithBatchedCallback = ({ height = 600, itemHeight = 50 }: VirtualizedListProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const socket = useMemo(() => new FakeSocket(), [])

  // State managed normally
  const [items, setItems] = useState<DataItem[]>([])
  console.log("🚀 ------------------------------------------------------🚀")
  console.log("🚀 ~ VirtualizedListWithBatchedCallback ~ items:", items)
  console.log("🚀 ------------------------------------------------------🚀")

  // Create batched setter - all updates through this setter are batched
  const batchedSetItems = useBatchedCallback(setItems, {
    maxBatchDelay: 5000, // Batch updates for 5 seconds
  })

  // Wrap callbacks - use batched setter instead of regular setter
  const handlePush = useCallback((item: DataItem) => {
    // All state updates through batchedSetItems are batched together
    batchedSetItems((prevItems) => {
      return [...prevItems, item]
    })
  }, [batchedSetItems])

  const handleUpdate = useCallback((updatedItem: DataItem) => {
    console.log("🚀 ------------------------------------------------------------------🚀")
    console.log("🚀 ~ VirtualizedListWithBatchedCallback ~ updatedItem:", updatedItem)
    console.log("🚀 ------------------------------------------------------------------🚀")
    // All state updates through batchedSetItems are batched together
    batchedSetItems((prevItems) => {
      const index = prevItems.findIndex((item) => item.id === updatedItem.id)
      if (index === -1) return prevItems

      const existingItem = prevItems[index]
      // Only update if the item actually changed
      if (
        existingItem.value !== updatedItem.value ||
        existingItem.status !== updatedItem.status ||
        existingItem.timestamp !== updatedItem.timestamp
      ) {
        const newItems = [...prevItems]
        newItems[index] = updatedItem
        return newItems
      }

      return prevItems
    })
  }, [batchedSetItems])

  useEffect(() => {
    // Subscribe to push events using batched callback
    const unsubscribePush = socket.onPush(handlePush)

    // Subscribe to update events using batched callback
    const unsubscribeUpdate = socket.onUpdate(handleUpdate)

    return () => {
      unsubscribePush()
      unsubscribeUpdate()
    }
  }, [socket, handlePush, handleUpdate])

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
        <h2 className="text-xl font-bold mb-2">Virtualized List (useBatchedCallback)</h2>
        <p className="text-sm text-gray-600">Total items: {items.length}</p>
        <p className="text-xs text-gray-500 mt-1">
          Batching ở callback - tất cả state updates trong callback được batch lại với nhau
        </p>
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

export default VirtualizedListWithBatchedCallback

