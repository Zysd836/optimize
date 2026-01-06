import type { DataItem } from '../types'

export type SocketEventType = 'push' | 'update'

export interface SocketEvent {
  type: SocketEventType
  item: DataItem
}

/**
 * Fake socket that simulates pushing and updating items
 * - Push: adds new items (10 per second)
 * - Update: updates existing items (5 per second)
 */
export class FakeSocket {
  private pushIntervalId: ReturnType<typeof setInterval> | null = null
  private updateIntervalId: ReturnType<typeof setInterval> | null = null
  private pushListeners: Set<(item: DataItem) => void> = new Set()
  private updateListeners: Set<(item: DataItem) => void> = new Set()
  private itemId = 0
  private existingItems: DataItem[] = []

  /**
   * Subscribe to push events (new items)
   * @param callback Function to call when a new item is pushed
   * @returns Unsubscribe function
   */
  onPush(callback: (item: DataItem) => void): () => void {
    this.pushListeners.add(callback)

    // Start emitting if this is the first listener
    if (this.pushListeners.size === 1) {
      this.startPush()
    }

    // Return unsubscribe function
    return () => {
      this.pushListeners.delete(callback)
      // Stop emitting if no more listeners
      if (this.pushListeners.size === 0) {
        this.stopPush()
      }
    }
  }

  /**
   * Subscribe to update events (existing items updated)
   * @param callback Function to call when an item is updated
   * @returns Unsubscribe function
   */
  onUpdate(callback: (item: DataItem) => void): () => void {
    this.updateListeners.add(callback)

    // Start emitting if this is the first listener
    if (this.updateListeners.size === 1) {
      this.startUpdate()
    }

    // Return unsubscribe function
    return () => {
      this.updateListeners.delete(callback)
      // Stop emitting if no more listeners
      if (this.updateListeners.size === 0) {
        this.stopUpdate()
      }
    }
  }

  /**
   * Start emitting push events at 10 items per second (every 100ms)
   */
  private startPush() {
    if (this.pushIntervalId !== null) {
      return
    }

    // Emit 10 items per second = 1 item every 100ms
    this.pushIntervalId = setInterval(() => {
      const item: DataItem = {
        id: this.itemId++,
        timestamp: Date.now(),
        value: Math.random() * 1000,
        status: ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)] as DataItem['status'],
      }

      // Add to existing items for potential updates
      this.existingItems.push(item)

      // Notify all push listeners
      this.pushListeners.forEach((callback) => {
        callback(item)
      })
    }, 100) // 100ms = 10 items per second
  }

  /**
   * Start emitting update events at 5 items per second (every 200ms)
   */
  private startUpdate() {
    if (this.updateIntervalId !== null) {
      return
    }

    // Emit 5 items per second = 1 item every 200ms
    this.updateIntervalId = setInterval(() => {
      // Only update if we have existing items
      if (this.existingItems.length === 0) {
        return
      }

      // Randomly select an existing item to update
      const randomIndex = Math.floor(Math.random() * this.existingItems.length)
      const itemToUpdate = this.existingItems[randomIndex]

      // Update the item's properties
      const updatedItem: DataItem = {
        ...itemToUpdate,
        timestamp: Date.now(),
        value: Math.random() * 1000,
        status: ['active', 'pending', 'completed'][Math.floor(Math.random() * 3)] as DataItem['status'],
      }

      // Update in the array
      this.existingItems[randomIndex] = updatedItem

      // Notify all update listeners
      this.updateListeners.forEach((callback) => {
        callback(updatedItem)
      })
    }, 200) // 200ms = 5 items per second
  }

  /**
   * Stop emitting push events
   */
  private stopPush() {
    if (this.pushIntervalId !== null) {
      clearInterval(this.pushIntervalId)
      this.pushIntervalId = null
    }
  }

  /**
   * Stop emitting update events
   */
  private stopUpdate() {
    if (this.updateIntervalId !== null) {
      clearInterval(this.updateIntervalId)
      this.updateIntervalId = null
    }
  }

  /**
   * Manually disconnect the socket
   */
  disconnect() {
    this.stopPush()
    this.stopUpdate()
    this.pushListeners.clear()
    this.updateListeners.clear()
    this.existingItems = []
  }
}

