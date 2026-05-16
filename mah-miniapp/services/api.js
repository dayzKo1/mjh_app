/**
 * 抖音云开发调用服务
 * 使用 tt.createCloud + callContainer API 调用抖音云函数服务
 * 所有业务逻辑统一部署在 blgb 云函数服务中，通过 module + action 路由
 */

/**
 * 云环境配置
 * serviceId 为抖音云控制台创建的云函数服务ID
 */
const CLOUD_CONFIG = {
  envID: "env-JXqPdUfI6j",
  serviceId: "1m11ax5741bfv",
};

/** 云实例缓存 */
let cloudInstance = null;

/**
 * 获取云实例
 * @returns {Object} 云实例
 */
function getCloudInstance() {
  if (!tt.createCloud) {
    throw new Error("当前环境不支持云开发");
  }

  if (!cloudInstance) {
    cloudInstance = tt.createCloud({
      envID: CLOUD_CONFIG.envID,
    });
  }

  return cloudInstance;
}

/**
 * 调用抖音云容器服务
 * @param {string} moduleName - 业务模块名称（user/game/withdraw/ad/admin）
 * @param {string} action - 操作名称
 * @param {Object} data - 业务参数
 * @returns {Promise<Object>} 返回结果
 */
function callCloudFunction(moduleName, action, data = {}) {
  return new Promise((resolve, reject) => {
    const cloud = getCloudInstance();

    cloud.callContainer({
      serviceId: CLOUD_CONFIG.serviceId,
      path: "/",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: { module: moduleName, action, ...data },
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const result =
            typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          resolve(result);
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || "请求失败"));
      },
    });
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
};

/**
 * 提现相关API
 */
const withdrawApi = {
  /**
   * 申请提现
   * @param {string} userId - 用户ID
   * @param {number} amount - 提现金额
   */
  apply: (userId, amount) =>
    callCloudFunction("withdraw", "apply", { userId, amount }),

  /**
   * 获取提现记录
   * @param {string} userId - 用户ID
   * @param {number} limit - 数量限制
   */
  getRecords: (userId, limit = 50) =>
    callCloudFunction("withdraw", "getRecords", { userId, limit }),
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
  withdrawApi,
  adApi,
};
