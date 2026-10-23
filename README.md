# ARCADE · 网页小游戏大厅

一个基于 Web 的轻量游戏大厅，内置《坦克大战》，并预留了快速扩展新游戏的注册机制。支持桌面键鼠与手机双摇杆触屏操作。

## 功能

- **游戏大厅**：游戏卡片展示，已上线 / 筹备中状态区分
- **坦克大战**：波次生存、道具掉落、护甲与基地防守、震屏与顿帧手感反馈
- **手机适配**：双摇杆触屏（左移动 / 右瞄准自动开火）、暂停按钮、横屏提示、安全区适配
- **数据统计**：对局记录、总对局 / 最高分 / 平均分 / 最长生存、得分趋势图与记录表格
- **零外部资源**：画面与音效均由 Canvas 程序化绘制、WebAudio 实时合成

## 技术栈

| 分类 | 选型 |
| --- | --- |
| 构建 | Vite 5 |
| 框架 | React 19 + React Router 7 |
| UI 组件 | Ant Design 6（暗色主题） |
| 游戏渲染 | Canvas 2D（无第三方游戏引擎） |
| 音效 | WebAudio 合成 |
| 语言 | TypeScript |

## 快速开始

```bash
npm install
npm run dev      # 开发环境：http://localhost:6173
npm run build    # 类型检查 + 生产构建
npm run preview  # 生产预览：http://localhost:8020
```

开发与预览服务均监听所有网卡，同一局域网内手机可通过 `http://<本机IP>:6173` 访问。

## 目录结构

```
src/
├── main.tsx              # 入口：挂载 React、antd 主题
├── App.tsx               # 应用外壳：侧边菜单（游戏大厅 / 数据统计）与路由
├── app.css               # 外壳、大厅、统计页样式
├── style.css             # 游戏画面、HUD、遮罩、触屏摇杆样式
├── pages/
│   ├── Lobby.tsx         # 游戏大厅
│   ├── GamePage.tsx      # 游戏全屏页（挂载/销毁游戏实例）
│   └── Stats.tsx         # 数据统计
├── data/
│   └── runs.ts           # 对局记录读写与汇总
├── components/
│   └── SoundButton.tsx   # 音效开关
├── lib/
│   └── sound.ts          # 音效偏好持久化
├── engine/
│   ├── audio.ts          # WebAudio 合成音效
│   ├── input.ts          # 键鼠输入
│   └── touch.ts          # 双摇杆触屏输入
└── games/
    ├── registry.ts       # 游戏注册表（卡片信息 + 懒加载入口）
    ├── types.ts          # 游戏模块接口
    └── tank/             # 坦克大战：逻辑、渲染、常量、挂载
```

## 操作方式

**键盘鼠标**

- `WASD` / 方向键：移动
- 鼠标：瞄准，左键：开火
- `Esc`：暂停

**触屏**

- 左半屏拖动：移动
- 右半屏拖动：瞄准并自动开火
- 右上角按钮：暂停

## 数据统计

对局数据保存在浏览器本地（`localStorage`），不上传服务器：

- `arcade.runs`：对局记录，最多保留 200 条
- `arcade.sound`：音效开关偏好
- `tank.best`：坦克大战最高分

统计页提供总对局、最高分、平均分、最长生存四项概览，以及得分趋势图和可排序的对局记录表格，并支持清空记录。如需多端同步或服务端统计，可替换 `src/data/runs.ts` 的读写实现。

## 新增游戏

1. 在 `src/games/<id>/index.ts` 中实现并导出 `mount(host, { onExit })`，返回 `{ destroy }`。
2. 在 `src/games/registry.ts` 中注册游戏信息（标题、描述、标签、封面 SVG、`loader` 懒加载）。
3. 大厅卡片会自动展示，点击后进入 `/play/<id>`，无需改动大厅代码。
