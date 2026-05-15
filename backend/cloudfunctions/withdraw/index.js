/**
 * 提现云函数 - 处理提现申请、审核等
 * 支持云函数调用和HTTP触发器调用
 */

const cloud = require('@cloudbase/node-sdk');
const { verifyAdminToken } = require('../shared/config');
const { createLogger } = require('../shared/logger');

const log = createLogger('withdraw');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const _ = db.command;
const withdrawRecordsCollection = db.collection('withdraw_records');
const usersCollection = db.collection('users');

const ADMIN_ACTIONS = ['process', 'getPendingList'];

const WITHDRAW_CONFIG = {
  minAmount: 1,
  maxAmount: 100,
  dailyLimit: 3,
};

/**
 * 申请提现
 * 使用乐观锁机制确保并发安全
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {number} event.amount - 提现金额
 * @returns {Object} 提现申请结果
 */
async function apply(event) {
  const { userId, amount } = event;

  try {
    log.start('apply', '申请提现请求', { userId, amount });

    if (!userId || typeof userId !== 'string') {
      log.warn('apply', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }
    if (typeof amount !== 'number' || amount <= 0) {
      log.warn('apply', '提现金额无效', { amount });
      return { code: -1, message: '提现金额无效' };
    }

    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      log.warn('apply', '用户不存在', { userId });
      return {
        code: -1,
        message: '用户不存在',
      };
    }

    const user = userResult.data;
    log.debug('apply', '用户信息', { userId, userType: user.userType, commission: user.commission });

    if (user.userType !== 'A') {
      log.warn('apply', 'B类用户不可提现', { userId, userType: user.userType });
      return {
        code: -1,
        message: 'B类用户不可提现',
      };
    }

    if (amount < WITHDRAW_CONFIG.minAmount) {
      log.warn('apply', '提现金额低于最低限制', { userId, amount, minAmount: WITHDRAW_CONFIG.minAmount });
      return {
        code: -1,
        message: `最低提现金额为${WITHDRAW_CONFIG.minAmount}元`,
      };
    }

    if (amount > WITHDRAW_CONFIG.maxAmount) {
      log.warn('apply', '提现金额超过最高限制', { userId, amount, maxAmount: WITHDRAW_CONFIG.maxAmount });
      return {
        code: -1,
        message: `单次最高提现金额为${WITHDRAW_CONFIG.maxAmount}元`,
      };
    }

    if (amount > user.commission) {
      log.warn('apply', '佣金余额不足', { userId, amount, commission: user.commission });
      return {
        code: -1,
        message: '佣金余额不足',
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = await withdrawRecordsCollection
      .where({
        userId,
        applyTime: _.gte(today),
      })
      .count();

    log.debug('apply', '今日提现次数检查', { userId, todayCount: todayRecords.total, limit: WITHDRAW_CONFIG.dailyLimit });

    if (todayRecords.total >= WITHDRAW_CONFIG.dailyLimit) {
      log.warn('apply', '今日提现次数已达上限', { userId, todayCount: todayRecords.total });
      return {
        code: -1,
        message: `每日最多提现${WITHDRAW_CONFIG.dailyLimit}次`,
      };
    }

    const record = {
      userId,
      amount,
      status: 'pending',
      applyTime: db.serverDate(),
      processTime: null,
      reason: '',
    };

    const result = await withdrawRecordsCollection.add(record);
    log.info('apply', '提现记录已创建', { userId, recordId: result.id, amount });

    log.debug('apply', '执行乐观锁扣减佣金', { userId, amount });
    const updateResult = await usersCollection
      .where({
        _id: userId,
        commission: _.gte(amount),
      })
      .update({
        commission: _.inc(-amount),
        updateTime: db.serverDate(),
      });

    if (updateResult.updated === 0) {
      log.warn('apply', '乐观锁扣减失败，删除提现记录', { userId, recordId: result.id, amount });
      await withdrawRecordsCollection.doc(result.id).remove();
      return {
        code: -1,
        message: '佣金余额不足或已被其他操作占用',
      };
    }

    log.success('apply', '提现申请成功', { userId, recordId: result.id, amount });
    return {
      code: 0,
      message: '申请成功，等待审核',
      data: {
        recordId: result.id,
      },
    };
  } catch (error) {
    log.fail('apply', '申请提现失败', { userId, amount, error: error.message, stack: error.stack });
    return {
      code: -1,
      message: '申请失败',
      error: error.message,
    };
  }
}

/**
 * 获取提现记录
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {number} event.limit - 数量限制
 * @returns {Object} 提现记录列表
 */
async function getRecords(event) {
  const { userId, limit = 50 } = event;

  try {
    log.start('getRecords', '获取提现记录请求', { userId, limit });

    const result = await withdrawRecordsCollection
      .where({ userId })
      .orderBy('applyTime', 'desc')
      .limit(limit)
      .get();

    log.success('getRecords', '获取提现记录成功', { userId, count: (result.data || []).length });
    return {
      code: 0,
      message: '获取成功',
      data: result.data || [],
    };
  } catch (error) {
    log.fail('getRecords', '获取提现记录失败', { userId, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
}

/**
 * 处理提现（管理员操作，需验证管理员权限）
 * 包含参数验证
 * @param {Object} event - 云函数调用参数
 * @param {string} event.recordId - 提现记录ID
 * @param {string} event.status - 状态（approved/rejected）
 * @param {string} event.reason - 拒绝原因
 * @returns {Object} 处理结果
 */
async function process(event) {
  const { recordId, status, reason = '' } = event;

  try {
    log.start('process', '处理提现请求', { recordId, status, reason });

    if (!recordId || typeof recordId !== 'string') {
      log.warn('process', '提现记录ID无效', { recordId });
      return { code: -1, message: '提现记录ID无效' };
    }
    if (!['approved', 'rejected'].includes(status)) {
      log.warn('process', '状态参数无效', { status });
      return { code: -1, message: '状态参数无效' };
    }

    const recordResult = await withdrawRecordsCollection.doc(recordId).get();
    if (!recordResult.data) {
      log.warn('process', '提现记录不存在', { recordId });
      return {
        code: -1,
        message: '提现记录不存在',
      };
    }

    const record = recordResult.data;
    log.debug('process', '提现记录信息', { recordId, userId: record.userId, amount: record.amount, currentStatus: record.status });

    if (record.status !== 'pending') {
      log.warn('process', '提现已处理', { recordId, currentStatus: record.status });
      return {
        code: -1,
        message: '该提现已处理',
      };
    }

    await withdrawRecordsCollection.doc(recordId).update({
      status,
      processTime: db.serverDate(),
      reason,
    });

    if (status === 'rejected') {
      log.info('process', '提现被拒绝，退还佣金', { recordId, userId: record.userId, amount: record.amount });
      await usersCollection.doc(record.userId).update({
        commission: _.inc(record.amount),
        updateTime: db.serverDate(),
      });
    } else {
      log.info('process', '提现已通过，更新累计提现', { recordId, userId: record.userId, amount: record.amount });
      await usersCollection.doc(record.userId).update({
        totalWithdraw: _.inc(record.amount),
        updateTime: db.serverDate(),
      });
    }

    log.success('process', '处理提现成功', { recordId, status, amount: record.amount });
    return {
      code: 0,
      message: '处理成功',
    };
  } catch (error) {
    log.fail('process', '处理提现失败', { recordId, status, error: error.message, stack: error.stack });
    return {
      code: -1,
      message: '处理失败',
      error: error.message,
    };
  }
}

/**
 * 获取待审核提现列表（管理员）
 * @param {Object} event - 云函数调用参数
 * @param {number} event.limit - 数量限制
 * @returns {Object} 待审核提现列表
 */
async function getPendingList(event) {
  const { limit = 100 } = event;

  try {
    log.start('getPendingList', '获取待审核提现列表请求', { limit });

    const result = await withdrawRecordsCollection
      .where({ status: 'pending' })
      .orderBy('applyTime', 'asc')
      .limit(limit)
      .get();

    const records = result.data || [];
    const userIds = [...new Set(records.map(r => r.userId))];
    const usersResult = await usersCollection
      .where({
        _id: _.in(userIds),
      })
      .get();

    const usersMap = {};
    (usersResult.data || []).forEach(u => {
      usersMap[u._id] = u;
    });

    const data = records.map(r => ({
      ...r,
      user: usersMap[r.userId] || {},
    }));

    log.success('getPendingList', '获取待审核提现列表成功', { count: data.length });
    return {
      code: 0,
      message: '获取成功',
      data,
    };
  } catch (error) {
    log.fail('getPendingList', '获取待审核列表失败', { error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
}

/** 操作方法映射表 */
const actions = { apply, getRecords, process, getPendingList };

/**
 * HTTP触发器入口函数，通过action字段路由到不同方法
 * 管理员操作（process）需验证adminToken
 * @param {Object} event - 云函数调用参数
 * @param {string} event.action - 操作类型（apply/getRecords/process/getPendingList）
 * @param {Object} event.headers - HTTP请求头（HTTP触发器调用时使用）
 * @param {string} event.headers.adminToken - 管理员Token
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

  log.debug('main', '收到请求', { action });

  if (!action || !actions[action]) {
    log.warn('main', '未知操作', { action });
    return { code: -1, message: `未知操作: ${action}` };
  }

  if (ADMIN_ACTIONS.includes(action)) {
    if (!verifyAdminToken(params)) {
      log.warn('main', '管理员权限验证失败', { action });
      return { code: -1, message: '管理员权限验证失败' };
    }
    log.debug('main', '管理员权限验证通过', { action });
  }

  return await actions[action](params);
};

exports.apply = apply;
exports.getRecords = getRecords;
exports.process = process;
exports.getPendingList = getPendingList;
