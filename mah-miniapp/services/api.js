/**
 * 跨平台云开发调用服务
 * 支持：
 * - 抖音小游戏：tt.createCloud + callContainer API
 * - 微信小游戏：wx.cloud + cloud.callFunction API
 * - H5/Web：HTTP API 或 BaaS 服务
 * 所有业务逻辑统一部署在云函数服务中，通过 module + action 路由
 */

const platform = require('../utils/platform');

/**
 * 云环境配置
 * 不同平台使用不同的配置
 */
const CLOUD_CONFIG = {
  // 抖音云
  douyin: {
    envID: "env-JXqPdUfI6j",
    serviceId: "1m11ax5741bfv",
  },
  // 微信云（需要单独配置）
  wechat: {
    env: "your-wechat-env-id",
  },
  // Web 环境 - HTTP API 地址
  web: {
    baseUrl: "https://your-api-server.com/api",
  }
};

/** 云实例缓存 */
let cloudInstance = null;

/**
 * 获取云实例
 * @returns {Object|null} 云实例（Web 环境返回 null）
 */
function getCloudInstance() {
  if (platform.type === 'web') {
    return null; // Web 环境使用 HTTP API
  }

  if (!cloudInstance) {
    cloudInstance = platform.createCloud({
      envID: CLOUD_CONFIG.douyin.envID,
      serviceID: CLOUD_CONFIG.douyin.serviceId,
    });
  }

  return cloudInstance;
}

/**
 * 调用云服务
 * @param {string} moduleName - 业务模块名称（user/game/withdraw/ad/admin）
 * @param {string} action - 操作名称
 * @param {Object} data - 业务参数
 * @returns {Promise<Object>} 返回结果
 */
function callCloudFunction(moduleName, action, data = {}) {
  // Web 环境 - 使用 HTTP API
  if (platform.type === 'web') {
    return callHttpApi(moduleName, action, data);
  }

  // 小游戏环境 - 使用云开发
  return callMiniGameCloud(moduleName, action, data);
}

/**
 * 小游戏云调用
 */
function callMiniGameCloud(moduleName, action, data = {}) {
  return new Promise((resolve, reject) => {
    const cloud = getCloudInstance();
    
    if (!cloud) {
      reject(new Error("当前环境不支持云开发"));
      return;
    }

    // 抖音云使用 callContainer
    if (platform.type === 'douyin' && cloud.callContainer) {
      cloud.callContainer({
        serviceId: CLOUD_CONFIG.douyin.serviceId,
        path: "/",
        init: {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: { module: moduleName, action, ...data },
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const result = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
            resolve(result);
          } else {
            reject(new Error(`请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || "请求失败"));
        },
      });
    }
    // 微信云使用 callFunction
    else if (platform.type === 'wechat' && cloud.callFunction) {
      cloud.callFunction({
        name: 'blgb',
        data: { module: moduleName, action, ...data },
        success: (res) => {
          resolve(res.result);
        },
        fail: (err) => {
          reject(new Error(err.errMsg || "请求失败"));
        },
      });
    }
    else {
      reject(new Error("不支持的云开发环境"));
    }
  });
}

/**
 * Web 环境 HTTP API 调用
 */
function callHttpApi(moduleName, action, data = {}) {
  return new Promise((resolve, reject) => {
    fetch(`${CLOUD_CONFIG.web.baseUrl}/${moduleName}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    .then(res => res.json())
    .then(result => resolve(result))
    .catch(err => reject(new Error(err.message || "网络请求失败")));
  });
}

/**
 * 用户相关API
 */
const userApi = {
  /**
   * 用户登录
   * @param {Object} userInfo - 用户信息
   */
  login: (userInfo) => callCloudFunction("user", "login", { userInfo }),

  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   */
  getInfo: (userId) => callCloudFunction("user", "getInfo", { userId }),

  /**
   * 更新用户信息
   * @param {string} userId - 用户ID
   * @param {Object} data - 更新数据
   */
  updateInfo: (userId, data) =>
    callCloudFunction("user", "updateInfo", { userId, data }),

  /**
   * 绑定邀请人
   * @param {string} userId - 用户ID
   * @param {string} inviterId - 邀请人ID
   */
  bindInviter: (userId, inviterId) =>
    callCloudFunction("user", "bindInviter", { userId, inviterId }),

  /**
   * 获取邀请列表
   * @param {string} userId - 用户ID
   */
  getInviteList: (userId) =>
    callCloudFunction("user", "getInviteList", { userId }),

  /**
   * 内容安全检测
   * @param {string} content - 待检测文本
   */
  contentCheck: (content) =>
    callCloudFunction("user", "contentCheck", { content }),

  /**
   * 获取用户关卡进度
   * @param {string} userId - 用户ID
   */
  getProgress: (userId) =>
    callCloudFunction("user", "getProgress", { userId }),

  /**
   * 更新用户关卡进度
   * @param {string} userId - 用户ID
   * @param {Object} progress - 进度数据 { completedLevels, bestScores, unlockedLevel }
   */
  updateProgress: (userId, progress) =>
    callCloudFunction("user", "updateProgress", { userId, progress }),
};

/**
 * 游戏相关API
 */
const gameApi = {
  /**
   * 保存游戏记录
   * @param {string} userId - 用户ID
   * @param {number} level - 关卡
   * @param {number} score - 得分
   * @param {number} time - 用时
   */
  saveRecord: (userId, level, score, time) =>
    callCloudFunction("game", "saveRecord", { userId, level, score, time }),

  /**
   * 获取排行榜
   * @param {string} type - 排行榜类型
   * @param {number} limit - 数量限制
   */
  getRank: (type = "score", limit = 100) =>
    callCloudFunction("game", "getRank", { type, limit }),

  /**
   * 获取用户游戏记录
   * @param {string} userId - 用户ID
   * @param {number} limit - 数量限制
   */
  getUserRecords: (userId, limit = 50) =>
    callCloudFunction("game", "getUserRecords", { userId, limit }),

  /**
   * 获取关卡配置
   * @param {number} level - 关卡
   */
  getLevelConfig: (level) =>
    callCloudFunction("game", "getLevelConfig", { level }),

  /**
   * 获取所有关卡配置列表
   */
  getLevelList: () =>
    callCloudFunction("game", "getLevelList"),
};

/**
 * 广告相关API
 */
const adApi = {
  /**
   * 上报广告观看
   * @param {string} userId - 用户ID
   * @param {string} adType - 广告类型
   */
  report: (userId, adType) =>
    callCloudFunction("ad", "report", { userId, adType }),

  /**
   * 获取广告配置
   */
  getConfig: () => callCloudFunction("ad", "getConfig"),
};

module.exports = {
  CLOUD_CONFIG,
  userApi,
  gameApi,
  adApi,
};
