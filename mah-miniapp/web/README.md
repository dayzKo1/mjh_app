# 麻将消消乐 - 跨平台版本

## 支持平台

- 抖音小游戏（原生）
- 微信小游戏（需构建）
- H5/Web
- Android APK

## 快速开始

### H5/Web 开发

```bash
cd web
npm install
npm run dev
```

### 构建 H5

```bash
npm run build
```

### 构建 Android APK

```bash
# 初始化 Capacitor（首次）
npm run cap:init

# 添加 Android 平台（首次）
npm run cap:add:android

# 构建并同步到 Android
npm run build:apk
```

## 项目结构

```
mah-miniapp/
├── game.js              # 抖音小游戏入口
├── game.json            # 抖音小游戏配置
├── utils/
│   ├── platform.js      # 平台适配器
│   ├── sound.js         # 音效管理
│   └── ad.js            # 广告管理
├── services/
│   └── api.js           # 云服务 API
├── web/                 # Web/Android 版本
│   ├── index.html       # H5 入口
│   ├── platform-web.js  # Web 平台适配
│   ├── vite.config.js   # 构建配置
│   └── capacitor.config.json # APK 配置
└── assets/              # 图片资源
```

## 平台适配器 API

```javascript
const platform = require('./utils/platform');

// 存储
platform.getStorage('key');
platform.setStorage('key', 'value');

// 音频
const audio = platform.createInnerAudioContext();
audio.src = 'sounds/click.mp3';
audio.play();

// 广告
const rewardedAd = platform.createRewardedVideoAd({ adUnitId: 'xxx' });

// 触摸事件
platform.onTouchStart((res) => {
  const { x, y } = res.touches[0];
});
```

## 注意事项

1. 抖音/微信小游戏使用原生 Canvas API
2. H5/APK 使用 DOM Canvas
3. 云服务在各平台使用不同实现
4. 广告在 H5 端为模拟实现