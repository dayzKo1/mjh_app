/**
 * 用户云函数 - 处理用户登录、信息获取等
 */

const cloud = require('@cloudbase/node-sdk');
const { createLogger } = require('../shared/logger');

const log = createLogger('user');

const app = cloud.init({
  env: cloud.SYMBOL_CURRENT_ENV,
});

const db = app.database();
const usersCollection = db.collection('users');

/**
 * 用户登录
 * 包含参数验证和错误处理
 * @param {Object} event - 云函数调用参数
 * @param {Object} event.userInfo - 用户信息
 */
exports.login = async (event) => {
  const { userInfo } = event;

  try {
    log.start('login', '用户登录请求', { hasUserInfo: !!userInfo });

    if (!userInfo || typeof userInfo !== 'object') {
      log.warn('login', '用户信息无效', { userInfo });
      return { code: -1, message: '用户信息无效' };
    }

    const { openId } = userInfo;
    if (!openId || typeof openId !== 'string') {
      log.warn('login', 'openId无效', { openId });
      return { code: -1, message: 'openId无效' };
    }

    log.debug('login', '查询用户', { openId });
    const userResult = await usersCollection
      .where({ openId })
      .limit(1)
      .get();

    let user;
    if (userResult.data && userResult.data.length > 0) {
      user = userResult.data[0];
      log.info('login', '用户已存在，更新登录时间', { userId: user._id, userType: user.userType });

      await usersCollection.doc(user._id).update({
        lastLoginTime: db.serverDate(),
        updateTime: db.serverDate(),
      });

      log.success('login', '用户登录成功（老用户）', { userId: user._id, userType: user.userType });
    } else {
      log.info('login', '新用户注册', { openId });

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

      log.success('login', '用户注册成功（新用户）', { userId: user._id, openId });
    }

    log.end('login', '用户登录流程完成', { userId: user._id });
    return {
      code: 0,
      message: '登录成功',
      data: user,
    };
  } catch (error) {
    log.fail('login', '用户登录失败', { error: error.message, stack: error.stack });
    return {
      code: -1,
      message: '登录失败',
      error: error.message,
    };
  }
};

