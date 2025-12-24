# 微信小程序设计指南

> 本文档描述 metaAlpha 微信小程序的前端架构、实现规范和最佳实践，聚焦于架构原则和设计决策，而非具体代码细节。

---

## 📋 目录

1. [架构原则](#架构原则)
2. [目录结构](#目录结构)
3. [路由与权限](#路由与权限)
4. [数据同步](#数据同步)
5. [分享机制](#分享机制)
6. [性能优化](#性能优化)
7. [小程序特定能力](#小程序特定能力)
8. [UI/组件规范](#uicomponent规范)

---

## 🏗️ 架构原则

### 1.1 分层架构

```
┌─────────────────────────────────────┐
│         Pages (路由容器)             │
│  - 负责页面生命周期和路由跳转        │
│  - 最小化业务逻辑，委托给 Services   │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Components (可复用 UI)         │
│  - PieceRow, TakeawaysList 等       │
│  - 纯展示组件，通过 props 接收数据   │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Services (业务逻辑层)           │
│  - API 调用、认证、Piece 管理        │
│  - 封装与后端交互的细节              │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Store (全局状态)                │
│  - 单一数据源，通过 EventBus 更新    │
│  - 避免跨页面直接数据传递            │
└─────────────────────────────────────┘
```

### 1.2 数据流向

- **单向数据流**: `Store` → `Pages/Components` → `Services` → `API` → `Store`
- **事件驱动**: 跨页面通信通过 `EventBus`，避免直接依赖
- **状态同步**: `PieceUpdated`、`LibraryChanged` 等事件确保数据一致性

### 1.3 职责分离

| 层级           | 职责                         | 不应包含               |
| -------------- | ---------------------------- | ---------------------- |
| **Pages**      | 路由、生命周期、页面级状态   | 业务逻辑、API 调用细节 |
| **Components** | UI 展示、用户交互            | 数据获取、状态管理     |
| **Services**   | API 封装、数据转换、错误处理 | UI 逻辑、页面跳转      |
| **Store**      | 全局状态存储、事件分发       | 业务逻辑、API 调用     |

---

## 📁 目录结构

```
miniprogram/
├── app.js                    # 全局 App 逻辑（EventBus 初始化）
├── app.json                  # 全局配置（路由、窗口样式、darkmode）
├── app.wxss                  # 全局样式（设计令牌、主题）
│
├── pages/                    # 页面目录
│   ├── explore/              # 公开探索页（游客可访问）
│   │   ├── index.js         # 页面逻辑
│   │   ├── index.json       # 页面配置
│   │   ├── index.wxml       # 页面结构
│   │   └── index.wxss       # 页面样式（最小化，复用全局）
│   │
│   ├── login/               # 登录页（多方式：微信/邮箱）
│   ├── library/             # 个人 Library（需登录）
│   ├── piece/               # Piece 详情页（游客可读，需登录可写）
│   ├── add/                 # 添加内容（需登录）
│   ├── settings/            # 设置页（需登录）
│   ├── paywall/             # 付费墙（需登录）
│   └── subscription/        # 订阅管理（需登录）
│
├── components/               # 可复用组件
│   ├── PieceRow/           # Piece 列表项
│   │   ├── index.js
│   │   ├── index.json
│   │   ├── index.wxml
│   │   └── index.wxss
│   │
│   ├── TakeawaysList/       # Takeaways 展示列表
│   ├── PrimaryButton/       # 主按钮组件
│   └── ...
│
├── services/                # 业务逻辑服务
│   ├── api.js              # API 请求封装（已存在 utils/api.js）
│   ├── auth.js             # 认证服务（token 管理、登录状态）
│   ├── piece.js            # Piece 管理（CRUD、流式提取）
│   └── share.js            # 分享服务（生成分享链接、二维码）
│
├── store/                   # 全局状态管理
│   ├── index.js            # Store 实例（单一数据源）
│   └── events.js           # EventBus 定义（事件名常量）
│
└── utils/                   # 工具函数
    ├── api.js              # API 基础配置（baseUrl、请求封装）
    ├── storage.js          # 本地存储封装（token、用户信息）
    └── format.js           # 格式化工具（日期、文件大小等）
```

### 目录命名规范

- **Pages**: 小写，使用语义化名称（`library`, `piece`, `add`）
- **Components**: PascalCase（`PieceRow`, `TakeawaysList`）
- **Services**: 小写，单数形式（`auth.js`, `piece.js`）
- **Utils**: 小写，功能导向（`api.js`, `storage.js`）

---

## 🚦 路由与权限

### 3.1 路由配置 (`app.json`)

```json
{
  "pages": [
    "pages/explore/index", // 首页（公开）
    "pages/login/index",
    "pages/library/index", // 需登录
    "pages/piece/index", // 公开可读，需登录可写
    "pages/add/index", // 需登录
    "pages/settings/index", // 需登录
    "pages/paywall/index", // 需登录
    "pages/subscription/index" // 需登录
  ]
}
```

### 3.2 权限模型

| 页面             | 游客访问                | 登录访问                  | 权限检查时机                                |
| ---------------- | ----------------------- | ------------------------- | ------------------------------------------- |
| **explore**      | ✅ 可浏览 Top10         | ✅ 可浏览 + 跳转 Library  | 无需检查                                    |
| **login**        | ✅ 可访问               | ✅ 已登录自动跳转 Library | `onShow` 检查 token                         |
| **library**      | ❌ 需登录               | ✅ 完整访问               | `onShow` 检查 token，无则跳转 login         |
| **piece**        | ✅ 可读（无 `gcs_uri`） | ✅ 可读可写（完整数据）   | `onLoad` 不强制，`startStream` 等写操作检查 |
| **add**          | ❌ 需登录               | ✅ 完整访问               | `onShow` 检查 token                         |
| **settings**     | ❌ 需登录               | ✅ 完整访问               | `onShow` 检查 token                         |
| **paywall**      | ❌ 需登录               | ✅ 完整访问               | `onShow` 检查 token                         |
| **subscription** | ❌ 需登录               | ✅ 完整访问               | `onShow` 检查 token                         |

### 3.3 权限检查模式

**模式 A: 页面级拦截（Library, Add, Settings）**

```javascript
// pages/library/index.js
onShow() {
  const token = wx.getStorageSync('token');
  if (!token) {
    wx.redirectTo({ url: '/pages/login/index' });
    return;
  }
  this.loadLibrary();
}
```

**模式 B: 操作级拦截（Piece 详情页）**

```javascript
// pages/piece/index.js
onLoad(options) {
  // 允许游客访问，不强制登录
  this.loadPiece(options.id);
}

startStream() {
  // 写操作时才检查登录
  const token = wx.getStorageSync('token');
  if (!token) {
    wx.showModal({
      title: '需要登录',
      content: '生成 Takeaways 需要登录账号',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/login/index' });
        }
      }
    });
    return;
  }
  // 执行流式提取...
}
```

### 3.4 登录后回跳

- **场景**: 用户在 Piece 详情页点击"生成 Takeaways"，被引导登录
- **实现**: 登录成功后，`login/index.js` 检查 `options.redirect`，跳回原页面
- **存储**: 使用 `wx.setStorageSync('redirectAfterLogin', '/pages/piece/index?id=xxx')`

---

## 🔄 数据同步

### 4.1 Store 设计

**单一数据源原则**:

- `store/index.js` 维护全局状态（如 `library`, `currentPiece`）
- 页面通过 `getApp().globalData.store` 访问
- 更新通过 `EventBus` 通知，避免直接修改

**事件命名规范**:

- `PieceUpdated`: Piece 数据更新（如 Takeaways 流式更新）
- `LibraryChanged`: Library 列表变化（新增/删除 Piece）
- `UserLoggedIn`: 用户登录状态变化
- `TakeawaysStreaming`: Takeaways 流式更新中

### 4.2 数据同步策略

| 场景               | 同步方式            | 触发时机                        |
| ------------------ | ------------------- | ------------------------------- |
| **Library 列表**   | 手动刷新 + 事件通知 | `onShow`、`LibraryChanged` 事件 |
| **Piece 详情**     | 按需加载 + 事件更新 | `onLoad`、`PieceUpdated` 事件   |
| **Takeaways 流式** | WebSocket 实时推送  | `startStream` 时建立连接        |
| **用户信息**       | 登录时获取 + 缓存   | `login` 成功后                  |

### 4.3 跨页面通信

**避免直接传递数据**:

```javascript
// ❌ 不推荐：直接传递复杂对象
wx.navigateTo({
  url: `/pages/piece/index?id=${piece.id}&data=${JSON.stringify(piece)}`,
});

// ✅ 推荐：只传 ID，目标页面自行加载
wx.navigateTo({
  url: `/pages/piece/index?id=${piece.id}`,
});
```

**使用 EventBus**:

```javascript
// 页面 A：更新 Piece
const app = getApp();
app.globalData.eventBus.emit("PieceUpdated", { pieceId, takeaways });

// 页面 B：监听更新
app.globalData.eventBus.on("PieceUpdated", (data) => {
  if (data.pieceId === this.data.pieceId) {
    this.setData({ takeaways: data.takeaways });
  }
});
```

---

## 🔗 分享机制

### 5.1 分享入口

- **Piece 详情页**: 右上角"分享"按钮 → 调用 `wx.showShareMenu`
- **Library 列表**: 长按 Piece 项 → 弹出菜单 → "分享"

### 5.2 分享内容

- **标题**: Piece 的 `title` 或 `filename`
- **描述**: 前 3 条 Takeaways（如有）或 Piece 摘要
- **图片**: Piece 封面图（如有）或默认 Logo
- **路径**: `/pages/piece/index?id={pieceId}`

### 5.3 分享链接处理

**接收分享**:

```javascript
// app.js
onLaunch(options) {
  if (options.scene === 1007 || options.scene === 1008) {
    // 来自分享
    const pieceId = options.query.id;
    wx.navigateTo({ url: `/pages/piece/index?id=${pieceId}` });
  }
}
```

**分享统计**:

- 通过 `mini-api-worker` 记录分享事件（可选）
- 使用 `wx.getShareInfo()` 获取分享者信息（需解密）

---

## ⚡ 性能优化

### 6.1 代码分包

**主包** (必需):

- `app.js`, `app.json`, `app.wxss`
- `pages/login/index`（登录入口）
- `pages/explore/index`（首页）
- 全局组件和工具

**分包 A: Library** (`subpackages/library/`):

- `pages/library/index`
- `pages/piece/index`
- `components/PieceRow`, `components/TakeawaysList`

**分包 B: Creation** (`subpackages/creation/`):

- `pages/add/index`
- 文件上传相关组件

**分包 C: Settings** (`subpackages/settings/`):

- `pages/settings/index`
- `pages/paywall/index`
- `pages/subscription/index`

**配置** (`app.json`):

```json
{
  "subPackages": [
    {
      "root": "subpackages/library",
      "pages": ["pages/library/index", "pages/piece/index"]
    },
    {
      "root": "subpackages/creation",
      "pages": ["pages/add/index"]
    },
    {
      "root": "subpackages/settings",
      "pages": [
        "pages/settings/index",
        "pages/paywall/index",
        "pages/subscription/index"
      ]
    }
  ],
  "preloadRule": {
    "pages/explore/index": {
      "network": "wifi",
      "packages": ["subpackages/library"]
    }
  }
}
```

### 6.2 懒加载

**全局配置** (`app.json`):

```json
{
  "lazyCodeLoading": "requiredComponents"
}
```

**效果**:

- 按需加载组件代码，减少主包体积
- 首次启动更快

### 6.3 渲染优化

**`setData` 优化**:

```javascript
// ❌ 不推荐：频繁小更新
this.setData({ "takeaways[0].text": "new text" });
this.setData({ "takeaways[1].text": "another text" });

// ✅ 推荐：批量更新
this.setData({
  "takeaways[0].text": "new text",
  "takeaways[1].text": "another text",
});
```

**列表渲染**:

- 使用 `wx:key` 提升列表更新性能
- 长列表考虑虚拟滚动（如 `recycle-view` 组件）

### 6.4 网络优化

- **请求合并**: Library 列表一次性加载，避免多次请求
- **缓存策略**: Piece 详情缓存到本地，减少重复请求
- **图片优化**: 使用 CDN、WebP 格式、懒加载

---

## 🎯 小程序特定能力

### 7.1 深色模式

**全局配置** (`app.json`):

```json
{
  "darkmode": true
}
```

**样式适配** (`app.wxss`):

```css
/* 浅色模式（默认） */
page {
  background-color: #ffffff;
  color: #000000;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  page {
    background-color: #1a1a1a;
    color: #ffffff;
  }
}
```

**设计令牌**:

- 使用语义化颜色变量（`UI.primary`, `UI.bg`, `UI.border`）
- 避免硬编码颜色值

### 7.2 文件上传

**PDF 上传** (`pages/add/index.js`):

```javascript
chooseFile() {
  wx.chooseMessageFile({
    count: 1,
    type: 'file',
    success: (res) => {
      const file = res.tempFiles[0];
      if (file.type === 'application/pdf') {
        this.uploadPdf(file);
      }
    }
  });
}
```

**上传进度**:

- 使用 `wx.uploadFile` 的 `progress` 回调
- 显示进度条，提升用户体验

### 7.3 WebSocket 流式接收

**建立连接** (`services/piece.js`):

```javascript
wsExtract(pieceId, onMessage, onError) {
  const token = wx.getStorageSync('token');
  const ws = wx.connectSocket({
    url: `${getBaseUrl()}/ws/extract/${pieceId}`,
    header: { Authorization: `Bearer ${token}` }
  });

  ws.onMessage((res) => {
    const data = JSON.parse(res.data);
    onMessage(data); // 更新 UI
  });

  ws.onError(onError);
  return ws;
}
```

**错误处理**:

- 网络断开自动重连（指数退避）
- 显示错误提示，允许用户手动重试

### 7.4 小程序码生成

**场景**: 分享 Piece 到微信群/朋友圈
**实现**: 调用 `mini-api-worker` 生成小程序码，返回图片 URL
**展示**: 在分享弹窗中显示小程序码，用户保存后分享

---

## 🎨 UI/组件规范

### 8.1 设计系统（Frontier Style）

**字体架构**:

- **Serif** (Story): 正文内容、长文本（如 Piece 内容）
- **Mono** (Data): 代码、数据、标签（如 `label-mono`）
- **Sans** (UI): 界面元素、按钮、导航（默认 `font-family`）

**颜色系统**:

- **语义化命名**: `UI.primary`, `UI.action`, `UI.secondary`, `UI.bg`, `UI.bgSubtle`, `UI.border`
- **避免硬编码**: 不使用 `#FF0000` 等直接颜色值
- **深色适配**: 所有颜色需提供深色模式版本

### 8.2 布局原则

**扁平化设计**:

- ❌ 减少卡片式设计（`.card`）
- ✅ 使用容器（`.container`）、表面（`.surface`）、区块（`.section`）、分割线（`.divider`）

**间距系统**:

- 使用设计令牌（如 `32rpx`, `24rpx`, `16rpx`）
- 保持一致性，避免随意数值

**圆角规范**:

- 按钮: `24rpx`（中等圆角）
- 输入框: `16rpx`（小圆角）
- 容器: `0rpx`（扁平，无圆角）

### 8.3 组件规范

**按钮尺寸**:

- **主按钮** (`.btn`): 高度 `80rpx`，内边距 `24rpx 48rpx`
- **小按钮** (`.btn-mini`): 高度 `60rpx`，内边距 `16rpx 32rpx`
- **轮廓按钮** (`.btn-outline`): 同主按钮尺寸，边框样式

**输入框**:

- 高度 `80rpx`，圆角 `16rpx`
- 占位符样式 `.input-placeholder`（降低对比度）

**列表项**:

- 使用 `.section` 而非 `.card`
- 使用 `.divider` 分隔，而非边框
- 点击反馈使用 `hover-class`

### 8.4 响应式设计

**屏幕适配**:

- 使用 `rpx` 单位（响应式像素）
- 避免固定 `px` 值
- 测试不同屏幕尺寸（iPhone SE 到 iPad）

**横竖屏**:

- 主要支持竖屏
- 横屏时保持基本可用性（不强制横屏布局）

---

## 📝 总结

### 核心原则回顾

1. **分层清晰**: Pages → Components → Services → Store
2. **权限明确**: 页面级拦截 vs 操作级拦截
3. **数据同步**: EventBus 事件驱动，避免直接传递
4. **性能优先**: 分包、懒加载、`setData` 优化
5. **体验一致**: Frontier Style 设计系统，深色模式支持

### 下一步行动

- 完善 `services/` 层实现（`auth.js`, `piece.js`, `share.js`）
- 实现 `store/` 和 `EventBus`
- 补充 `components/` 组件库
- 编写页面级单元测试（如需要）

---

**文档版本**: v1.0  
**最后更新**: 2025-12-17  
**维护者**: metaAlpha Team



