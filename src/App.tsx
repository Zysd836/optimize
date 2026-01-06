import VirtualizedList from './components/VirtualizedList'
import VirtualizedListWithTransitionState from './components/VirtualizedListWithTransitionState'
import VirtualizedListWithBatchedState from './components/VirtualizedListWithBatchedState'
import VirtualizedListWithBatchedQueryData from './components/VirtualizedListWithBatchedQueryData'
import VirtualizedListWithBatchedCallback from './components/VirtualizedListWithBatchedCallback'
import './App.css'

const App = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">React Optimize Rendering</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-5 gap-8">
          {/* Section 1: useTransitionState (Old case) */}
          {/* <div className="bg-white rounded-lg shadow-md p-6">
            <VirtualizedListWithTransitionState height={600} itemHeight={60} />
          </div> */}

          {/* Section 2: useBatchedUpdates (New case) */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <VirtualizedList height={600} itemHeight={60} />
          </div>

          {/* Section 3: useBatchedState */}
          {/* <div className="bg-white rounded-lg shadow-md p-6">
            <VirtualizedListWithBatchedState height={600} itemHeight={60} />
          </div> */}

          {/* Section 4: useBatchedQueryData (Infinite Query case) */}
          {/* <div className="bg-white rounded-lg shadow-md p-6">
            <VirtualizedListWithBatchedQueryData height={600} itemHeight={60} />
          </div> */}

          {/* Section 5: useBatchedCallback (Batching ở callback) */}
          {/* <div className="bg-white rounded-lg shadow-md p-6">
            <VirtualizedListWithBatchedCallback height={600} itemHeight={60} />
          </div> */}
        </div>
      </div>
    </div>
  )
}

export default App