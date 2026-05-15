/**
 * 管理后台云函数 - 支持HTTP触发器调用
 * 
 * 小程序内部调用：直接调用 exports.xxx(event)
 * HTTP触发器调用：通过 action 字段路由到对应方法
 */

const cloud = require('@cloudbase/node-sdk');
const { verifyAdminToken } = require('../shared/config');
const { createLogger } = require('../shared/logger');

const log = createLogger('admin');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const _ = db.command;
const usersCollection = db.collection('users');
const gameRecordsCollection = db.collection('game_records');
const withdrawRecordsCollection = db.collection('withdraw_records');
const adRecordsCollection = db.collection('ad_records');

/**
 * 获取用户列表
 */
async function getUserList(event) {
  const { page = 1, pageSize = 20, userType, keyword } = event;

  try {
    log.start('getUserList', '获取用户列表请求', { page, pageSize, userType, keyword });

    const skip = (page - 1) * pageSize;
    let query = {};

    if (userType) {
      query.userType = userType;
    }

    if (keyword) {
      query = {
        ...query,
        nickName: db.RegExp({
          regexp: keyword,
          options: 'i',
        }),
      };
    }

    const result = await usersCollection
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const total = await usersCollection.where(query).count();

    log.success('getUserList', '获取用户列表成功', { page, pageSize, count: (result.data || []).length, total: total.total });
    return {
      code: 0,
      message: '获取成功',
      data: {
        list: result.data || [],
        total: total.total,
        page,
        pageSize,
      },
    };
  } catch (error) {
    log.fail('getUserList', '获取用户列表失败', { page, pageSize, userType, keyword, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
}

/**
 * 获取数据统计
 */
async function getStatistics(event) {
  const { startDate, endDate } = event;

  try {
    log.start('getStatistics', '获取数据统计请求', { startDate, endDate });

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const totalUsers = await usersCollection.count();
    const aTypeUsers = await usersCollection.where({ userType: 'A' }).count();
    const bTypeUsers = await usersCollection.where({ userType: 'B' }).count();

    const newUsers = await usersCollection
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .count();

    const gameRecords = await gameRecordsCollection
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .get();

    const totalGames = gameRecords.data || [];
    const totalScore = totalGames.reduce((sum, r) => sum + r.score, 0);

    const withdrawRecords = await withdrawRecordsCollection
      .where({
        applyTime: _.and(_.gte(start), _.lte(end)),
        status: 'approved',
      })
      .get();

    const approvedWithdraws = withdrawRecords.data || [];
    const totalWithdraw = approvedWithdraws.reduce((sum, r) => sum + r.amount, 0);

    const adRecords = await adRecordsCollection
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .get();

    const totalAds = adRecords.data || [];
    const adReward = totalAds.reduce((sum, r) => sum + (r.reward || 0), 0);

    const result = {
      users: {
        total: totalUsers.total,
        aType: aTypeUsers.total,
        bType: bTypeUsers.total,
        newUsers: newUsers.total,
      },
      games: {
        total: totalGames.length,
        totalScore,
      },
      withdraw: {
        total: totalWithdraw,
        count: approvedWithdraws.length,
      },
      ads: {
        total: totalAds.length,
        reward: adReward,
      },
    };

    log.success('getStatistics', '获取数据统计成功', result);
    return {
      code: 0,
      message: '获取成功',
      data: result,
    };
  } catch (error) {
    log.fail('getStatistics', '获取数据统计失败', { startDate, endDate, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
}

/**
 * 更新用户类型
 * A→B降级时：拒绝所有待审核提现并退还佣金，清零佣金余额
 * B→A升级时：无特殊处理
 */
async function updateUserType(event) {
  const { userId, userType } = event;

  try {
    log.start('updateUserType', '更新用户类型请求', { userId, userType });

    if (!userId || typeof userId !== 'string') {
      log.warn('updateUserType', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }
    if (!['A', 'B'].includes(userType)) {
      log.warn('updateUserType', '用户类型无效', { userType });
      return { code: -1, message: '用户类型无效' };
    }

    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      log.warn('updateUserType', '用户不存在', { userId });
      return { code: -1, message: '用户不存在' };
    }

    const currentUser = userResult.data;
    log.debug('updateUserType', '用户当前信息', { userId, currentType: currentUser.userType, commission: currentUser.commission });

    if (currentUser.userType === 'A' && userType === 'B') {
      log.info('updateUserType', '执行A→B降级', { userId });

      const pendingWithdraws = await withdrawRecordsCollection
        .where({
          userId,
          status: 'pending',
        })
        .get();

      const pendingRecords = pendingWithdraws.data || [];
      let totalPendingAmount = 0;

      log.debug('updateUserType', '待审核提现数量', { userId, count: pendingRecords.length });

      for (const record of pendingRecords) {
        totalPendingAmount += record.amount;
        log.info('updateUserType', '拒绝提现申请', { userId, recordId: record._id, amount: record.amount });
        await withdrawRecordsCollection.doc(record._id).update({
          status: 'rejected',
          processTime: db.serverDate(),
          reason: '用户被降级为B类，提现申请自动拒绝',
        });
      }

      log.info('updateUserType', '清零用户佣金', { userId, previousCommission: currentUser.commission });
      await usersCollection.doc(userId).update({
        userType: 'B',
        commission: 0,
        updateTime: db.serverDate(),
      });

      log.success('updateUserType', 'A→B降级成功', { userId, rejectedCount: pendingRecords.length, refundedAmount: totalPendingAmount });
      return {
        code: 0,
        message: '降级成功，已清零佣金并拒绝所有待审核提现',
        data: {
          rejectedCount: pendingRecords.length,
          refundedAmount: totalPendingAmount,
        },
      };
    } else {
      log.info('updateUserType', '执行用户类型更新', { userId, fromType: currentUser.userType, toType: userType });
      await usersCollection.doc(userId).update({
        userType,
        updateTime: db.serverDate(),
      });

      log.success('updateUserType', '更新用户类型成功', { userId, userType });
      return {
        code: 0,
        message: '更新成功',
      };
    }
  } catch (error) {
    log.fail('updateUserType', '更新用户类型失败', { userId, userType, error: error.message, stack: error.stack });
    return {
      code: -1,
      message: '更新失败',
      error: error.message,
    };
  }
}

/**
 * 获取提现统计
 */
async function getWithdrawStatistics(event) {
  const { status } = event;

  try {
    log.start('getWithdrawStatistics', '获取提现统计请求', { status });

    let query = {};
    if (status) {
      query.status = status;
    }

    const records = await withdrawRecordsCollection
      .where(query)
      .orderBy('applyTime', 'desc')
      .limit(100)
      .get();

    const data = records.data || [];

    const statistics = {
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
    };

    data.forEach(r => {
      statistics[r.status]++;
      if (r.status === 'approved') {
        statistics.totalAmount += r.amount;
      }
    });

    log.success('getWithdrawStatistics', '获取提现统计成功', { count: data.length, statistics });
    return {
      code: 0,
      message: '获取成功',
      data: {
        records: data,
        statistics,
      },
    };
  } catch (error) {
    log.fail('getWithdrawStatistics', '获取提现统计失败', { status, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
}

/**
 * 云函数入口 - 支持HTTP触发器
 * HTTP触发器通过 action 字段路由到对应方法
 */
exports.main = async (event) => {
  log.debug('main', '收到请求', { action: event.action });

  if (!verifyAdminToken(event)) {
    log.warn('main', '管理员权限验证失败', { action: event.action });
    return {
      code: -403,
      message: '无权限访问',
    };
  }

  const { action } = event;

  const actions = {
    getUserList,
    getStatistics,
    updateUserType,
    getWithdrawStatistics,
  };

  if (!action || !actions[action]) {
    log.warn('main', '未知操作', { action });
    return {
      code: -1,
      message: `未知操作: ${action}`,
    };
  }

  return await actions[action](event);
};

exports.getUserList = getUserList;
exports.getStatistics = getStatistics;
exports.updateUserType = updateUserType;
exports.getWithdrawStatistics = getWithdrawStatistics;
