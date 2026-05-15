# 中国龙2 - 麻将消消乐 项目架构

## 📁 项目整体结构

```
mjh_app/
├── frontend/                    # 前端项目
│   ├── miniapp/                # 抖音小程序
│   │   ├── pages/              # 页面
│   │   ├── components/         # 组件
│   │   ├── utils/              # 工具函数
│   │   ├── services/           # API服务
│   │   └── cloud/              # 云函数调用
│   └── web/                    # Web版本（现有mah目录）
│
├── backend/                     # 后端项目（抖音云开发）
│   ├── cloudfunctions/         # 云函数
│   │   ├── user/              # 用户相关
│   │   ├── game/              # 游戏相关
│   │   ├── withdraw/          # 提现相关
│   │   └── admin/             # 管理后台
│   └── database/              # 数据库设计
│
├── admin/                       # 后台管理系统
│   ├── src/                   # 源码
│   │   ├── pages/            # 页面
│   │   ├── components/       # 组件
│   │   └── services/         # API服务
│   └── package.json
│
└── docs/                        # 文档
    ├── api.md                 # API文档
    ├── deploy.md              # 部署文档
    └── database.md            # 数据库设计
```

## 🎯 核心功能模块

### 1. 用户系统
- **A类用户**: 可分佣提现
- **B类用户**: 不可提现
- 邀请关系链
- 用户等级系统

### 2. 游戏系统
- 羊了个羊玩法
- AI自动闯关
- 关卡系统
- 排行榜

### 3. 广告系统
- 激励视频广告
- Banner广告
- 插屏广告
- 广告收益统计

### 4. 分佣提现系统
- 佣金计算
- 提现申请
- 提现审核
- 提现记录

### 5. 后台管理系统
- 用户管理
- 提现审核
- 数据统计
- 广告配置
- 游戏配置

## 🛠️ 技术栈

### 前端
- **小程序**: 抖音小程序原生开发
- **Web**: React + TypeScript + Vite

### 后端
- **云函数**: 抖音云开发
- **数据库**: 抖音云数据库
- **存储**: 抖音云存储

### 后台
- **框架**: React + Ant Design
- **构建**: Vite
- **状态管理**: Zustand

## 🔐 数据库设计

### users（用户表）
```javascript
{
  _id: string,              // 用户ID
  openId: string,           // 抖音openId
  nickName: string,         // 昵称
  avatarUrl: string,        // 头像
  userType: 'A' | 'B',      // 用户类型
  inviterId: string,        // 邀请人ID
  level: number,            // 等级
  score: number,            // 总分
  commission: number,       // 佣金余额
  totalWithdraw: number,    // 累计提现
  createTime: Date,         // 创建时间
  updateTime: Date          // 更新时间
}
```

### withdraw_records（提现记录表）
```javascript
{
  _id: string,              // 记录ID
  userId: string,           // 用户ID
  amount: number,           // 提现金额
  status: 'pending' | 'approved' | 'rejected', // 状态
  applyTime: Date,          // 申请时间
  processTime: Date,        // 处理时间
  reason: string            // 拒绝原因
}
```

### game_records（游戏记录表）
```javascript
{
  _id: string,              // 记录ID
  userId: string,           // 用户ID
  level: number,            // 关卡
  score: number,            // 得分
  time: number,             // 用时
  createTime: Date          // 创建时间
}
```

### ad_records（广告记录表）
```javascript
{
  _id: string,              // 记录ID
  userId: string,           // 用户ID
  adType: string,           // 广告类型
  reward: number,           // 奖励
  createTime: Date          // 创建时间
}
```

### commission_records（分佣记录表）
```javascript
{
  _id: string,              // 记录ID
  triggerUserId: string,    // 触发分佣的用户ID
  amount: number,           // 总分佣金额
  level1Id: string,         // 一级分佣对象ID
  level1Amount: number,     // 一级分佣金额
  level2Id: string,         // 二级分佣对象ID
  level2Amount: number,     // 二级分佣金额
  level3Id: string,         // 三级分佣对象ID
  level3Amount: number,     // 三级分佣金额
  createTime: Date          // 创建时间
}
```

## ⚙️ 游戏配置

### 分数与关卡限制
```javascript
{
  maxScore: 10000,          // 单局最高分数
  maxLevel: 100,            // 最高关卡
  maxTime: 3600,            // 最长用时（秒）
  maxRecordsPerHour: 100,   // 每小时最多记录数
  maxCommissionPerDay: 100  // 每日分佣上限（元）
}
```

### 提现配置
```javascript
{
  minAmount: 1,             // 最低提现金额（元）
  maxAmount: 100,           // 单次最高提现金额（元）
  dailyLimit: 3             // 每日提现次数限制
}
```

## 🚀 部署流程

1. **配置抖音云开发**
   - 创建云开发环境
   - 配置云函数
   - 初始化数据库

2. **部署云函数**
   - 上传云函数代码
   - 配置触发器

3. **部署小程序**
   - 配置AppID
   - 上传代码
   - 提交审核

4. **部署后台**
   - 构建前端代码
   - 部署到云开发静态托管

## 📊 API接口设计

### 用户相关
- `user/login` - 用户登录
- `user/getInfo` - 获取用户信息
- `user/updateInfo` - 更新用户信息
- `user/bindInviter` - 绑定邀请人

### 游戏相关
- `game/saveRecord` - 保存游戏记录
- `game/getRank` - 获取排行榜
- `game/getLevelConfig` - 获取关卡配置

### 提现相关
- `withdraw/apply` - 申请提现
- `withdraw/getRecords` - 获取提现记录
- `withdraw/process` - 处理提现（管理员）

### 广告相关
- `ad/report` - 上报广告观看
- `ad/getConfig` - 获取广告配置

## 💰 分佣规则

### A类用户
- 可获得下级用户的游戏收益分成
- 可申请提现
- 提现最低金额: 1元
- 提现手续费: 0%

### B类用户
- 不可获得分佣
- 不可申请提现
- 可正常游戏

### 分佣计算
```javascript
// 一级分佣: 10%
// 二级分佣: 5%
// 三级分佣: 2%

function calculateCommission(userId, amount) {
  const user = getUser(userId);
  if (user.userType !== 'A') return 0;
  
  const level1 = getUser(user.inviterId);
  if (level1 && level1.userType === 'A') {
    addCommission(level1._id, amount * 0.1);
    
    const level2 = getUser(level1.inviterId);
    if (level2 && level2.userType === 'A') {
      addCommission(level2._id, amount * 0.05);
      
      const level3 = getUser(level2.inviterId);
      if (level3 && level3.userType === 'A') {
        addCommission(level3._id, amount * 0.02);
      }
    }
  }
}
```

## 📱 广告配置

### 激励视频广告
- 用途: 复活、获取道具
- 单次奖励: 0.01元
- 每日上限: 50次

### Banner广告
- 位置: 游戏底部
- 展示时机: 游戏进行中

### 插屏广告
- 位置: 游戏结束页
- 展示频率: 每3局1次
