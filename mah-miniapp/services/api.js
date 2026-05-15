/**
 * 云函数调用服务
 */

const cloud = require('tt-cloud');

/**
 * 调用云函数
 * @param {string} name - 云函数名称
 * @param {string} action - 操作名称
 * @param {Object} data - 参数
 */
function callCloudFunction(name, action, data = {}) {
  return new Promise((resolve, reject) => {
    cloud.callFunction({
      name,
      data: {
        action,
        ...data,
      },
      success: (res) => {
        resolve(res.result);
      },
      fail: (err) => {
        reject(err);
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
   */
  login: () => callCloudFunction('user', 'login'),

  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   */
  getInfo: (userId) => callCloudFunction('user', 'getInfo', { userId }),

  /**
   * 更新用户信息
   * @param {string} userId - 用户ID
   * @param {Object} data - 更新数据
   */
  updateInfo: (userId, data) => callCloudFunction('user', 'updateInfo', { userId, data }),

  /**
   * 绑定邀请人
   * @param {string} userId - 用户ID
   * @param {string} inviterId - 邀请人ID
   */
  bindInviter: (userId, inviterId) => callCloudFunction('user', 'bindInviter', { userId, inviterId }),

  /**
   * 获取邀请列表
   * @param {string} userId - 用户ID
   */
  getInviteList: (userId) => callCloudFunction('user', 'getInviteList', { userId }),
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
    callCloudFunction('game', 'saveRecord', { userId, level, score, time }),

  /**
   * 获取排行榜
   * @param {string} type - 排行榜类型
   * @param {number} limit - 数量限制
   */
  getRank: (type = 'score', limit = 100) =>
    callCloudFunction('game', 'getRank', { type, limit }),

  /**
   * 获取用户游戏记录
   * @param {string} userId - 用户ID
   * @param {number} limit - 数量限制
   */
  getUserRecords: (userId, limit = 50) =>
    callCloudFunction('game', 'getUserRecords', { userId, limit }),

  /**
   * 获取关卡配置
   * @param {number} level - 关卡
   */
  getLevelConfig: (level) => callCloudFunction('game', 'getLevelConfig', { level }),
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
  apply: (userId, amount) => callCloudFunction('withdraw', 'apply', { userId, amount }),

  /**
   * 获取提现记录
   * @param {string} userId - 用户ID
   * @param {number} limit - 数量限制
   */
  getRecords: (userId, limit = 50) =>
    callCloudFunction('withdraw', 'getRecords', { userId, limit }),
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
  report: (userId, adType) => callCloudFunction('ad', 'report', { userId, adType }),

  /**
   * 获取广告配置
   */
  getConfig: () => callCloudFunction('ad', 'getConfig'),
};

module.exports = {
  userApi,
  gameApi,
  withdrawApi,
  adApi,
};
