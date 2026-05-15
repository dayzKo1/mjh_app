# 🀄 中国龙2 - 麻将消消乐（抖音小程序版）

## 项目简介

这是一个基于抖音小程序平台的麻将牌三消游戏，玩家需要选择三张相同的麻将牌进行消除。

## 项目结构

```
mah-miniapp/
├── app.js              # 小程序入口文件
├── app.json            # 小程序全局配置
├── app.ttss            # 小程序全局样式
├── project.config.json # 项目配置文件
├── pages/              # 页面目录
│   └── game/           # 游戏页面
│       ├── game.js     # 游戏逻辑
│       ├── game.json   # 页面配置
│       ├── game.ttml   # 页面模板
│       └── game.ttss   # 页面样式
├── images/             # 麻将牌图片资源
│   ├── Bamboo_*.png    # 条子牌
│   ├── Char_*.png      # 万子牌
│   ├── Wheel_*.png     # 筒子牌
│   ├── Wind_*.png      # 风牌
│   └── Dragon_*.png    # 箭牌
└── README.md           # 说明文档
```

## 游戏特性

### 🎮 游戏玩法

- **规则**: 选择三张相同的麻将牌进行消除
- **关卡**: 共20关，难度递增
- **计分**: 每次消除得10分
- **计时**: 记录通关时间

### 🀄 麻将牌类型

- **条子 (Bamboo)**: 一条到九条
- **万子 (Character)**: 一万到九万
- **筒子 (Wheel)**: 一筒到九筒
- **风牌 (Wind)**: 东南西北
- **箭牌 (Dragon)**: 中发白
- **总数**: 27种不同的麻将牌

### 🎯 关卡设计

- **关卡1**: 基础关卡，6张牌起步
- **难度递增**: 每关增加2张基础牌
- **牌种数量**: 随关卡增加可用麻将牌种类
- **最大关卡**: 20关

## 开发指南

### 环境要求

- 抖音小程序开发者工具
- Node.js (可选)

### 安装步骤

1. **下载开发者工具**
   - 访问 [抖音小程序开发者平台](https://developer.open-douyin.com/)
   - 下载并安装开发者工具

2. **导入项目**
   - 打开抖音小程序开发者工具
   - 选择"导入项目"
   - 选择 `mah-miniapp` 目录
   - 填写AppID（可使用测试号）

3. **配置项目**
   - 在 `project.config.json` 中修改 `appid`
   - 根据需要调整游戏参数

4. **运行调试**
   - 点击"编译"按钮
   - 在模拟器中查看效果
   - 使用真机调试功能测试

### 核心文件说明

#### app.js - 小程序入口

```javascript
App({
  globalData: {
    level: 1, // 当前关卡
    score: 0, // 当前分数
    time: 0, // 当前时间
    maxLevel: 20, // 最大关卡
  },
});
```

#### game.js - 游戏逻辑

- `generateLevelCards()`: 生成关卡麻将牌
- `calculateCardPositions()`: 计算麻将牌位置
- `onCardTap()`: 麻将牌点击事件
- `checkMatch()`: 检查是否匹配
- `removeCards()`: 移除匹配麻将牌

#### game.ttml - 页面模板

- 游戏标题和信息显示
- 麻将牌容器和麻将牌元素
- 操作按钮

#### game.ttss - 页面样式

- 响应式布局
- 麻将牌动画效果
- 交互反馈样式

## 自定义配置

### 修改关卡数量

在 `app.js` 中修改：

```javascript
globalData: {
  maxLevel: 20; // 修改为你想要的关卡数
}
```

### 修改麻将牌大小

在 `game.js` 中修改：

```javascript
calculateCardPositions(cards, containerWidth, containerHeight) {
  const cardWidth = 50;   // 麻将牌宽度
  const cardHeight = 70;  // 麻将牌高度
  const gap = 8;          // 麻将牌间距
  // ...
}
```

### 修改游戏容器大小

在 `game.js` 的 `data` 中修改：

```javascript
data: {
  containerWidth: 350,   // 容器宽度
  containerHeight: 500,  // 容器高度
  // ...
}
```

## 发布流程

1. **代码审核**
   - 确保代码符合抖音小程序规范
   - 测试所有功能是否正常

2. **上传代码**
   - 在开发者工具中点击"上传"
   - 填写版本号和更新说明

3. **提交审核**
   - 登录抖音小程序管理后台
   - 提交审核申请
   - 等待审核结果

4. **发布上线**
   - 审核通过后点击"发布"
   - 用户即可使用

## 注意事项

### 图片资源

- 图片文件名格式: `Type_Number.png`
- Type: Bamboo (条子), Char (万子), Wheel (筒子), Wind (风牌), Dragon (箭牌)
- Number: 1-9 (数字牌) 或 East/South/West/North (风牌) 或 Red/Green/White (箭牌)

### 性能优化

- 使用 `tt:if` 控制渲染
- 避免频繁的 `setData` 调用
- 合理使用事件委托

### 兼容性

- 支持抖音App最新版本
- 建议使用真机测试
- 注意不同设备的屏幕适配

## 技术支持

- [抖音小程序开发文档](https://developer.open-douyin.com/docs)
- [小程序API文档](https://developer.open-douyin.com/docs/api)
- [组件文档](https://developer.open-douyin.com/docs/component)

## 更新日志

### v1.0.0 (2024-05-15)

- ✅ 初始版本发布
- ✅ 实现基础三消玩法
- ✅ 支持20个关卡
- ✅ 添加麻将牌主题素材
- ✅ 完成基础UI设计

## 许可证

本项目仅供学习和研究使用。
