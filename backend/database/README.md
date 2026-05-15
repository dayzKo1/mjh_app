# 数据库设计文档

## 📊 数据表结构

### 1. users（用户表）

```javascript
{
  _id: string,              // 用户ID（自动生成）
  openId: string,           // 抖音openId
  nickName: string,         // 昵称
  avatarUrl: string,        // 头像URL
  userType: 'A' | 'B',      // 用户类型（A:可提现, B:不可提现）
  inviterId: string,        // 邀请人ID
  level: number,            // 最高关卡
  score: number,            // 总得分
  commission: number,       // 佣金余额（元）
  totalWithdraw: number,    // 累计提现（元）
  createTime: Date,         // 创建时间
  updateTime: Date,         // 更新时间
  lastLoginTime: Date       // 最后登录时间
}
```

**索引设计：**
- `openId`: 唯一索引
- `userType`: 普通索引
- `inviterId`: 普通索引
- `score`: 降序索引（排行榜）
- `commission`: 降序索引（排行榜）

---

### 2. game_records（游戏记录表）

```javascript
{
  _id: string,              // 记录ID（自动生成）
  userId: string,           // 用户ID
  level: number,            // 关卡
  score: number,            // 得分
  time: number,             // 用时（秒）
  createTime: Date          // 创建时间
}
```

**索引设计：**
- `userId`: 普通索引
- `createTime`: 降序索引

---

### 3. withdraw_records（提现记录表）

```javascript
{
  _id: string,              // 记录ID（自动生成）
  userId: string,           // 用户ID
  amount: number,           // 提现金额（元）
  status: 'pending' | 'approved' | 'rejected', // 状态
  applyTime: Date,          // 申请时间
  processTime: Date,        // 处理时间
  reason: string            // 拒绝原因
}
```

**索引设计：**
- `userId`: 普通索引
- `status`: 普通索引
- `applyTime`: 降序索引

---

### 4. ad_records（广告记录表）

```javascript
{
  _id: string,              // 记录ID（自动生成）
  userId: string,           // 用户ID
  adType: string,           // 广告类型（rewarded/banner/interstitial）
  reward: number,           // 奖励（元）
  createTime: Date          // 创建时间
}
```

**索引设计：**
- `userId`: 普通索引
- `adType`: 普通索引
- `createTime`: 降序索引

---

## 🔧 数据库初始化脚本

```javascript
// 在抖音云开发控制台执行

const db = cloud.database();

// 创建 users 表
await db.createCollection('users');

// 创建 game_records 表
await db.createCollection('game_records');

// 创建 withdraw_records 表
await db.createCollection('withdraw_records');

// 创建 ad_records 表
await db.createCollection('ad_records');

// 创建 commission_records 表（分佣记录）
await db.createCollection('commission_records');
```

---

## 📈 数据统计查询示例

### 1. 获取用户排行榜

```javascript
const result = await db.collection('users')
  .where({
    userType: 'A'
  })
  .orderBy('score', 'desc')
  .limit(100)
  .field({
    _id: true,
    nickName: true,
    avatarUrl: true,
    score: true
  })
  .get();
```

### 2. 获取用户邀请列表

```javascript
// 一级邀请
const level1 = await db.collection('users')
  .where({
    inviterId: userId
  })
  .get();

// 二级邀请
const level1Ids = level1.data.map(u => u._id);
const level2 = await db.collection('users')
  .where({
    inviterId: db.command.in(level1Ids)
  })
  .get();
```

### 3. 获取今日新增用户

```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const result = await db.collection('users')
  .where({
    createTime: db.command.gte(today)
  })
  .count();
```

### 4. 获取待审核提现

```javascript
const result = await db.collection('withdraw_records')
  .where({
    status: 'pending'
  })
  .orderBy('applyTime', 'asc')
  .limit(100)
  .get();
```

---

## 🔒 数据安全规则

### users 表

```json
{
  "read": true,
  "write": "auth.openid == doc.openId"
}
```

### game_records 表

```json
{
  "read": "auth.openid == doc.userId",
  "write": "auth.openid == doc.userId"
}
```

### withdraw_records 表

```json
{
  "read": "auth.openid == doc.userId",
  "write": "auth.openid == doc.userId"
}
```

### ad_records 表

```json
{
  "read": false,
  "write": "auth.openid == doc.userId"
}
```

---

## 💾 数据备份策略

1. **自动备份**: 抖音云开发每天自动备份
2. **手动备份**: 每周手动导出一次重要数据
3. **数据保留**: 游戏记录保留最近3个月，其他数据永久保留

---

## 🚀 性能优化建议

1. **索引优化**: 为常用查询字段创建索引
2. **分页查询**: 使用 skip + limit 进行分页
3. **字段筛选**: 使用 field() 只返回需要的字段
4. **缓存策略**: 对排行榜等热点数据使用缓存
5. **定期清理**: 定期清理过期的游戏记录
