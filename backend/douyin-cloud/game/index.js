import { dySDK } from '@open-dy/node-server-sdk';

const GAME_CONFIG = {
  maxScore: 10000,
  maxLevel: 100,
  maxTime: 3600,
  maxRecordsPerHour: 100,
  maxCommissionPerDay: 100,
};

/**
 * 计算分佣
 * 扁平化逐级独立检查：每级独立判断是否A类，上级不发放不影响下级
 */
async function calculateCommission(userId, amount, userData, db, _) {
  try {
    if (!userData || !userData.inviterId) {
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

    if (todayTotal + potentialCommission > GAME_CONFIG.maxCommissionPerDay) {
      return;
    }

    const commissionRecord = {
      triggerUserId: userId,
      amount: potentialCommission,
      createTime: db.serverDate(),
    };

    const usersCollection = db.collection('users');
    const inviterChain = [];
    let currentInviterId = userData.inviterId;

    for (let depth = 0; depth < 3 && currentInviterId; depth++) {
      const inviterUser = await usersCollection.doc(currentInviterId).get();

      if (!inviterUser.data) {
        break;
      }

      inviterChain.push({
        id: currentInviterId,
        userType: inviterUser.data.userType,
        nextInviterId: inviterUser.data.inviterId || '',
      });

      currentInviterId = inviterUser.data.inviterId || '';
    }

    const rates = [0.1, 0.05, 0.02];
    const levelKeys = [
      { idKey: 'level1Id', amountKey: 'level1Amount' },
      { idKey: 'level2Id', amountKey: 'level2Amount' },
      { idKey: 'level3Id', amountKey: 'level3Amount' },
    ];

    for (let i = 0; i < inviterChain.length; i++) {
      const inviter = inviterChain[i];

      if (inviter.userType === 'A') {
        const commission = Math.round(amount * rates[i] * 0.01 * 100) / 100;

        await usersCollection.doc(inviter.id).update({
          commission: _.inc(commission),
          updateTime: db.serverDate(),
        });

        commissionRecord[levelKeys[i].idKey] = inviter.id;
        commissionRecord[levelKeys[i].amountKey] = commission;
      }
    }

    await commissionRecordsCollection.add(commissionRecord);
  } catch (error) {
    console.error('[calculateCommission] 分佣计算失败', { userId, amount, error: error.message });
  }
}

/**
 * 保存游戏记录
 * 包含参数校验、频率限制、分佣上限检查
 */
async function saveRecord(params, context, db, _) {
  const { userId, level, score, time } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }
    if (!Number.isInteger(level) || level < 1 || level > GAME_CONFIG.maxLevel) {
      return { code: -1, message: '关卡无效' };
    }
    if (!Number.isInteger(score) || score < 0 || score > GAME_CONFIG.maxScore) {
      return { code: -1, message: '得分无效' };
    }
    if (typeof time !== 'number' || time < 0 || time > GAME_CONFIG.maxTime) {
      return { code: -1, message: '用时无效' };
    }

    const gameRecordsCollection = db.collection('game_records');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRecords = await gameRecordsCollection
      .where({
        userId,
        createTime: _.gte(oneHourAgo),
      })
      .count();

    if (recentRecords.total >= GAME_CONFIG.maxRecordsPerHour) {
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

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.doc(userId).get();
    if (userResult.data) {
      const currentLevel = userResult.data.level;
      const updateData = {
        score: _.inc(score),
        updateTime: db.serverDate(),
      };

      if (level > currentLevel) {
        updateData.level = level;
      }

      await usersCollection.doc(userId).update(updateData);

      if (userResult.data.userType === 'A') {
        await calculateCommission(userId, score, userResult.data, db, _);
      }
    }

    return { code: 0, message: '保存成功' };
  } catch (error) {
    return { code: -1, message: '保存失败', error: error.message };
  }
}

/**
 * 获取用户游戏记录
 */
async function getUserRecords(params, context, db, _) {
  const { userId, limit = 50 } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    const result = await db.collection('game_records')
      .where({ userId })
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get();

    const records = result.data || [];
    const maxLevel = records.length > 0 ? Math.max(...records.map(r => r.level || 0)) : 0;
    const totalScore = records.reduce((sum, r) => sum + (r.score || 0), 0);

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
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取排行榜
 */
async function getRank(params, context, db, _) {
  const { type = 'score', limit = 100 } = params;

  try {
    const result = await db.collection('users')
      .where({ userType: 'A' })
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

    return { code: 0, message: '获取成功', data };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取关卡配置
 */
async function getLevelConfig(params, context, db, _) {
  const { level } = params;

  try {
    const config = {
      level,
      iconCount: Math.min(8 + Math.floor(level / 2), 27),
      layers: level <= 2 ? 3 : level <= 5 ? 4 : 5,
      cardsPerIcon: 3,
    };

    return { code: 0, message: '获取成功', data: config };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 验证用户身份
 */
async function verifyUser(userId, db) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  try {
    const result = await db.collection('users').doc(userId).get();
    return !!result.data;
  } catch {
    return false;
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

  const actions = { saveRecord, getUserRecords, getRank, getLevelConfig };

  if (!action || !actions[action]) {
    return { code: -1, message: `未知操作: ${action}` };
  }

  const AUTH_REQUIRED_ACTIONS = ['saveRecord', 'getUserRecords'];
  if (AUTH_REQUIRED_ACTIONS.includes(action)) {
    const userId = params.userId;
    const isValid = await verifyUser(userId, db);
    if (!isValid) {
      return { code: -1, message: '用户身份验证失败' };
    }
  }

  return await actions[action](params, context, db, _);
}
