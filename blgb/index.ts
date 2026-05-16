import { dySDK } from '@open-dy/node-server-sdk';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const GAME_CONFIG = {
  maxScore: 10000,
  maxLevel: 100,
  maxTime: 3600,
  maxRecordsPerHour: 100,
  maxCommissionPerDay: 100,
};

const WITHDRAW_CONFIG = {
  minAmount: 1,
  maxAmount: 100,
  dailyLimit: 3,
};

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
 * 验证管理员Token
 */
function verifyAdminToken(params: any): boolean {
  if (!ADMIN_TOKEN) return false;
  const token = params.adminToken || '';
  return token === ADMIN_TOKEN;
}

/**
 * 用户登录
 * 抖音云免登录：通过context自动获取openId
 */
async function login(params: any, context: any, db: any, _: any) {
  try {
    const dyContext = dySDK.context(context);
    const ctx = dyContext.getContext();
    const openId = ctx.openId || '';

    if (!openId || typeof openId !== 'string') {
      return { code: -1, message: 'openId无效，请重新打开小游戏' };
    }

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.where({ openId }).limit(1).get();

    let user;
    if (userResult.data && userResult.data.length > 0) {
      user = userResult.data[0];
      await usersCollection.doc(user._id).update({
        lastLoginTime: db.serverDate(),
        updateTime: db.serverDate(),
      });
    } else {
      const newUser = {
        openId,
        nickName: '',
        avatarUrl: '',
        userType: 'B',
        inviterId: '',
        level: 1,
        score: 0,
        commission: 0,
        totalWithdraw: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        lastLoginTime: db.serverDate(),
      };
      const result = await usersCollection.add(newUser);
      user = { ...newUser, _id: result.id };
    }

    return { code: 0, message: '登录成功', data: user };
  } catch (error: any) {
    return { code: -1, message: '登录失败', error: error.message };
  }
}

/**
 * 获取用户信息
 */
async function getInfo(params: any, context: any, db: any, _: any) {
  const { userId } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    const result = await db.collection('users').doc(userId).get();

    if (!result.data) {
      return { code: -1, message: '用户不存在' };
    }

    return { code: 0, message: '获取成功', data: result.data };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 更新用户信息
 * 仅允许更新安全字段
 */
async function updateInfo(params: any, context: any, db: any, _: any) {
  const { userId, data } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }
    if (!data || typeof data !== 'object') {
      return { code: -1, message: '更新数据无效' };
    }

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return { code: -1, message: '用户不存在' };
    }

    const ALLOWED_FIELDS = ['nickName', 'avatarUrl'];
    const updateData: any = { updateTime: db.serverDate() };

    for (const field of ALLOWED_FIELDS) {
      if (data[field] !== undefined) {
        if (field === 'nickName' && typeof data[field] === 'string') {
          const isSafe = await checkContentSecurity(data[field]);
          if (!isSafe) {
            return { code: -1, message: '昵称包含违规内容，请修改' };
          }
        }
        updateData[field] = data[field];
      }
    }

    await usersCollection.doc(userId).update(updateData);

    return { code: 0, message: '更新成功' };
  } catch (error: any) {
    return { code: -1, message: '更新失败', error: error.message };
  }
}

/**
 * 绑定邀请人
 * 包含循环引用检测
 */
