import { defineConfig, UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path';

// const VIEW_TYPE_PANEL_VIEW = 'extension-panel-view';
// const VIEW_TYPE_PLOT_VIEW = 'extension-plot-view';

// const baseConfig: UserConfig = {
//     plugins: [react()]
// };

// const PAGE_BUILD_TYPE = process.env.PAGE_BUILD_TYPE;

// let buildViewType: string | undefined;
// switch (PAGE_BUILD_TYPE) {
//     case 'extension-panel':
//         buildViewType = VIEW_TYPE_PANEL_VIEW;
//         break;
//     case 'extension-plot':
//         buildViewType = VIEW_TYPE_PLOT_VIEW;
//         break;
//     default:
//         buildViewType = 'app';
//         break;
// }

// baseConfig.build = {
//     outDir: `dist/${buildViewType}`
// };

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                full: resolve(__dirname, './index.html'),
                extensionPanel: resolve(__dirname, './configs/extension-panel-view/index.html'),
                extensionPlot: resolve(__dirname, './configs/extension-plot-view/index.html'),
                extensionDetail: resolve(__dirname, './configs/extension-detail-view/index.html'),
            }
        },
    }
})
