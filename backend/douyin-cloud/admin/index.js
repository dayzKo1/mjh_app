import { dySDK } from '@open-dy/node-server-sdk';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

/**
 * 验证管理员Token
 */
function verifyAdminToken(params) {
  if (!ADMIN_TOKEN) return false;
  const token = params.adminToken || '';
  return token === ADMIN_TOKEN;
}

/**
 * 验证管理员Token有效性
 */
async function verifyToken(params, context, db, _) {
  try {
    const token = params.adminToken || '';

    if (!token || !verifyAdminToken(params)) {
      return { code: -1, message: 'Token无效', data: { valid: false } };
    }

    return { code: 0, message: '验证成功', data: { valid: true } };
  } catch (error) {
    return { code: -1, message: '验证失败', data: { valid: false } };
  }
}

/**
 * 获取用户列表
 * 支持分页、按类型筛选、按昵称搜索
 */
async function getUserList(params, context, db, _) {
  const { page = 1, pageSize = 20, userType, keyword } = params;

  try {
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

    const usersCollection = db.collection('users');
    const result = await usersCollection
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const total = await usersCollection.where(query).count();

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
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取用户详情
 * 包含邀请人信息、一级邀请列表、游戏记录、提现记录
 */
async function getUserDetail(params, context, db, _) {
  const { userId } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return { code: -1, message: '用户不存在' };
    }

    const user = userResult.data;

    let inviter = null;
    if (user.inviterId) {
      const inviterResult = await usersCollection.doc(user.inviterId).get();
      if (inviterResult.data) {
        inviter = {
          _id: inviterResult.data._id,
          nickName: inviterResult.data.nickName,
          userType: inviterResult.data.userType,
        };
      }
    }

    const level1Result = await usersCollection.where({ inviterId: userId }).get();
    const level1Users = level1Result.data || [];

    const gameResult = await db.collection('game_records')
      .where({ userId })
      .orderBy('createTime', 'desc')
      .limit(20)
      .get();
    const gameRecords = gameResult.data || [];

    const withdrawResult = await db.collection('withdraw_records')
      .where({ userId })
      .orderBy('applyTime', 'desc')
      .limit(20)
      .get();
    const withdrawRecords = withdrawResult.data || [];

    return {
      code: 0,
      message: '获取成功',
      data: {
        user,
        inviter,
        inviteList: { level1: level1Users },
        gameRecords,
        withdrawRecords,
      },
    };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取数据统计
 * 包含用户统计、游戏统计、提现统计、广告统计
 */
async function getStatistics(params, context, db, _) {
  const { startDate, endDate } = params;

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const usersCollection = db.collection('users');
    const totalUsers = await usersCollection.count();
    const aTypeUsers = await usersCollection.where({ userType: 'A' }).count();
    const bTypeUsers = await usersCollection.where({ userType: 'B' }).count();

    const newUsers = await usersCollection
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .count();

    const gameRecords = await db.collection('game_records')
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .get();

    const totalGames = gameRecords.data || [];
    const totalScore = totalGames.reduce((sum, r) => sum + r.score, 0);

    const withdrawRecords = await db.collection('withdraw_records')
      .where({
        applyTime: _.and(_.gte(start), _.lte(end)),
        status: 'approved',
      })
      .get();

    const approvedWithdraws = withdrawRecords.data || [];
    const totalWithdraw = approvedWithdraws.reduce((sum, r) => sum + r.amount, 0);

    const adRecords = await db.collection('ad_records')
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

    return { code: 0, message: '获取成功', data: result };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 更新用户类型
 * A→B降级时：拒绝所有待审核提现并退还佣金，使用_.inc(-currentCommission)清零佣金余额
 */
async function updateUserType(params, context, db, _) {
  const { userId, userType } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }
    if (!['A', 'B'].includes(userType)) {
      return { code: -1, message: '用户类型无效' };
    }

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return { code: -1, message: '用户不存在' };
    }

    const currentUser = userResult.data;

    if (currentUser.userType === 'A' && userType === 'B') {
      const withdrawRecordsCollection = db.collection('withdraw_records');
      const pendingWithdraws = await withdrawRecordsCollection
        .where({
          userId,
          status: 'pending',
        })
        .get();

      const pendingRecords = pendingWithdraws.data || [];
      let totalPendingAmount = 0;

      for (const record of pendingRecords) {
        totalPendingAmount += record.amount;
        await withdrawRecordsCollection.doc(record._id).update({
          status: 'rejected',
          processTime: db.serverDate(),
          reason: '用户被降级为B类，提现申请自动拒绝',
        });
        await usersCollection.doc(userId).update({
          commission: _.inc(record.amount),
          updateTime: db.serverDate(),
        });
      }

      const currentCommission = currentUser.commission || 0;
      await usersCollection.doc(userId).update({
        userType: 'B',
        commission: _.inc(-currentCommission),
        updateTime: db.serverDate(),
      });

      return {
        code: 0,
        message: '降级成功，已清零佣金并拒绝所有待审核提现',
        data: {
          rejectedCount: pendingRecords.length,
          refundedAmount: totalPendingAmount,
        },
      };
    } else {
      await usersCollection.doc(userId).update({
        userType,
        updateTime: db.serverDate(),
      });

      return { code: 0, message: '更新成功' };
    }
  } catch (error) {
    return { code: -1, message: '更新失败', error: error.message };
  }
}

/**
 * 获取提现统计
 * 包含提现记录列表和汇总统计
 */
async function getWithdrawStatistics(params, context, db, _) {
  const { status } = params;

  try {
    let query = {};
    if (status) {
      query.status = status;
    }

    const withdrawRecordsCollection = db.collection('withdraw_records');
    const records = await withdrawRecordsCollection
      .where(query)
      .orderBy('applyTime', 'desc')
      .limit(100)
      .get();

    const data = records.data || [];

    const userIds = [...new Set(data.map(r => r.userId))];
    const usersCollection = db.collection('users');
    const usersResult = await usersCollection.where({
      _id: _.in(userIds),
    }).get();

    const usersMap = {};
    (usersResult.data || []).forEach(u => {
      usersMap[u._id] = u;
    });

    const recordsWithUser = data.map(r => ({
      ...r,
      user: usersMap[r.userId] || {},
    }));

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

    return {
      code: 0,
      message: '获取成功',
      data: {
        records: recordsWithUser,
        statistics,
      },
    };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 抖音云函数入口
 * 所有操作需验证管理员权限
 */
export default async function(params, context) {
  const dyContext = dySDK.context(context);
  const db = dyContext.database();
  const _ = db.command;

  if (!verifyAdminToken(params)) {
    return { code: -403, message: '无权限访问' };
  }

  const { action } = params;

  const actions = {
    verifyToken,
    getUserList,
    getUserDetail,
    getStatistics,
    updateUserType,
    getWithdrawStatistics,
  };

  if (!action || !actions[action]) {
    return { code: -1, message: `未知操作: ${action}` };
  }

  return await actions[action](params, context, db, _);
}