async function bindInviter(params: any, context: any, db: any, _: any) {
  const { userId, inviterId } = params;

  try {
    if (!userId || !inviterId || typeof userId !== 'string' || typeof inviterId !== 'string') {
      return { code: -1, message: '参数无效' };
    }

    const usersCollection = db.collection('users');

    const inviterResult = await usersCollection.doc(inviterId).get();
    if (!inviterResult.data) {
      return { code: -1, message: '邀请人不存在' };
    }

    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return { code: -1, message: '用户不存在' };
    }

    if (userResult.data.inviterId) {
      return { code: -1, message: '已有邀请人，不可重复绑定' };
    }

    if (userId === inviterId) {
      return { code: -1, message: '不可邀请自己' };
    }

    const visited = new Set([userId]);
    let currentInviter = inviterResult.data;
    while (currentInviter) {
      if (visited.has(currentInviter._id)) {
        return { code: -1, message: '绑定后会产生循环引用，不可绑定' };
      }
      visited.add(currentInviter._id);
      if (currentInviter.inviterId) {
        const nextInviter = await usersCollection.doc(currentInviter.inviterId).get();
        currentInviter = nextInviter.data;
      } else {
        break;
      }
    }

    await usersCollection.doc(userId).update({
      inviterId,
      userType: 'A',
      updateTime: db.serverDate(),
    });

    return { code: 0, message: '绑定成功' };
  } catch (error: any) {
    return { code: -1, message: '绑定失败', error: error.message };
  }
}

/**
 * 获取邀请列表
 * 包含三级邀请关系查询
 */
async function getInviteList(params: any, context: any, db: any, _: any) {
  const { userId } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    const usersCollection = db.collection('users');

    const level1Result = await usersCollection.where({ inviterId: userId }).get();
    const level1Users = level1Result.data || [];

    let level2Users: any[] = [];
    if (level1Users.length > 0) {
      const level1Ids = level1Users.map((u: any) => u._id);
      const level2Result = await usersCollection.where({
        inviterId: db.command.in(level1Ids),
      }).get();
      level2Users = level2Result.data || [];
    }

    let level3Users: any[] = [];
    if (level2Users.length > 0) {
      const level2Ids = level2Users.map((u: any) => u._id);
      const level3Result = await usersCollection.where({
        inviterId: db.command.in(level2Ids),
      }).get();
      level3Users = level3Result.data || [];
    }

    return {
      code: 0,
      message: '获取成功',
      data: {
        level1: level1Users,
        level2: level2Users,
        level3: level3Users,
      },
    };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 计算分佣
 * 扁平化逐级独立检查
 */
async function calculateCommission(userId: string, amount: number, userData: any, db: any, _: any) {
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

    const todayTotal = (todayCommissions.data || []).reduce((sum: number, r: any) => sum + r.amount, 0);

    if (todayTotal + potentialCommission > GAME_CONFIG.maxCommissionPerDay) {
      return;
    }

    const commissionRecord: any = {
      triggerUserId: userId,
      amount: potentialCommission,
      createTime: db.serverDate(),
    };

    const usersCollection = db.collection('users');
    const inviterChain: any[] = [];
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
  } catch (error: any) {
    console.error('[calculateCommission] 分佣计算失败', { userId, amount, error: error.message });
  }
}

/**
 * 保存游戏记录
 */
async function saveRecord(params: any, context: any, db: any, _: any) {
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
      const updateData: any = {
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
  } catch (error: any) {
    return { code: -1, message: '保存失败', error: error.message };
  }
}

/**
 * 获取用户游戏记录
 */
