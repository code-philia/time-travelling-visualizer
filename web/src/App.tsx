import { LeftSidebar } from "./component/left-sidebar"
import { MainBlock } from './component/main-block'
import { RightSidebar } from './component/right-sidebar'
import { Button } from "antd";
import { SettingOutlined } from "@ant-design/icons";

function App() {
    return (
        <div id='app'>
            <header className='app-header natural-diffuse-shadow strong-down-shadow'>
                <h1 style={{ fontSize: '18px', padding: 0, margin: '6px 0' }}>
                    <div className='dm-serif-text-regular' style={{ fontSize: '10px', lineHeight: '1' }}>Time Traveling</div>
                    <div className='dm-serif-text-regular' style={{ fontSize: '18px', lineHeight: '0.8' }}>Visualizer</div>
                </h1>
                <h1 style={{ fontSize: '12px', marginLeft: '12px' }}>
                    <div className="playwrite-ie-guides-regular">WEB TOOL</div>
                </h1>
                <div className='flex-space'></div>
                <div className='header-button-group'>
                    <Button color="default" variant="text" className="header-button" style={{ color: 'white' }}>
                        <SettingOutlined className="header-button-icon"></SettingOutlined>
                    </Button>
                </div>
            </header>
            <div className='app-body'>
                <LeftSidebar />
                <MainBlock />
                <RightSidebar />
            </div>
        </div>
    )
}

export default App
