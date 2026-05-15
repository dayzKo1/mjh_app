/**
 * 广告云函数 - 处理广告上报、配置等
 */

const cloud = require('@cloudbase/node-sdk');
const { verifyAdminToken } = require('../shared/config');
const { createLogger } = require('../shared/logger');

const log = createLogger('ad');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const _ = db.command;
const adRecordsCollection = db.collection('ad_records');
const usersCollection = db.collection('users');

const AD_CONFIG = {
  rewarded: {
    enabled: true,
    reward: 0.01,
    dailyLimit: 50,
  },
  banner: {
    enabled: true,
  },
  interstitial: {
    enabled: true,
    frequency: 3,
  },
};

/**
 * 上报广告观看
 * 仅A类用户可获得激励视频奖励
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {string} event.adType - 广告类型（rewarded/banner/interstitial）
 */
exports.report = async (event) => {
  const { userId, adType } = event;

  try {
    log.start('report', '上报广告观看请求', { userId, adType });

    if (!userId || typeof userId !== 'string') {
      log.warn('report', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }

    if (!AD_CONFIG[adType] || !AD_CONFIG[adType].enabled) {
      log.warn('report', '广告类型未启用', { adType, config: AD_CONFIG[adType] });
      return {
        code: -1,
        message: '该类型广告未启用',
      };
    }

    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      log.warn('report', '用户不存在', { userId });
      return { code: -1, message: '用户不存在' };
    }

    const user = userResult.data;
    log.debug('report', '用户信息', { userId, userType: user.userType, commission: user.commission });

    if (adType === 'rewarded') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayRecords = await adRecordsCollection
        .where({
          userId,
          adType: 'rewarded',
          createTime: _.gte(today),
        })
        .count();

      log.debug('report', '今日激励视频观看次数', { userId, count: todayRecords.total, limit: AD_CONFIG.rewarded.dailyLimit });

      if (todayRecords.total >= AD_CONFIG.rewarded.dailyLimit) {
        log.warn('report', '今日激励视频观看次数已达上限', { userId, count: todayRecords.total });
        return {
          code: -1,
          message: '今日观看次数已达上限',
        };
      }
    }

    const record = {
      userId,
      adType,
      reward: 0,
      createTime: db.serverDate(),
    };

    if (adType === 'rewarded' && AD_CONFIG.rewarded.reward > 0 && user.userType === 'A') {
      record.reward = AD_CONFIG.rewarded.reward;
      log.info('report', 'A类用户获得激励视频奖励', { userId, reward: record.reward });
    } else if (adType === 'rewarded' && user.userType !== 'A') {
      log.debug('report', 'B类用户无奖励', { userId, userType: user.userType });
    }

    await adRecordsCollection.add(record);
    log.info('report', '广告记录已保存', { userId, adType, reward: record.reward });

    if (record.reward > 0) {
      await usersCollection.doc(userId).update({
        commission: _.inc(record.reward),
        updateTime: db.serverDate(),
      });
      log.info('report', '佣金已发放', { userId, reward: record.reward });
    }

    log.success('report', '广告上报成功', { userId, adType, reward: record.reward });
    return {
      code: 0,
      message: '上报成功',
      data: {
        reward: record.reward,
      },
    };
  } catch (error) {
    log.fail('report', '上报广告失败', { userId, adType, error: error.message, stack: error.stack });
    return {
      code: -1,
      message: '上报失败',
      error: error.message,
    };
  }
};

/**
 * 获取广告配置
 */
exports.getConfig = async (event) => {
  try {
    log.debug('getConfig', '获取广告配置');
    return {
      code: 0,
      message: '获取成功',
      data: AD_CONFIG,
    };
  } catch (error) {
    log.fail('getConfig', '获取广告配置失败', { error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * 获取广告统计（管理员）
 * @param {Object} event - 云函数调用参数
 * @param {string} event.startDate - 开始日期
 * @param {string} event.endDate - 结束日期
 */
exports.getStatistics = async (event) => {
  const { startDate, endDate } = event;

  try {
    log.start('getStatistics', '获取广告统计请求', { startDate, endDate });

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const records = await adRecordsCollection
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .get();

    const data = records.data || [];

    const statistics = {
      rewarded: {
        count: 0,
        reward: 0,
      },
      banner: {
        count: 0,
      },
      interstitial: {
        count: 0,
      },
    };

    data.forEach(r => {
      if (statistics[r.adType]) {
        statistics[r.adType].count++;
        if (r.reward) {
          statistics[r.adType].reward += r.reward;
        }
      }
    });

    log.success('getStatistics', '获取广告统计成功', {
      totalRecords: data.length,
      rewarded: statistics.rewarded,
      banner: statistics.banner,
      interstitial: statistics.interstitial,
    });

    return {
      code: 0,
      message: '获取成功',
      data: statistics,
    };
  } catch (error) {
    log.fail('getStatistics', '获取广告统计失败', { startDate, endDate, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * HTTP触发器入口函数，通过action字段路由到不同方法
 * @param {Object} event - 云函数调用参数
 * @param {string} event.action - 操作类型（report/getConfig/getStatistics）
 * @param {Object} [event.headers] - HTTP请求头（HTTP触发器调用时存在）
 * @returns {Object} 操作结果
 */
exports.main = async (event) => {
  let params = event;

  if (event.headers && event.body) {
    try {
      const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      params = { ...body, headers: event.headers };
      log.debug('main', 'HTTP触发器调用', { action: params.action });
    } catch (e) {
      log.error('main', '请求参数解析失败', { error: e.message });
      return { code: -1, message: '请求参数解析失败' };
    }
  }

  const { action } = params;
  const actions = { report: exports.report, getConfig: exports.getConfig, getStatistics: exports.getStatistics };

  log.debug('main', '收到请求', { action });

  if (!action || !actions[action]) {
    log.warn('main', '未知操作', { action });
    return { code: -1, message: `未知操作: ${action}` };
  }

  if (action === 'getStatistics' && !verifyAdminToken(params)) {
    log.warn('main', '管理员验证失败', { action });
    return { code: -1, message: '管理员验证失败' };
  }

  return await actions[action](params);
};