async function getUserRecords(params: any, context: any, db: any, _: any) {
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
    const maxLevel = records.length > 0 ? Math.max(...records.map((r: any) => r.level || 0)) : 0;
    const totalScore = records.reduce((sum: number, r: any) => sum + (r.score || 0), 0);

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
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取排行榜
 */
async function getRank(params: any, context: any, db: any, _: any) {
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

    const data = (result.data || []).map((item: any) => ({
      ...item,
      userId: item._id,
    }));

    return { code: 0, message: '获取成功', data };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取关卡配置
 */
async function getLevelConfig(params: any, context: any, db: any, _: any) {
  const { level } = params;

  try {
    const config = {
      level,
      iconCount: Math.min(8 + Math.floor(level / 2), 27),
      layers: level <= 2 ? 3 : level <= 5 ? 4 : 5,
      cardsPerIcon: 3,
    };

    return { code: 0, message: '获取成功', data: config };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 申请提现
 * 先扣佣金再创建记录，使用乐观锁机制
 */
async function withdrawApply(params: any, context: any, db: any, _: any) {
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

    const record: any = {
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
    } catch (addError: any) {
      await usersCollection.doc(userId).update({
        commission: _.inc(amount),
        updateTime: db.serverDate(),
      });
      return { code: -1, message: '申请失败，请重试' };
    }
  } catch (error: any) {
    return { code: -1, message: '申请失败', error: error.message };
  }
}

/**
 * 获取提现记录
 */
async function getWithdrawRecords(params: any, context: any, db: any, _: any) {
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
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 处理提现（管理员操作）
 */
async function withdrawProcess(params: any, context: any, db: any, _: any) {
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
  } catch (error: any) {
    return { code: -1, message: '处理失败', error: error.message };
  }
}

/**
 * 获取待审核提现列表（管理员）
 */
async function getPendingList(params: any, context: any, db: any, _: any) {
  const { limit = 100 } = params;

  try {
    const withdrawRecordsCollection = db.collection('withdraw_records');
    const result = await withdrawRecordsCollection
      .where({ status: 'pending' })
      .orderBy('applyTime', 'asc')
      .limit(limit)
      .get();

    const records = result.data || [];
    const userIds = [...new Set(records.map((r: any) => r.userId))];
    const usersCollection = db.collection('users');
    const usersResult = await usersCollection.where({
      _id: _.in(userIds),
    }).get();

    const usersMap: any = {};
    (usersResult.data || []).forEach((u: any) => {
      usersMap[u._id] = u;
    });

    const data = records.map((r: any) => ({
      ...r,
      user: usersMap[r.userId] || {},
    }));

    return { code: 0, message: '获取成功', data };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 上报广告观看
 */
async function adReport(params: any, context: any, db: any, _: any) {
  const { userId, adType } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    if (!AD_CONFIG[adType as keyof typeof AD_CONFIG] || !AD_CONFIG[adType as keyof typeof AD_CONFIG].enabled) {
      return { code: -1, message: '该类型广告未启用' };
    }

    const usersCollection = db.collection('users');
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return { code: -1, message: '用户不存在' };
    }

    const user = userResult.data;
    const adRecordsCollection = db.collection('ad_records');

    if (adType === 'rewarded') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const record: any = {
        userId,
        adType,
        reward: 0,
        createTime: db.serverDate(),
      };

      if (AD_CONFIG.rewarded.reward > 0 && user.userType === 'A') {
        record.reward = AD_CONFIG.rewarded.reward;
      }

      await adRecordsCollection.add(record);

      const todayRecords = await adRecordsCollection
        .where({
          userId,
          adType: 'rewarded',
          createTime: _.gte(today),
        })
        .count();

      if (todayRecords.total > AD_CONFIG.rewarded.dailyLimit) {
        await adRecordsCollection.doc(record._id || record.id).remove();
        return { code: -1, message: '今日观看次数已达上限' };
      }

      if (record.reward > 0) {
        await usersCollection.doc(userId).update({
          commission: _.inc(record.reward),
          updateTime: db.serverDate(),
        });
      }

      return {
        code: 0,
        message: '上报成功',
        data: { reward: record.reward },
      };
    }

    const record: any = {
      userId,
      adType,
      reward: 0,
      createTime: db.serverDate(),
    };

    await adRecordsCollection.add(record);

    return {
      code: 0,
      message: '上报成功',
      data: { reward: 0 },
    };
  } catch (error: any) {
    return { code: -1, message: '上报失败', error: error.message };
  }
}

/**
 * 获取广告配置
 */
async function getAdConfig(params: any, context: any, db: any, _: any) {
  try {
    return {
      code: 0,
      message: '获取成功',
      data: AD_CONFIG,
    };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取广告统计（管理员）
 */
async function getAdStatistics(params: any, context: any, db: any, _: any) {
  const { startDate, endDate } = params;

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const records = await db.collection('ad_records')
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .get();

    const data = records.data || [];

    const statistics: any = {
      rewarded: { count: 0, reward: 0 },
      banner: { count: 0 },
      interstitial: { count: 0 },
    };

    data.forEach((r: any) => {
      if (statistics[r.adType]) {
        statistics[r.adType].count++;
        if (r.reward) {
          statistics[r.adType].reward += r.reward;
        }
      }
    });

    return { code: 0, message: '获取成功', data: statistics };
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 验证管理员Token有效性
 */
async function verifyToken(params: any, context: any, db: any, _: any) {
  try {
    const token = params.adminToken || '';

    if (!token || !verifyAdminToken(params)) {
      return { code: -1, message: 'Token无效', data: { valid: false } };
    }

    return { code: 0, message: '验证成功', data: { valid: true } };
  } catch (error: any) {
    return { code: -1, message: '验证失败', data: { valid: false } };
  }
}

/**
 * 获取用户列表（管理员）
 */
async function getUserList(params: any, context: any, db: any, _: any) {
  const { page = 1, pageSize = 20, userType, keyword } = params;

  try {
    const skip = (page - 1) * pageSize;
    let query: any = {};

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
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取用户详情（管理员）
 */
async function getUserDetail(params: any, context: any, db: any, _: any) {
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
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取数据统计（管理员）
 */
async function getStatistics(params: any, context: any, db: any, _: any) {
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
    const totalScore = totalGames.reduce((sum: number, r: any) => sum + r.score, 0);

    const withdrawRecords = await db.collection('withdraw_records')
      .where({
        applyTime: _.and(_.gte(start), _.lte(end)),
        status: 'approved',
      })
      .get();

    const approvedWithdraws = withdrawRecords.data || [];
    const totalWithdraw = approvedWithdraws.reduce((sum: number, r: any) => sum + r.amount, 0);

    const adRecords = await db.collection('ad_records')
      .where({
        createTime: _.and(_.gte(start), _.lte(end)),
      })
      .get();

    const totalAds = adRecords.data || [];
    const adReward = totalAds.reduce((sum: number, r: any) => sum + (r.reward || 0), 0);

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
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 更新用户类型（管理员）
 */
async function updateUserType(params: any, context: any, db: any, _: any) {
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
  } catch (error: any) {
    return { code: -1, message: '更新失败', error: error.message };
  }
}

/**
 * 获取提现统计（管理员）
 */
async function getWithdrawStatistics(params: any, context: any, db: any, _: any) {
  const { status } = params;

  try {
    let query: any = {};
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

    const userIds = [...new Set(data.map((r: any) => r.userId))];
    const usersCollection = db.collection('users');
    const usersResult = await usersCollection.where({
      _id: _.in(userIds),
    }).get();

    const usersMap: any = {};
    (usersResult.data || []).forEach((u: any) => {
      usersMap[u._id] = u;
    });

    const recordsWithUser = data.map((r: any) => ({
      ...r,
      user: usersMap[r.userId] || {},
    }));

    const statistics: any = {
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
    };

    data.forEach((r: any) => {
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
  } catch (error: any) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 验证用户身份
 */
async function verifyUser(userId: string, db: any): Promise<boolean> {
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
 * 文本内容安全检测
 * 调用抖音内容安全API检测文本是否包含违法违规内容
 * @param content 待检测文本
 * @returns true=安全 false=包含违规内容
 */
async function checkContentSecurity(content: string): Promise<boolean> {
  if (!content || content.trim().length === 0) {
    return true;
  }

  try {
    const dyContext = dySDK.getContext ? dySDK : null;
    if (!dyContext) {
      return true;
    }

    const appId = process.env.DY_APPID || '';
    const appSecret = process.env.DY_APP_SECRET || '';

    if (!appId || !appSecret) {
      console.warn('[checkContentSecurity] 未配置DY_APPID或DY_APP_SECRET，跳过检测');
      return true;
    }

    const tokenUrl = `https://developer.toutiao.com/api/v2/tags/text/antidirt`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tasks: [{ content }],
      }),
    });

    if (!response.ok) {
      console.warn('[checkContentSecurity] 请求失败:', response.status);
      return true;
    }

    const result: any = await response.json();

    if (result.data && result.data.length > 0) {
      const taskResult = result.data[0];
      if (taskResult.predicts && taskResult.predicts.length > 0) {
        const hasHit = taskResult.predicts.some((p: any) => p.hit === true);
        return !hasHit;
      }
    }

    return true;
  } catch (error: any) {
    console.warn('[checkContentSecurity] 检测异常:', error.message);
    return true;
  }
}

/**
 * 内容安全检测接口（供前端调用）
 */
async function contentCheck(params: any, context: any, db: any, _: any) {
  const { content } = params;

  try {
    if (!content || typeof content !== 'string') {
      return { code: -1, message: '内容参数无效' };
    }

    const isSafe = await checkContentSecurity(content);

    return {
      code: 0,
      message: '检测完成',
      data: { safe: isSafe },
    };
  } catch (error: any) {
    return { code: -1, message: '检测失败', error: error.message };
  }
}

/**
 * 云函数入口 - 统一路由
 * 通过 module 参数区分不同业务模块
 */
export default async function (params: any, context: any) {
  const dyContext = dySDK.context(context);
  const db = dyContext.database();
  const _ = db.command;

  const { module: moduleName, action } = params;

  if (!moduleName || !action) {
    return { code: -1, message: '缺少 module 或 action 参数' };
  }

  const ADMIN_ACTIONS: Record<string, string[]> = {
    withdraw: ['process', 'getPendingList'],
    ad: ['getStatistics'],
    admin: ['verifyToken', 'getUserList', 'getUserDetail', 'getStatistics', 'updateUserType', 'getWithdrawStatistics'],
  };

  if (ADMIN_ACTIONS[moduleName] && ADMIN_ACTIONS[moduleName].includes(action)) {
    if (!verifyAdminToken(params)) {
      return { code: -403, message: '管理员权限验证失败' };
    }
  }

  const AUTH_REQUIRED_ACTIONS: Record<string, string[]> = {
    game: ['saveRecord', 'getUserRecords'],
    withdraw: ['apply', 'getRecords'],
    ad: ['report'],
  };

  if (AUTH_REQUIRED_ACTIONS[moduleName] && AUTH_REQUIRED_ACTIONS[moduleName].includes(action)) {
    const userId = params.userId;
    const isValid = await verifyUser(userId, db);
    if (!isValid) {
      return { code: -1, message: '用户身份验证失败' };
    }
  }

  const moduleActions: Record<string, Record<string, Function>> = {
    user: {
      login,
      getInfo,
      updateInfo,
      bindInviter,
      getInviteList,
      contentCheck,
    },
    game: {
      saveRecord,
      getUserRecords,
      getRank,
      getLevelConfig,
    },
    withdraw: {
      apply: withdrawApply,
      getRecords: getWithdrawRecords,
      process: withdrawProcess,
      getPendingList,
    },
    ad: {
      report: adReport,
      getConfig: getAdConfig,
      getStatistics: getAdStatistics,
    },
    admin: {
      verifyToken,
      getUserList,
      getUserDetail,
      getStatistics,
      updateUserType,
      getWithdrawStatistics,
    },
  };

  const actions = moduleActions[moduleName];
  if (!actions) {
    return { code: -1, message: `未知模块: ${moduleName}` };
  }

  const handler = actions[action];
  if (!handler) {
    return { code: -1, message: `未知操作: ${moduleName}.${action}` };
  }

  return await handler(params, context, db, _);
}
