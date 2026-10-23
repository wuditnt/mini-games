import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { sfx } from './engine/audio';
import { soundEnabled } from './lib/sound';
import './style.css';
import './app.css';

sfx.enabled = soundEnabled();

createRoot(document.getElementById('app')!).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#f2a63b',
        colorInfo: '#f2a63b',
        colorBgBase: '#07090c',
        borderRadius: 10,
        fontFamily:
          '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif',
      },
      components: {
        Layout: {
          siderBg: '#080b10',
          headerBg: 'rgba(8, 11, 15, 0.78)',
          bodyBg: 'transparent',
        },
        Menu: {
          darkItemBg: '#080b10',
          darkSubMenuItemBg: '#080b10',
          darkItemSelectedBg: 'rgba(242, 166, 59, 0.14)',
          darkItemSelectedColor: '#ffd08a',
        },
        Card: {
          colorBgContainer: 'rgba(255, 255, 255, 0.035)',
        },
      },
    }}
  >
    <App />
  </ConfigProvider>
);
