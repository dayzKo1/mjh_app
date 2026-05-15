/**
 * 游戏云函数 - 处理游戏记录、排行榜等
 */

const cloud = require('@cloudbase/node-sdk');
const { createLogger } = require('../shared/logger');

const log = createLogger('game');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const _ = db.command;
const gameRecordsCollection = db.collection('game_records');
const usersCollection = db.collection('users');

const GAME_CONFIG = {
  maxScore: 10000,
  maxLevel: 100,
  maxTime: 3600,
  maxRecordsPerHour: 100,
  maxCommissionPerDay: 100,
};

/**
 * 保存游戏记录
 * 包含参数校验、频率限制、分佣上限检查
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {number} event.level - 关卡
 * @param {number} event.score - 得分
 * @param {number} event.time - 用时（秒）
 */
exports.saveRecord = async (event) => {
  const { userId, level, score, time } = event;

  try {
    log.start('saveRecord', '保存游戏记录请求', { userId, level, score, time });

    if (!userId || typeof userId !== 'string') {
      log.warn('saveRecord', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }
    if (!Number.isInteger(level) || level < 1 || level > GAME_CONFIG.maxLevel) {
      log.warn('saveRecord', '关卡无效', { level, maxLevel: GAME_CONFIG.maxLevel });
      return { code: -1, message: '关卡无效' };
    }
    if (!Number.isInteger(score) || score < 0 || score > GAME_CONFIG.maxScore) {
      log.warn('saveRecord', '得分无效', { score, maxScore: GAME_CONFIG.maxScore });
      return { code: -1, message: '得分无效' };
    }
    if (typeof time !== 'number' || time < 0 || time > GAME_CONFIG.maxTime) {
      log.warn('saveRecord', '用时无效', { time, maxTime: GAME_CONFIG.maxTime });
      return { code: -1, message: '用时无效' };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRecords = await gameRecordsCollection
      .where({
        userId,
        createTime: _.gte(oneHourAgo),
      })
      .count();

    log.debug('saveRecord', '频率检查', { userId, recentCount: recentRecords.total, limit: GAME_CONFIG.maxRecordsPerHour });

    if (recentRecords.total >= GAME_CONFIG.maxRecordsPerHour) {
      log.warn('saveRecord', '操作过于频繁', { userId, recentCount: recentRecords.total });
      return { code: -1, message: '操作过于频繁，请稍后再试' };
    }

    const record = {
      userId,
      level,
      score,
      time,
      createTime: db.serverDate(),
    };

    await gameRecordsCollection.add(record);
    log.info('saveRecord', '游戏记录已保存', { userId, level, score });

    const userResult = await usersCollection.doc(userId).get();
    if (userResult.data) {
      const currentLevel = userResult.data.level;
      const updateData = {
        score: _.inc(score),
        updateTime: db.serverDate(),
      };

      if (level > currentLevel) {
        updateData.level = level;
        log.info('saveRecord', '用户关卡提升', { userId, fromLevel: currentLevel, toLevel: level });
      }

      await usersCollection.doc(userId).update(updateData);
      log.debug('saveRecord', '用户分数已更新', { userId, addedScore: score });

      if (userResult.data.userType === 'A') {
        log.info('saveRecord', 'A类用户，触发分佣计算', { userId, score });
        await calculateCommission(userId, score, userResult.data);
      } else {
        log.debug('saveRecord', 'B类用户，跳过分佣', { userId, userType: userResult.data.userType });
      }
    }

    log.success('saveRecord', '保存游戏记录成功', { userId, level, score });
    return {
      code: 0,
      message: '保存成功',
    };
  } catch (error) {
    log.fail('saveRecord', '保存游戏记录失败', { userId, error: error.message, stack: error.stack });
    return {
      code: -1,
      message: '保存失败',
      error: error.message,
    };
  }
};

/**
 * 计算分佣
 * 包含每日分佣上限检查，使用原子操作确保数据一致性
 * @param {string} userId - 用户ID
 * @param {number} amount - 游戏得分
 * @param {Object} userData - 用户数据（避免重复查询）
 */
async function calculateCommission(userId, amount, userData) {
  try {
    log.start('calculateCommission', '开始计算分佣', { userId, amount, hasInviter: !!userData?.inviterId });

    if (!userData || !userData.inviterId) {
      log.debug('calculateCommission', '无邀请人，跳过分佣', { userId });
      return;
    }

    const totalCommissionRate = 0.1 + 0.05 + 0.02;
    const potentialCommission = Math.round(amount * totalCommissionRate * 0.01 * 100) / 100;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const commissionRecordsCollection = db.collection('commission_records');
    const todayCommissions = await commissionRecordsCollection
      .where({
        triggerUserId: userId,
        createTime: _.gte(today),
      })
      .get();

    const todayTotal = (todayCommissions.data || []).reduce((sum, r) => sum + r.amount, 0);
    log.debug('calculateCommission', '今日分佣统计', { userId, todayTotal, potentialCommission, limit: GAME_CONFIG.maxCommissionPerDay });

    if (todayTotal + potentialCommission > GAME_CONFIG.maxCommissionPerDay) {
      log.warn('calculateCommission', '今日分佣已达上限', { userId, todayTotal, potentialCommission, limit: GAME_CONFIG.maxCommissionPerDay });
      return;
    }

    const commissionRecord = {
      triggerUserId: userId,
      amount: potentialCommission,
      createTime: db.serverDate(),
    };

    const level1Id = userData.inviterId;
    log.debug('calculateCommission', '查询一级邀请人', { userId, level1Id });
    const level1User = await usersCollection.doc(level1Id).get();

    if (level1User.data && level1User.data.userType === 'A') {
      const commission1 = Math.round(amount * 0.1 * 0.01 * 100) / 100;
      log.info('calculateCommission', '一级分佣', { userId, level1Id, commission: commission1, rate: '10%' });

      await usersCollection.doc(level1Id).update({
        commission: _.inc(commission1),
        updateTime: db.serverDate(),
      });
      commissionRecord.level1Id = level1Id;
      commissionRecord.level1Amount = commission1;

      if (level1User.data.inviterId) {
        const level2Id = level1User.data.inviterId;
        log.debug('calculateCommission', '查询二级邀请人', { userId, level2Id });
        const level2User = await usersCollection.doc(level2Id).get();

        if (level2User.data && level2User.data.userType === 'A') {
          const commission2 = Math.round(amount * 0.05 * 0.01 * 100) / 100;
          log.info('calculateCommission', '二级分佣', { userId, level2Id, commission: commission2, rate: '5%' });

          await usersCollection.doc(level2Id).update({
            commission: _.inc(commission2),
            updateTime: db.serverDate(),
          });
          commissionRecord.level2Id = level2Id;
          commissionRecord.level2Amount = commission2;

          if (level2User.data.inviterId) {
            const level3Id = level2User.data.inviterId;
            log.debug('calculateCommission', '查询三级邀请人', { userId, level3Id });
            const level3User = await usersCollection.doc(level3Id).get();

            if (level3User.data && level3User.data.userType === 'A') {
              const commission3 = Math.round(amount * 0.02 * 0.01 * 100) / 100;
              log.info('calculateCommission', '三级分佣', { userId, level3Id, commission: commission3, rate: '2%' });

              await usersCollection.doc(level3Id).update({
                commission: _.inc(commission3),
                updateTime: db.serverDate(),
              });
              commissionRecord.level3Id = level3Id;
              commissionRecord.level3Amount = commission3;
            } else {
              log.debug('calculateCommission', '三级邀请人不存在或非A类', { userId, level3Id });
            }
          }
        } else {
          log.debug('calculateCommission', '二级邀请人不存在或非A类', { userId, level2Id });
        }
      }
    } else {
      log.debug('calculateCommission', '一级邀请人不存在或非A类', { userId, level1Id });
    }

    await commissionRecordsCollection.add(commissionRecord);
    log.success('calculateCommission', '分佣计算完成', {
      userId,
      totalCommission: potentialCommission,
      level1: commissionRecord.level1Amount || 0,
      level2: commissionRecord.level2Amount || 0,
      level3: commissionRecord.level3Amount || 0,
    });
  } catch (error) {
    log.fail('calculateCommission', '计算分佣失败', { userId, amount, error: error.message, stack: error.stack });
  }
}

/**
 * 获取排行榜
 * @param {Object} event - 云函数调用参数
 * @param {string} event.type - 排行榜类型（score/commission）
 * @param {number} event.limit - 数量限制
 */
exports.getRank = async (event) => {
  const { type = 'score', limit = 100 } = event;

  try {
    log.start('getRank', '获取排行榜请求', { type, limit });

    const result = await usersCollection
      .where({
        userType: 'A',
      })
      .orderBy(type, 'desc')
      .limit(limit)
      .field({
        _id: true,
        nickName: true,
        avatarUrl: true,
        score: true,
        commission: true,
      })
      .get();

    const data = (result.data || []).map(item => ({
      ...item,
      userId: item._id,
    }));

    log.success('getRank', '获取排行榜成功', { type, count: data.length });
    return {
      code: 0,
      message: '获取成功',
      data,
    };
  } catch (error) {
    log.fail('getRank', '获取排行榜失败', { type, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * 获取用户游戏记录
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {number} event.limit - 数量限制
 */
exports.getUserRecords = async (event) => {
  const { userId, limit = 50 } = event;

  try {
    log.start('getUserRecords', '获取用户游戏记录请求', { userId, limit });

    const result = await gameRecordsCollection
      .where({ userId })
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get();

    const records = result.data || [];
    const maxLevel = records.length > 0 ? Math.max(...records.map(r => r.level || 0)) : 0;
    const totalScore = records.reduce((sum, r) => sum + (r.score || 0), 0);

    log.success('getUserRecords', '获取用户游戏记录成功', { userId, count: records.length, maxLevel, totalScore });
    return {
      code: 0,
      message: '获取成功',
      data: {
        records,
        maxLevel,
        totalScore,
        totalGames: records.length,
      },
    };
  } catch (error) {
    log.fail('getUserRecords', '获取游戏记录失败', { userId, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * 获取关卡配置
 * @param {Object} event - 云函数调用参数
 * @param {number} event.level - 关卡
 */
exports.getLevelConfig = async (event) => {
  const { level } = event;

  try {
    log.debug('getLevelConfig', '获取关卡配置', { level });

    const config = {
      level,
      iconCount: Math.min(8 + Math.floor(level / 2), 27),
      layers: level <= 2 ? 3 : level <= 5 ? 4 : 5,
      cardsPerIcon: 3,
    };

    return {
      code: 0,
      message: '获取成功',
      data: config,
    };
  } catch (error) {
    log.fail('getLevelConfig', '获取关卡配置失败', { level, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * 验证用户身份
 * 确保请求来自有效用户
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 用户是否有效
 */
async function verifyUser(userId) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  try {
    const result = await usersCollection.doc(userId).get();
    return !!result.data;
  } catch {
    return false;
  }
}

/**
 * HTTP触发器入口函数
 * 通过action字段路由到不同方法，支持HTTP触发器调用
 * 需要验证用户身份的操作：saveRecord, getUserRecords
 * @param {Object} event - 云函数调用参数
 * @param {string} event.action - 操作类型
 * @param {Object} event.headers - HTTP请求头（触发器调用时）
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
  const actions = {
    saveRecord: exports.saveRecord,
    getUserRecords: exports.getUserRecords,
    getRank: exports.getRank,
    getLevelConfig: exports.getLevelConfig,
  };

  if (!action || !actions[action]) {
    log.warn('main', '未知操作', { action });
    return { code: -1, message: `未知操作: ${action}` };
  }

  const AUTH_REQUIRED_ACTIONS = ['saveRecord', 'getUserRecords'];
  if (AUTH_REQUIRED_ACTIONS.includes(action)) {
    const userId = params.userId;
    const isValid = await verifyUser(userId);
    if (!isValid) {
      log.warn('main', '用户身份验证失败', { action, userId });
      return { code: -1, message: '用户身份验证失败' };
    }
    log.debug('main', '用户身份验证通过', { action, userId });
  }

  return await actions[action](params);
};
