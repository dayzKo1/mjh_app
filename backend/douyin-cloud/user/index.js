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
 * 用户登录
 * 抖音云免登录：通过context自动获取openId
 */
async function login(params, context, db, _) {
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
  } catch (error) {
    return { code: -1, message: '登录失败', error: error.message };
  }
}

/**
 * 获取用户信息
 */
async function getInfo(params, context, db, _) {
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
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 更新用户信息
 * 仅允许更新安全字段，禁止修改userType/commission/totalWithdraw/inviterId等关键字段
 */
async function updateInfo(params, context, db, _) {
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
    const updateData = { updateTime: db.serverDate() };

    for (const field of ALLOWED_FIELDS) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    await usersCollection.doc(userId).update(updateData);

    return { code: 0, message: '更新成功' };
  } catch (error) {
    return { code: -1, message: '更新失败', error: error.message };
  }
}

/**
 * 绑定邀请人
 * 包含循环引用检测，防止形成环形分佣链路
 */
async function bindInviter(params, context, db, _) {
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
  } catch (error) {
    return { code: -1, message: '绑定失败', error: error.message };
  }
}

/**
 * 获取邀请列表
 * 包含三级邀请关系查询
 */
async function getInviteList(params, context, db, _) {
  const { userId } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    const usersCollection = db.collection('users');

    const level1Result = await usersCollection.where({ inviterId: userId }).get();
    const level1Users = level1Result.data || [];

    let level2Users = [];
    if (level1Users.length > 0) {
      const level1Ids = level1Users.map(u => u._id);
      const level2Result = await usersCollection.where({
        inviterId: db.command.in(level1Ids),
      }).get();
      level2Users = level2Result.data || [];
    }

    let level3Users = [];
    if (level2Users.length > 0) {
      const level2Ids = level2Users.map(u => u._id);
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

  const actions = { login, getInfo, updateInfo, bindInviter, getInviteList };

  if (!action || !actions[action]) {
    return { code: -1, message: `未知操作: ${action}` };
  }

  return await actions[action](params, context, db, _);
}