/**
 * 获取用户信息
 * 包含参数验证
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 */
exports.getInfo = async (event) => {
  const { userId } = event;

  try {
    log.start('getInfo', '获取用户信息请求', { userId });

    if (!userId || typeof userId !== 'string') {
      log.warn('getInfo', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }

    const result = await usersCollection.doc(userId).get();

    if (!result.data) {
      log.warn('getInfo', '用户不存在', { userId });
      return {
        code: -1,
        message: '用户不存在',
      };
    }

    log.success('getInfo', '获取用户信息成功', { userId, userType: result.data.userType });
    return {
      code: 0,
      message: '获取成功',
      data: result.data,
    };
  } catch (error) {
    log.fail('getInfo', '获取用户信息失败', { userId, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * 更新用户信息
 * 仅允许更新安全字段，禁止修改userType/commission/totalWithdraw/inviterId等关键字段
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {Object} event.data - 更新数据
 */
exports.updateInfo = async (event) => {
  const { userId, data } = event;

  try {
    log.start('updateInfo', '更新用户信息请求', { userId, fields: data ? Object.keys(data) : [] });

    if (!userId || typeof userId !== 'string') {
      log.warn('updateInfo', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }
    if (!data || typeof data !== 'object') {
      log.warn('updateInfo', '更新数据无效', { data });
      return { code: -1, message: '更新数据无效' };
    }

    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      log.warn('updateInfo', '用户不存在', { userId });
      return { code: -1, message: '用户不存在' };
    }

    const ALLOWED_FIELDS = ['nickName', 'avatarUrl'];
    const updateData = {
      updateTime: db.serverDate(),
    };

    for (const field of ALLOWED_FIELDS) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    log.debug('updateInfo', '执行更新', { userId, updateFields: Object.keys(updateData) });
    await usersCollection.doc(userId).update(updateData);

    log.success('updateInfo', '更新用户信息成功', { userId });
    return {
      code: 0,
      message: '更新成功',
    };
  } catch (error) {
    log.fail('updateInfo', '更新用户信息失败', { userId, error: error.message });
    return {
      code: -1,
      message: '更新失败',
      error: error.message,
    };
  }
};

/**
 * 绑定邀请人
 * 包含循环引用检测，防止形成环形分佣链路
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 * @param {string} event.inviterId - 邀请人ID
 */
exports.bindInviter = async (event) => {
  const { userId, inviterId } = event;

  try {
    log.start('bindInviter', '绑定邀请人请求', { userId, inviterId });

    if (!userId || !inviterId || typeof userId !== 'string' || typeof inviterId !== 'string') {
      log.warn('bindInviter', '参数无效', { userId, inviterId });
      return { code: -1, message: '参数无效' };
    }

    const inviterResult = await usersCollection.doc(inviterId).get();
    if (!inviterResult.data) {
      log.warn('bindInviter', '邀请人不存在', { inviterId });
      return {
        code: -1,
        message: '邀请人不存在',
      };
    }

    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      log.warn('bindInviter', '用户不存在', { userId });
      return { code: -1, message: '用户不存在' };
    }

    if (userResult.data.inviterId) {
      log.warn('bindInviter', '已有邀请人', { userId, existingInviterId: userResult.data.inviterId });
      return {
        code: -1,
        message: '已有邀请人，不可重复绑定',
      };
    }

    if (userId === inviterId) {
      log.warn('bindInviter', '尝试自我邀请', { userId });
      return {
        code: -1,
        message: '不可邀请自己',
      };
    }

    log.debug('bindInviter', '开始循环引用检测', { userId, inviterId });
    const visited = new Set([userId]);
    let currentInviter = inviterResult.data;
    let depth = 0;
    while (currentInviter) {
      depth++;
      if (visited.has(currentInviter._id)) {
        log.warn('bindInviter', '检测到循环引用', { userId, inviterId, depth, visitedIds: Array.from(visited) });
        return {
          code: -1,
          message: '绑定后会产生循环引用，不可绑定',
        };
      }
      visited.add(currentInviter._id);
      if (currentInviter.inviterId) {
        const nextInviter = await usersCollection.doc(currentInviter.inviterId).get();
        currentInviter = nextInviter.data;
      } else {
        break;
      }
    }
    log.debug('bindInviter', '循环引用检测通过', { depth, chainLength: visited.size });

    log.info('bindInviter', '执行绑定并升级用户类型', { userId, inviterId, fromType: userResult.data.userType, toType: 'A' });
    await usersCollection.doc(userId).update({
      inviterId,
      userType: 'A',
      updateTime: db.serverDate(),
    });

    log.success('bindInviter', '绑定邀请人成功', { userId, inviterId });
    return {
      code: 0,
      message: '绑定成功',
    };
  } catch (error) {
    log.fail('bindInviter', '绑定邀请人失败', { userId, inviterId, error: error.message });
    return {
      code: -1,
      message: '绑定失败',
      error: error.message,
    };
  }
};

/**
 * 获取邀请列表
 * 包含参数验证和空数组处理
 * @param {Object} event - 云函数调用参数
 * @param {string} event.userId - 用户ID
 */
exports.getInviteList = async (event) => {
  const { userId } = event;

  try {
    log.start('getInviteList', '获取邀请列表请求', { userId });

    if (!userId || typeof userId !== 'string') {
      log.warn('getInviteList', '用户ID无效', { userId });
      return { code: -1, message: '用户ID无效' };
    }

    const level1Result = await usersCollection
      .where({ inviterId: userId })
      .get();

    const level1Users = level1Result.data || [];
    log.debug('getInviteList', '一级邀请数量', { userId, count: level1Users.length });

    let level2Users = [];
    if (level1Users.length > 0) {
      const level1Ids = level1Users.map(u => u._id);
      const level2Result = await usersCollection
        .where({
          inviterId: db.command.in(level1Ids),
        })
        .get();
      level2Users = level2Result.data || [];
      log.debug('getInviteList', '二级邀请数量', { userId, count: level2Users.length });
    }

    let level3Users = [];
    if (level2Users.length > 0) {
      const level2Ids = level2Users.map(u => u._id);
      const level3Result = await usersCollection
        .where({
          inviterId: db.command.in(level2Ids),
        })
        .get();
      level3Users = level3Result.data || [];
      log.debug('getInviteList', '三级邀请数量', { userId, count: level3Users.length });
    }

    log.success('getInviteList', '获取邀请列表成功', {
      userId,
      level1: level1Users.length,
      level2: level2Users.length,
      level3: level3Users.length,
    });

    return {
      code: 0,
      message: '获取成功',
      data: {
        level1: level1Users,
        level2: level2Users,
        level3: level3Users,
      },
    };
  } catch (error) {
    log.fail('getInviteList', '获取邀请列表失败', { userId, error: error.message });
    return {
      code: -1,
      message: '获取失败',
      error: error.message,
    };
  }
};

/**
 * HTTP触发器入口函数
 * 通过action字段路由到不同方法，支持HTTP触发器调用
 * 用户云函数不需要管理员验证，所有方法均可直接调用
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
    login: exports.login,
    getInfo: exports.getInfo,
    updateInfo: exports.updateInfo,
    bindInviter: exports.bindInviter,
    getInviteList: exports.getInviteList,
  };

  if (!action || !actions[action]) {
    log.warn('main', '未知操作', { action });
    return { code: -1, message: `未知操作: ${action}` };
  }

  return await actions[action](params);
};
