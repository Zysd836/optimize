import { useRef, memo, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FakeSocket } from '../utils/fakeSocket'
import type { DataItem } from '../types'
import { useBatchedState } from '../hooks/useBatchedState'

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

const VirtualizedListWithBatchedState = ({ height = 600, itemHeight = 50 }: VirtualizedListProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const socket = useMemo(() => new FakeSocket(), [])

  // Use useBatchedState - state managed inside hook
  const { state: items, setState, isPending } = useBatchedState<DataItem[]>([], {
    maxBatchDelay: 5000, // Batch updates for 5 seconds
    maxBatchSize: 50, // Flush after 50 updates
  })

  useEffect(() => {
    // Subscribe to push events - update logic handled externally
    const unsubscribePush = socket.onPush((item) => {
      setState((prevItems) => {
        return [...prevItems, item]
      })
    })

    // Subscribe to update events - update logic handled externally
    const unsubscribeUpdate = socket.onUpdate((updatedItem) => {
      setState((prevItems) => {
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
    })

    return () => {
      unsubscribePush()
      unsubscribeUpdate()
    }
  }, [socket, setState])

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
        <h2 className="text-xl font-bold mb-2">Virtualized List (useBatchedState)</h2>
        <p className="text-sm text-gray-600">Total items: {items.length}</p>
        <p className="text-xs text-gray-500 mt-1">
          State managed inside hook, update logic handled externally through updater function
        </p>
        {isPending && (
          <p className="text-xs text-blue-600 mt-1 font-medium">Pending updates...</p>
        )}
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

export default VirtualizedListWithBatchedState

