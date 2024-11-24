import { User } from './user'
import { ContentContainer } from './component/content'
import { ModelInfo } from './component/model-info'

function App() {
  return (
      <div id='app'>
        <User />
        <ContentContainer />
        <ModelInfo />
      </div>
  )
}

export default App
