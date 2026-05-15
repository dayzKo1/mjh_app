import { dySDK } from '@open-dy/node-server-sdk';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const ADMIN_ACTIONS = ['process', 'getPendingList'];

const WITHDRAW_CONFIG = {
  minAmount: 1,
  maxAmount: 100,
  dailyLimit: 3,
};

/**
 * 验证管理员Token
 */
function verifyAdminToken(params) {
  if (!ADMIN_TOKEN) return false;
  const token = params.adminToken || '';
  return token === ADMIN_TOKEN;
}

/**
 * 申请提现
 * 先扣佣金再创建记录，使用乐观锁机制确保并发安全
 */
async function apply(params, context, db, _) {
  const { userId, amount } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return { code: -1, message: '提现金额无效' };
    }

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return { code: -1, message: '用户不存在' };
    }

    const user = userResult.data;

    if (user.userType !== 'A') {
      return { code: -1, message: 'B类用户不可提现' };
    }

    if (amount < WITHDRAW_CONFIG.minAmount) {
      return { code: -1, message: `最低提现金额为${WITHDRAW_CONFIG.minAmount}元` };
    }

    if (amount > WITHDRAW_CONFIG.maxAmount) {
      return { code: -1, message: `单次最高提现金额为${WITHDRAW_CONFIG.maxAmount}元` };
    }

    if (amount > user.commission) {
      return { code: -1, message: '佣金余额不足' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const withdrawRecordsCollection = db.collection('withdraw_records');
    const todayRecords = await withdrawRecordsCollection
      .where({
        userId,
        applyTime: _.gte(today),
        status: _.in(['pending', 'approved']),
      })
      .count();

    if (todayRecords.total >= WITHDRAW_CONFIG.dailyLimit) {
      return { code: -1, message: `每日最多提现${WITHDRAW_CONFIG.dailyLimit}次` };
    }

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
      return { code: -1, message: '佣金余额不足或已被其他操作占用' };
    }

    const record = {
      userId,
      amount,
      status: 'pending',
      applyTime: db.serverDate(),
      processTime: null,
      reason: '',
    };

    try {
      const result = await withdrawRecordsCollection.add(record);

      return {
        code: 0,
        message: '申请成功，等待审核',
        data: { recordId: result.id },
      };
    } catch (addError) {
      await usersCollection.doc(userId).update({
        commission: _.inc(amount),
        updateTime: db.serverDate(),
      });
      return { code: -1, message: '申请失败，请重试' };
    }
  } catch (error) {
    return { code: -1, message: '申请失败', error: error.message };
  }
}

/**
 * 获取提现记录
 */
async function getRecords(params, context, db, _) {
  const { userId, limit = 50 } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    const result = await db.collection('withdraw_records')
      .where({ userId })
      .orderBy('applyTime', 'desc')
      .limit(limit)
      .get();

    return {
      code: 0,
      message: '获取成功',
      data: result.data || [],
    };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 处理提现（管理员操作）
 * 使用乐观锁确保记录状态不被重复处理
 */
async function process(params, context, db, _) {
  const { recordId, status, reason = '' } = params;

  try {
    if (!recordId || typeof recordId !== 'string') {
      return { code: -1, message: '提现记录ID无效' };
    }
    if (!['approved', 'rejected'].includes(status)) {
      return { code: -1, message: '状态参数无效' };
    }

    const withdrawRecordsCollection = db.collection('withdraw_records');
    const recordResult = await withdrawRecordsCollection.doc(recordId).get();
    if (!recordResult.data) {
      return { code: -1, message: '提现记录不存在' };
    }

    const record = recordResult.data;

    const updateResult = await withdrawRecordsCollection
      .where({
        _id: recordId,
        status: 'pending',
      })
      .update({
        status,
        processTime: db.serverDate(),
        reason: reason || '',
      });

    if (updateResult.updated === 0) {
      return { code: -1, message: '该记录已被处理，请刷新页面' };
    }

    const usersCollection = db.collection('users');
    if (status === 'rejected') {
      await usersCollection.doc(record.userId).update({
        commission: _.inc(record.amount),
        updateTime: db.serverDate(),
      });
    } else {
      await usersCollection.doc(record.userId).update({
        totalWithdraw: _.inc(record.amount),
        updateTime: db.serverDate(),
      });
    }

    return { code: 0, message: '处理成功' };
  } catch (error) {
    return { code: -1, message: '处理失败', error: error.message };
  }
}

/**
 * 获取待审核提现列表（管理员）
 */
async function getPendingList(params, context, db, _) {
  const { limit = 100 } = params;

  try {
    const withdrawRecordsCollection = db.collection('withdraw_records');
    const result = await withdrawRecordsCollection
      .where({ status: 'pending' })
      .orderBy('applyTime', 'asc')
      .limit(limit)
      .get();

    const records = result.data || [];
    const userIds = [...new Set(records.map(r => r.userId))];
    const usersCollection = db.collection('users');
    const usersResult = await usersCollection.where({
      _id: _.in(userIds),
    }).get();

    const usersMap = {};
    (usersResult.data || []).forEach(u => {
      usersMap[u._id] = u;
    });

    const data = records.map(r => ({
      ...r,
      user: usersMap[r.userId] || {},
    }));

    return { code: 0, message: '获取成功', data };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 抖音云函数入口
 */
export default async function(params, context) {
  const dyContext = dySDK.context(context);
  const db = dyContext.database();
  const _ = db.command;

  const { action } = params;

  const actions = { apply, getRecords, process, getPendingList };

  if (!action || !actions[action]) {
    return { code: -1, message: `未知操作: ${action}` };
  }

  if (ADMIN_ACTIONS.includes(action)) {
    if (!verifyAdminToken(params)) {
      return { code: -1, message: '管理员权限验证失败' };
    }
  }

  return await actions[action](params, context, db, _);
}
