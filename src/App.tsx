import { useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, Layout, Menu } from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import Lobby from './pages/Lobby';
import Stats from './pages/Stats';
import GamePage from './pages/GamePage';
import { SoundButton } from './components/SoundButton';

const { Sider, Header, Content } = Layout;

const MENU_ITEMS = [
  { key: '/lobby', icon: <AppstoreOutlined />, label: '游戏大厅' },
  { key: '/stats', icon: <BarChartOutlined />, label: '数据统计' },
];

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const selected = location.pathname.startsWith('/stats') ? '/stats' : '/lobby';

  const go = (key: string) => {
    navigate(key);
    if (window.innerWidth < 992) setCollapsed(true);
  };

  return (
    <Layout className="app-layout">
      <Sider
        className="app-sider"
        width={224}
        collapsedWidth={0}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        trigger={null}
      >
        <div className="app-brand">
          <div className="app-brand-mark">A</div>
          <div className="app-brand-text">
            <span className="app-brand-name">ARCADE</span>
            <span className="app-brand-sub">游戏大厅</span>
          </div>
        </div>
        <Menu
          className="app-menu"
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={MENU_ITEMS}
          onClick={({ key }) => go(key)}
        />
        <div className="app-sider-foot">SINGLE PLAYER · WEB ARCADE</div>
      </Sider>

      <Layout>
        <Header className="app-header">
          <Button
            type="text"
            className="app-menu-toggle"
            aria-label="切换菜单"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((v) => !v)}
          />
          <span className="app-header-title">{selected === '/stats' ? '数据统计' : '游戏大厅'}</span>
          <span className="app-header-spacer" />
          <SoundButton />
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/lobby" replace />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="*" element={<Navigate to="/lobby" replace />} />
        </Route>
        <Route path="/play/:id" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}
