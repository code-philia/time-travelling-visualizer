import { VisualizationOptions } from './user'
import { VisualizationArea } from './component/content'
import { VisualizationInfo } from './component/model-info'

function App() {
  return (
    <div id='app'>
      <VisualizationOptions />
      <VisualizationArea />
      <VisualizationInfo />
    </div>
  )
}

export default App
