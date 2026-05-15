# 部署文档

## 📋 部署前准备

### 1. 注册抖音开放平台账号
- 访问 [抖音开放平台](https://developer.open-douyin.com/)
- 注册开发者账号
- 完成实名认证

### 2. 创建小程序
- 在开放平台创建小程序
- 获取 AppID
- 配置小程序基本信息

### 3. 开通云开发
- 在小程序管理后台开通云开发
- 创建云开发环境
- 获取环境ID

### 4. 申请广告位
- 在小程序管理后台申请广告位
- 获取激励视频、Banner、插屏广告位ID

---

## 📁 项目结构

```
mjh_app/
├── mah/              # Web版前端（React游戏）
├── mah-miniapp/      # 抖音小程序前端
├── backend/          # 后端云函数
├── admin/            # 管理后台（部署到抖音云静态托管）
└── tauri-app/        # Tauri/App打包文件（备用）
```

---

## 🚀 部署步骤

### 第一步：配置云函数

1. **安装依赖**
```bash
cd backend/cloudfunctions/user && npm install @cloudbase/node-sdk
cd ../game && npm install @cloudbase/node-sdk
cd ../withdraw && npm install @cloudbase/node-sdk
cd ../ad && npm install @cloudbase/node-sdk
cd ../admin && npm install @cloudbase/node-sdk
```

2. **配置环境变量（重要）**
- 在云开发控制台，进入"云函数" -> "配置"
- 为每个云函数设置环境变量：
  - `ADMIN_TOKEN`: 管理员Token（建议使用32位以上随机字符串）
- 或修改 `backend/cloudfunctions/shared/config.js` 中的默认值

3. **上传云函数**
- 在抖音开发者工具中，右键点击 `cloudfunctions` 目录
- 选择"上传并部署：云端安装依赖"

4. **配置HTTP触发器（管理后台需要）**
- 在云开发控制台，进入"云函数"
- 为每个云函数开启HTTP触发器
- 记录触发器URL

---

### 第二步：初始化数据库

1. **打开云开发控制台**
- 在抖音开发者工具中，点击"云开发"
- 进入数据库管理页面

2. **创建数据表**
```javascript
const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();

await db.createCollection('users');
await db.createCollection('game_records');
await db.createCollection('withdraw_records');
await db.createCollection('ad_records');
await db.createCollection('commission_records');
```

3. **创建索引**
```
users 表：openId(唯一), userType, inviterId, score(降序), commission(降序)
game_records 表：userId, createTime(降序)
withdraw_records 表：userId, status, applyTime(降序)
ad_records 表：userId, adType, createTime(降序)
commission_records 表：triggerUserId, createTime(降序)
```

4. **配置安全规则**
```json
// users 表
{ "read": true, "write": "auth.openid == doc.openId" }

// game_records 表
{ "read": "auth.openid == doc.userId", "write": "auth.openid == doc.userId" }

// withdraw_records 表
{ "read": "auth.openid == doc.userId", "write": "auth.openid == doc.userId" }

// ad_records 表
{ "read": false, "write": "auth.openid == doc.userId" }
```

---

### 第三步：配置小程序

1. **修改 AppID**
```json
// mah-miniapp/project.config.json
{ "appid": "your-app-id" }
```

2. **修改云环境ID**
```javascript
// mah-miniapp/app.js
tt.cloud.init({ env: 'your-env-id', traceUser: true });
```

3. **修改广告位ID**
```javascript
// mah-miniapp/utils/ad.js
rewardedAd = tt.createRewardedVideoAd({ adUnitId: 'your-rewarded-ad-unit-id' });
bannerAd = tt.createBannerAd({ adUnitId: 'your-banner-ad-unit-id' });
interstitialAd = tt.createInterstitialAd({ adUnitId: 'your-interstitial-ad-unit-id' });
```

---

### 第四步：上传小程序

1. 在抖音开发者工具中点击"上传"
2. 在小程序管理后台点击"提交审核"
3. 审核通过后点击"发布"

---

### 第五步：部署管理后台（抖音云静态托管，免费）

> 管理后台是纯静态网站，部署到抖音云静态托管**完全免费，无需云服务器**。

1. **构建管理后台**
```bash
cd admin
npm install
npm run build
```

2. **配置云环境ID**
- 创建 `.env.production` 文件：
```
REACT_APP_CLOUD_ENV_ID=your-env-id
```
- 或直接修改 `admin/src/services/api.ts` 中的默认值

3. **上传到云开发静态托管**
- 在云开发控制台，进入"静态网站托管"
- 上传 `admin/dist/` 目录下的所有文件

4. **访问管理后台**
- 使用云开发提供的默认域名访问
- 或配置自定义域名

5. **登录信息**
- 用户名：`admin`
- 密码：`mah123456`
- ⚠️ 生产环境请修改 `admin/src/pages/Login/index.tsx` 中的 `ADMIN_CREDENTIALS`

---

## 💰 费用说明

| 项目 | 费用 |
|------|------|
| 抖音云开发（基础版） | 免费 |
| 抖音云静态托管 | 免费 |
| 抖音云函数调用 | 免费额度内免费 |
| 抖音云数据库 | 免费额度内免费 |
| 管理后台 | 免费（静态托管） |
| **总计** | **0元/月** |

> 免费额度足够初期使用，用户量增长后可升级付费版。

---

## ⚠️ 注意事项

1. **云函数配额**：免费版有调用次数限制，建议购买付费版
2. **数据库配额**：免费版有存储容量限制，定期清理过期数据
3. **广告审核**：广告位需要审核通过才能使用
4. **提现设置**：需要配置提现渠道，建议人工审核大额提现
5. **安全规则**：仔细检查数据库安全规则，避免数据泄露
6. **管理员Token**：云函数中的 `ADMIN_TOKEN` 需要替换为安全的密钥

---

## 🆘 常见问题

### Q1: 管理后台需要云服务器吗？
**A:** 不需要！管理后台是纯静态网站，部署到抖音云静态托管完全免费。

### Q2: 管理后台如何调用云函数？
**A:** 通过云函数的HTTP触发器。在云开发控制台为每个云函数开启HTTP触发器即可。

### Q3: 云函数调用失败？
**A:** 检查云函数是否上传成功，环境ID是否正确，HTTP触发器是否开启。

### Q4: 广告加载失败？
**A:** 检查广告位ID是否正确，广告位是否审核通过。

### Q5: 用户无法提现？
**A:** 检查用户类型是否为A，佣金余额是否足够。

---

## 📞 技术支持

- 抖音开放平台文档：https://developer.open-douyin.com/
- 云开发文档：https://microapp.bytedance.com/docs/zh-CN/cloud/
