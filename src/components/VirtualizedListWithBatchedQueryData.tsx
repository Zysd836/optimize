import { useRef, memo, useEffect, useMemo, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FakeSocket } from '../utils/fakeSocket'
import type { DataItem } from '../types'
import { useBatchedQueryData, type InfiniteData, type QueryClient } from '../hooks/useBatchedQueryData'
import { MockQueryClient } from '../utils/mockQueryClient'

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

const VirtualizedListWithBatchedQueryData = ({ height = 600, itemHeight = 50 }: VirtualizedListProps) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const socket = useMemo(() => new FakeSocket(), [])
  
  // Create mock query client (in real app, use useQueryClient() from react-query)
  const queryClient = useMemo(() => new MockQueryClient(), [])
  const queryKey = useMemo(() => ['infinite-items'], [])

  // Use batched setQueryData hook
  const batchedSetQueryData = useBatchedQueryData<DataItem[]>(
    queryClient as unknown as QueryClient, // Type assertion for mock
    queryKey,
    {
      maxBatchDelay: 5000, // Batch updates for 5 seconds
      maxBatchSize: 50, // Flush after 50 updates
    }
  )

  // State to track render count
  const [renderCount, setRenderCount] = useState(0)

  // Subscribe to query data changes (simulating useInfiniteQuery)
  const [queryData, setQueryData] = useState<InfiniteData<DataItem[]> | undefined>(undefined)

  useEffect(() => {
    // Initialize query data
    queryClient.setQueryData<InfiniteData<DataItem[]>>(queryKey, {
      pages: [[]],
      pageParams: [0],
    })

    // Subscribe to query data changes
    const unsubscribe = queryClient.subscribe(queryKey, (data) => {
      setQueryData(data as InfiniteData<DataItem[]>)
      setRenderCount(queryClient.getRenderCount())
    })

    return unsubscribe
  }, [queryClient, queryKey])

  useEffect(() => {
    // Helper function to check if item exists in query data
    const findItemInQueryData = (queryData: InfiniteData<DataItem[]> | undefined, itemId: number): DataItem | null => {
      if (!queryData) return null
      for (const page of queryData.pages) {
        const item = page.find((i) => i.id === itemId)
        if (item) return item
      }
      return null
    }

    // Helper function to check if item actually changed
    const hasItemChanged = (existingItem: DataItem, updatedItem: DataItem): boolean => {
      return (
        existingItem.value !== updatedItem.value ||
        existingItem.status !== updatedItem.status ||
        existingItem.timestamp !== updatedItem.timestamp
      )
    }

    // Subscribe to push events - use batched setQueryData
    const unsubscribePush = socket.onPush((item) => {
      // Check if item already exists to avoid duplicates
      const currentData = queryClient.getQueryData<InfiniteData<DataItem[]>>(queryKey)
      const existingItem = findItemInQueryData(currentData, item.id)
      
      // Only process if item doesn't exist yet
      if (!existingItem) {
        // Use batched version - updates will be batched automatically
        batchedSetQueryData((oldData) => {
          if (!oldData) {
            return {
              pages: [[item]],
              pageParams: [0],
            }
          }

          // Add new item to the first page
          return {
            ...oldData,
            pages: [
              [item, ...oldData.pages[0]],
              ...oldData.pages.slice(1),
            ],
          }
        })
      }
    })

    // Subscribe to update events - use batched setQueryData
    const unsubscribeUpdate = socket.onUpdate((updatedItem) => {
      // Check current data before queuing update
      const currentData = queryClient.getQueryData<InfiniteData<DataItem[]>>(queryKey)
      const existingItem = findItemInQueryData(currentData, updatedItem.id)

      // Only process if item exists and actually changed
      if (existingItem && hasItemChanged(existingItem, updatedItem)) {
        // Use batched version - updates will be batched automatically
        batchedSetQueryData((oldData) => {
          if (!oldData) return oldData

          // Find and update the item in all pages
          const updatedPages = oldData.pages.map((page) => {
            const index = page.findIndex((item) => item.id === updatedItem.id)
            if (index === -1) return page

            const newPage = [...page]
            newPage[index] = updatedItem
            return newPage
          })

          return {
            ...oldData,
            pages: updatedPages,
          }
        })
      }
    })

    return () => {
      unsubscribePush()
      unsubscribeUpdate()
    }
  }, [socket, batchedSetQueryData, queryClient, queryKey])

  // Flatten all pages for display
  const allItems = useMemo(() => {
    if (!queryData) return []
    return queryData.pages.flat()
  }, [queryData])

  // Sort items by ID in descending order (highest ID first)
  const sortedItems = useMemo(() => {
    return [...allItems].sort((a, b) => b.id - a.id)
  }, [allItems])

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
        <h2 className="text-xl font-bold mb-2">Virtualized List (useBatchedQueryData)</h2>
        <p className="text-sm text-gray-600">Total items: {sortedItems.length}</p>
        <div className="mt-2 space-y-1">
          <p className="text-xs text-gray-500">
            Renders triggered: <span className="font-semibold">{renderCount}</span>
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Pattern: Batches queryClient.setQueryData calls for infinite queries
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

export default VirtualizedListWithBatchedQueryData

