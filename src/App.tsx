import VirtualizedList from './components/VirtualizedList'
import './App.css'

const App = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">React Optimize Rendering</h1>
        <VirtualizedList height={600} itemHeight={60} />
      </div>
    </div>
  )
}

export default App