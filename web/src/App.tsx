import { LeftSidebar } from "./component/left-sidebar"
import { MainBlock } from './component/main-block'
import { RightSidebar } from './component/right-sidebar'
import { Button, Checkbox, Input, Modal } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import BottomPanel from "./component/bottom-panel";
import { useEffect, useState } from "react";
import { useDefaultStore } from "./state/state-store";

import './index.css';
import { useSetUpTrainingProcess } from "./state/state-actions";
import { MessageHandler } from "./communication/message";
import DetailPanel from "./component/detail-panel";

export function App() {
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const showSettingsModal = () => {
        setIsSettingsModalOpen(true);
    }

    const hideSettingsModal = () => {
        setIsSettingsModalOpen(false);
    }

    const {
        backendHost,
        setBackendHost,
        showLossAttribution,
        setShowLossAttribution,
        showTokensWeightAsSize,
        setShowTokensWeightAsSize,
        showTokensAlignmentAsColor,
        setShowTokensAlignmentAsColor
    } = useDefaultStore([
        'backendHost',
        'setBackendHost',
        'showLossAttribution',
        'setShowLossAttribution',
        'showTokensWeightAsSize',
        'setShowTokensWeightAsSize',
        'showTokensAlignmentAsColor',
        'setShowTokensAlignmentAsColor'
    ]);

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
                    <Button color="default" variant="text" className="header-button" style={{ color: 'white' }}
                        onClick={showSettingsModal}
                    >
                        <SettingOutlined className="header-button-icon"></SettingOutlined>
                    </Button>
                </div>
            </header>
            <Modal title="Settings" open={isSettingsModalOpen} footer={null} onCancel={hideSettingsModal}>
                <div className="component-block">
                    <div className="label">Backend Host</div>
                    <Input value={backendHost} onChange={(e) => setBackendHost(e.target.value)} />
                </div>
                <div className="component-block">
                    <div className="label">Dummy Settings</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <Checkbox checked={showLossAttribution} onChange={(e) => setShowLossAttribution(e.target.checked)}>Show Loss Attribution</Checkbox>
                        <Checkbox checked={showTokensWeightAsSize} onChange={(e) => setShowTokensWeightAsSize(e.target.checked)}>Show Tokens Weight As Size</Checkbox>
                        <Checkbox checked={showTokensAlignmentAsColor} onChange={(e) => setShowTokensAlignmentAsColor(e.target.checked)}>Show Tokens Alignment As Color</Checkbox>
                    </div>
                </div>
            </Modal>
            <div className='app-body'>
                <div className='app-body-upper-part'>
                    <LeftSidebar />
                    <MainBlock />
                    <RightSidebar />
                </div>
                <BottomPanel></BottomPanel>
            </div>
            <MessageHandler></MessageHandler>
        </div>
    )
}

export function AppPlotViewOnly() {
    const { setValue } = useDefaultStore(['setValue']);
    const setUpTrainingProcess = useSetUpTrainingProcess();

    useEffect(() => {
        setValue("contentPath", "/home/yuhuan/projects/cophi/visualizer-refactor/dev/sample-datasets/new-version-datasets/gcb_tokens");
        setValue("visMethod", "TimeVis");

        (async () => {
            await setUpTrainingProcess();
        })();
    });

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
            <MainBlock></MainBlock>
            <MessageHandler></MessageHandler>
        </div>
    );
}

export function AppPanelViewOnly() {
    const { setValue } = useDefaultStore(['setValue']);
    const setUpTrainingProcess = useSetUpTrainingProcess();

    useEffect(() => {
        setValue("contentPath", "/home/yuhuan/projects/cophi/visualizer-refactor/dev/sample-datasets/new-version-datasets/gcb_tokens");
        setValue("visMethod", "TimeVis");

        (async () => {
            await setUpTrainingProcess();
        })();
    });

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <BottomPanel></BottomPanel>
            <MessageHandler></MessageHandler>
        </div>
    );
}

export function AppDetailPanelViewOnly() {
    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <DetailPanel></DetailPanel>
            <MessageHandler></MessageHandler>
        </div>
    );
}
