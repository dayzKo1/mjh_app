import { dySDK } from '@open-dy/node-server-sdk';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

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
function verifyAdminToken(params) {
  if (!ADMIN_TOKEN) return false;
  const token = params.adminToken || '';
  return token === ADMIN_TOKEN;
}

/**
 * 上报广告观看
 * 先写记录再检查上限，超限时回滚记录
 */
async function report(params, context, db, _) {
  const { userId, adType } = params;

  try {
    if (!userId || typeof userId !== 'string') {
      return { code: -1, message: '用户ID无效' };
    }

    if (!AD_CONFIG[adType] || !AD_CONFIG[adType].enabled) {
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

      const record = {
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

    const record = {
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
  } catch (error) {
    return { code: -1, message: '上报失败', error: error.message };
  }
}

/**
 * 获取广告配置
 */
async function getConfig(params, context, db, _) {
  try {
    return {
      code: 0,
      message: '获取成功',
      data: AD_CONFIG,
    };
  } catch (error) {
    return { code: -1, message: '获取失败', error: error.message };
  }
}

/**
 * 获取广告统计（管理员）
 */
async function getStatistics(params, context, db, _) {
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

    const statistics = {
      rewarded: { count: 0, reward: 0 },
      banner: { count: 0 },
      interstitial: { count: 0 },
    };

    data.forEach(r => {
      if (statistics[r.adType]) {
        statistics[r.adType].count++;
        if (r.reward) {
          statistics[r.adType].reward += r.reward;
        }
      }
    });

    return { code: 0, message: '获取成功', data: statistics };
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

  const actions = { report, getConfig, getStatistics };

  if (!action || !actions[action]) {
    return { code: -1, message: `未知操作: ${action}` };
  }

  if (action === 'getStatistics' && !verifyAdminToken(params)) {
    return { code: -1, message: '管理员验证失败' };
  }

  return await actions[action](params, context, db, _);
}
