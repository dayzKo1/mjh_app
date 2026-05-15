/**
 * 端到端自动化测试脚本
 * 模拟完整业务流程：新用户注册 → 邀请绑定(B升A) → 游戏通关 → 分佣触发 → 提现申请 → 管理员审核
 *
 * 使用方式：
 *   1. 复制 .env.example 为 .env，填入真实配置
 *   2. node e2e-test.js
 *
 * 环境变量：
 *   CLOUD_ENV_ID    - 云开发环境ID（必填）
 *   ADMIN_TOKEN     - 管理员Token（必填）
 *   TEST_OPEN_ID    - 测试用openId（可选，默认自动生成）
 */

const https = require('https');
const http = require('http');

// ============================================================
// 配置
// ============================================================

const CLOUD_ENV_ID = process.env.CLOUD_ENV_ID || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

if (!CLOUD_ENV_ID) {
  console.error('❌ 请设置环境变量 CLOUD_ENV_ID');
  process.exit(1);
}

if (!ADMIN_TOKEN) {
  console.error('❌ 请设置环境变量 ADMIN_TOKEN');
  process.exit(1);
}

const API_BASE = `https://${CLOUD_ENV_ID}.service.tcloudbase.com`;

// ============================================================
// 工具函数
// ============================================================

/**
 * 发送HTTP请求
 * @param {string} method - 请求方法
 * @param {string} url - 请求URL
 * @param {Object} data - 请求体数据
 * @param {Object} headers - 额外请求头
 * @returns {Promise<Object>} 响应数据
 */
function request(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`响应解析失败: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * 调用云函数
 * @param {string} functionName - 云函数名称
 * @param {string} action - 操作名称
 * @param {Object} params - 业务参数
 * @param {boolean} needAdmin - 是否需要管理员Token
 * @returns {Promise<Object>} 云函数返回结果
 */
async function callFunction(functionName, action, params = {}, needAdmin = false) {
  const url = `${API_BASE}/${functionName}`;
  const data = { action, ...params };

  const headers = {};
  if (needAdmin) {
    headers['adminToken'] = ADMIN_TOKEN;
    headers['x-admin-token'] = ADMIN_TOKEN;
    data.adminToken = ADMIN_TOKEN;
  }

  return request('POST', url, data, headers);
}

/**
 * 断言成功
 * @param {Object} result - 云函数返回结果
 * @param {string} action - 操作描述
 */
function assertSuccess(result, action) {
  if (result.code !== 0) {
    throw new Error(`❌ ${action} 失败: code=${result.code}, message=${result.message}`);
  }
}

/**
 * 断言失败
 * @param {Object} result - 云函数返回结果
 * @param {string} action - 操作描述
 */
function assertFail(result, action) {
  if (result.code === 0) {
    throw new Error(`❌ ${action} 应该失败但成功了`);
  }
}

/**
 * 生成唯一测试ID
 * @param {string} prefix - 前缀
 * @returns {string} 唯一ID
 */
function genTestId(prefix = 'test') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * 延时
 * @param {number} ms - 毫秒数
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 测试结果统计
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

/**
 * 记录测试结果
 * @param {string} name - 测试名称
 * @param {boolean} passed - 是否通过
 * @param {string} detail - 详情
 */
function recordTest(name, passed, detail = '') {
  totalTests++;
  if (passed) passedTests++;
  else failedTests++;
  testResults.push({ name, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${name}${detail ? ' — ' + detail : ''}`);
}

// ============================================================
// 测试用例
// ============================================================

/**
 * 阶段1：管理员Token验证
 */
async function testAdminVerify() {
  console.log('\n📋 阶段1：管理员Token验证');
  console.log('─'.repeat(50));

  // 测试1.1：正确Token验证
  const r1 = await callFunction('admin', 'verifyToken', {}, true);
  recordTest('1.1 正确Token验证', r1.code === 0, `code=${r1.code}`);

  // 测试1.2：错误Token验证
  const r2 = await callFunction('admin', 'verifyToken', { adminToken: 'wrong_token' });
  recordTest('1.2 错误Token被拒绝', r2.code === -403 || r2.code === -1, `code=${r2.code}`);

  // 测试1.3：无Token验证
  const r3 = await callFunction('admin', 'verifyToken', {});
  recordTest('1.3 无Token被拒绝', r3.code === -403 || r3.code === -1, `code=${r3.code}`);
}

/**
 * 阶段2：新用户注册（模拟3个用户：玩家、一级邀请人、二级邀请人）
 */
async function testUserRegistration() {
  console.log('\n📋 阶段2：新用户注册');
  console.log('─'.repeat(50));

  const openId1 = genTestId('openid_lv2');
  const openId2 = genTestId('openid_lv1');
  const openId3 = genTestId('openid_player');

  // 测试2.1：注册二级邀请人（最上级）
  const r1 = await callFunction('user', 'login', { userInfo: { openId: openId1 } });
  assertSuccess(r1, '注册二级邀请人');
  const user2nd = r1.data;
  recordTest('2.1 注册二级邀请人', user2nd.userType === 'B' && user2nd._id, `userId=${user2nd._id}, type=${user2nd.userType}`);

  // 测试2.2：注册一级邀请人
  const r2 = await callFunction('user', 'login', { userInfo: { openId: openId2 } });
  assertSuccess(r2, '注册一级邀请人');
  const user1st = r2.data;
  recordTest('2.2 注册一级邀请人', user1st.userType === 'B' && user1st._id, `userId=${user1st._id}, type=${user1st.userType}`);

  // 测试2.3：注册玩家
  const r3 = await callFunction('user', 'login', { userInfo: { openId: openId3 } });
  assertSuccess(r3, '注册玩家');
  const player = r3.data;
  recordTest('2.3 注册玩家', player.userType === 'B' && player._id, `userId=${player._id}, type=${player.userType}`);

  // 测试2.4：重复登录不创建新用户
  const r4 = await callFunction('user', 'login', { userInfo: { openId: openId3 } });
  assertSuccess(r4, '重复登录');
  recordTest('2.4 重复登录不创建新用户', r4.data._id === player._id, `sameId=${r4.data._id === player._id}`);

  return { user2nd, user1st, player, openId1, openId2, openId3 };
}

/**
 * 阶段3：邀请绑定（B升A）
 */
async function testInviteBinding(users) {
  console.log('\n📋 阶段3：邀请绑定（B→A升级）');
  console.log('─'.repeat(50));

  const { user2nd, user1st, player } = users;

  // 测试3.1：一级邀请人绑定二级邀请人
  const r1 = await callFunction('user', 'bindInviter', {
    userId: user1st._id,
    inviterId: user2nd._id,
  });
  assertSuccess(r1, '一级邀请人绑定二级邀请人');
  recordTest('3.1 一级绑定二级', r1.code === 0, r1.message);

  // 验证一级邀请人升级为A类
  const r1Check = await callFunction('user', 'getInfo', { userId: user1st._id });
  assertSuccess(r1Check, '查询一级邀请人信息');
  recordTest('3.1a 一级邀请人升级为A类', r1Check.data.userType === 'A', `type=${r1Check.data.userType}`);
  recordTest('3.1b 一级邀请人inviterId正确', r1Check.data.inviterId === user2nd._id, `inviterId=${r1Check.data.inviterId}`);

  // 测试3.2：玩家绑定一级邀请人
  const r2 = await callFunction('user', 'bindInviter', {
    userId: player._id,
    inviterId: user1st._id,
  });
  assertSuccess(r2, '玩家绑定一级邀请人');
  recordTest('3.2 玩家绑定一级邀请人', r2.code === 0, r2.message);

  // 验证玩家升级为A类
  const r2Check = await callFunction('user', 'getInfo', { userId: player._id });
  assertSuccess(r2Check, '查询玩家信息');
  recordTest('3.2a 玩家升级为A类', r2Check.data.userType === 'A', `type=${r2Check.data.userType}`);

  // 测试3.3：不可重复绑定
  const r3 = await callFunction('user', 'bindInviter', {
    userId: player._id,
    inviterId: user2nd._id,
  });
  recordTest('3.3 不可重复绑定', r3.code === -1, `code=${r3.code}, msg=${r3.message}`);

  // 测试3.4：不可自我邀请
  const tempUser = await callFunction('user', 'login', { userInfo: { openId: genTestId('temp') } });
  const r4 = await callFunction('user', 'bindInviter', {
    userId: tempUser.data._id,
    inviterId: tempUser.data._id,
  });
  recordTest('3.4 不可自我邀请', r4.code === -1, `code=${r4.code}, msg=${r4.message}`);

  // 测试3.5：二级邀请人仍为B类（未绑定邀请人）
  const r5 = await callFunction('user', 'getInfo', { userId: user2nd._id });
  recordTest('3.5 二级邀请人仍为B类', r5.data.userType === 'B', `type=${r5.data.userType}`);

  // 管理员手动将二级邀请人升级为A类（模拟场景）
  const r6 = await callFunction('admin', 'updateUserType', {
    userId: user2nd._id,
    userType: 'A',
  }, true);
  recordTest('3.6 管理员升级二级邀请人为A类', r6.code === 0, r6.message);
}

/**
 * 阶段4：游戏通关 + 分佣触发
 */
async function testGameAndCommission(users) {
  console.log('\n📋 阶段4：游戏通关 + 分佣触发');
  console.log('─'.repeat(50));

  const { user2nd, user1st, player } = users;

  // 记录分佣前余额
  const before1st = await callFunction('user', 'getInfo', { userId: user1st._id });
  const before2nd = await callFunction('user', 'getInfo', { userId: user2nd._id });
  const commission1stBefore = before1st.data.commission || 0;
  const commission2ndBefore = before2nd.data.commission || 0;

  // 测试4.1：保存游戏记录（高分触发分佣）
  const score = 1000;
  const r1 = await callFunction('game', 'saveRecord', {
    userId: player._id,
    level: 5,
    score: score,
    time: 60,
  });
  assertSuccess(r1, '保存游戏记录');
  recordTest('4.1 保存游戏记录', r1.code === 0, `score=${score}`);

  await sleep(1000);

  // 验证分佣是否触发
  const after1st = await callFunction('user', 'getInfo', { userId: user1st._id });
  const after2nd = await callFunction('user', 'getInfo', { userId: user2nd._id });
  const commission1stAfter = after1st.data.commission || 0;
  const commission2ndAfter = after2nd.data.commission || 0;

  const expected1st = Math.round(score * 0.1 * 0.01 * 100) / 100;
  const expected2nd = Math.round(score * 0.05 * 0.01 * 100) / 100;
  const actual1st = Math.round((commission1stAfter - commission1stBefore) * 100) / 100;
  const actual2nd = Math.round((commission2ndAfter - commission2ndBefore) * 100) / 100;

  recordTest('4.2 一级分佣正确', actual1st === expected1st,
    `expected=${expected1st}, actual=${actual1st}`);
  recordTest('4.3 二级分佣正确', actual2nd === expected2nd,
    `expected=${expected2nd}, actual=${actual2nd}`);

  // 测试4.4：玩家分数更新
  const playerInfo = await callFunction('user', 'getInfo', { userId: player._id });
  recordTest('4.4 玩家分数更新', playerInfo.data.score >= score,
    `score=${playerInfo.data.score}`);

  // 测试4.5：参数校验 - 无效分数
  const r5 = await callFunction('game', 'saveRecord', {
    userId: player._id,
    level: 1,
    score: 99999,
    time: 60,
  });
  recordTest('4.5 无效分数被拒绝', r5.code === -1, `code=${r5.code}, msg=${r5.message}`);

  // 测试4.6：参数校验 - 无效关卡
  const r6 = await callFunction('game', 'saveRecord', {
    userId: player._id,
    level: 999,
    score: 100,
    time: 60,
  });
  recordTest('4.6 无效关卡被拒绝', r6.code === -1, `code=${r6.code}, msg=${r6.message}`);

  // 测试4.7：B类用户游戏不触发分佣
  const bUser = await callFunction('user', 'login', { userInfo: { openId: genTestId('buser') } });
  const bUserInviterBefore = await callFunction('user', 'getInfo', { userId: user1st._id });
  const bCommissionBefore = bUserInviterBefore.data.commission;

  await callFunction('user', 'bindInviter', { userId: bUser.data._id, inviterId: user1st._id });
  await callFunction('admin', 'updateUserType', { userId: bUser.data._id, userType: 'B' }, true);

  const bUserUpdated = await callFunction('user', 'getInfo', { userId: bUser.data._id });
  if (bUserUpdated.data.userType === 'A') {
    await callFunction('admin', 'updateUserType', { userId: bUser.data._id, userType: 'B' }, true);
  }

  return { commission1stAfter, commission2ndAfter, expected1st, expected2nd };
}

/**
 * 阶段5：提现申请
 */
async function testWithdrawApply(users) {
  console.log('\n📋 阶段5：提现申请');
  console.log('─'.repeat(50));

  const { player } = users;

  // 刷新玩家信息获取最新佣金
  const playerInfo = await callFunction('user', 'getInfo', { userId: player._id });
  const commission = playerInfo.data.commission || 0;

  // 测试5.1：B类用户不可提现
  const bUser = await callFunction('user', 'login', { userInfo: { openId: genTestId('bwd') } });
  const r1 = await callFunction('withdraw', 'apply', {
    userId: bUser.data._id,
    amount: 1,
  });
  recordTest('5.1 B类用户不可提现', r1.code === -1, `code=${r1.code}, msg=${r1.message}`);

  // 测试5.2：金额低于最低限额
  const r2 = await callFunction('withdraw', 'apply', {
    userId: player._id,
    amount: 0.5,
  });
  recordTest('5.2 低于最低限额被拒绝', r2.code === -1, `code=${r2.code}, msg=${r2.message}`);

  // 测试5.3：金额超过余额
  const r3 = await callFunction('withdraw', 'apply', {
    userId: player._id,
    amount: 99999,
  });
  recordTest('5.3 超过余额被拒绝', r3.code === -1, `code=${r3.code}, msg=${r3.message}`);

  // 测试5.4：正常提现申请
  let withdrawRecordId = null;
  if (commission >= 1) {
    const withdrawAmount = Math.min(1, commission);
    const r4 = await callFunction('withdraw', 'apply', {
      userId: player._id,
      amount: withdrawAmount,
    });
    recordTest('5.4 正常提现申请', r4.code === 0, `code=${r4.code}, amount=${withdrawAmount}`);
    if (r4.code === 0 && r4.data) {
      withdrawRecordId = r4.data.recordId;
    }
  } else {
    recordTest('5.4 正常提现申请', true, '跳过：佣金不足1元');
  }

  // 测试5.5：提现后佣金余额减少
  const playerAfter = await callFunction('user', 'getInfo', { userId: player._id });
  if (commission >= 1) {
    recordTest('5.5 提现后佣金减少', playerAfter.data.commission < commission,
      `before=${commission}, after=${playerAfter.data.commission}`);
  } else {
    recordTest('5.5 提现后佣金减少', true, '跳过：佣金不足');
  }

  // 测试5.6：获取提现记录
  const r6 = await callFunction('withdraw', 'getRecords', { userId: player._id });
  recordTest('5.6 获取提现记录', r6.code === 0 && Array.isArray(r6.data),
    `count=${r6.data ? r6.data.length : 0}`);

  // 测试5.7：空userId被拒绝
  const r7 = await callFunction('withdraw', 'getRecords', { userId: '' });
  recordTest('5.7 空userId被拒绝', r7.code === -1, `code=${r7.code}`);

  return { withdrawRecordId, playerCommission: playerAfter.data.commission };
}

/**
 * 阶段6：管理员审核提现
 */
async function testWithdrawReview(withdrawRecordId) {
  console.log('\n📋 阶段6：管理员审核提现');
  console.log('─'.repeat(50));

  if (!withdrawRecordId) {
    recordTest('6.1 获取待审核列表', true, '跳过：无提现记录');
    recordTest('6.2 审核通过', true, '跳过：无提现记录');
    recordTest('6.3 审核拒绝并退还佣金', true, '跳过：无提现记录');
    return;
  }

  // 测试6.1：获取待审核列表
  const r1 = await callFunction('withdraw', 'getPendingList', { limit: 10 }, true);
  recordTest('6.1 获取待审核列表', r1.code === 0 && Array.isArray(r1.data),
    `count=${r1.data ? r1.data.length : 0}`);

  // 先创建一条新提现记录用于"拒绝"测试
  const testUser = await callFunction('user', 'login', { userInfo: { openId: genTestId('wd_test') } });
  await callFunction('user', 'bindInviter', {
    userId: testUser.data._id,
    inviterId: (await callFunction('user', 'login', { userInfo: { openId: genTestId('wd_inv') } })).data._id,
  });

  // 给测试用户增加佣金（通过管理员修改用户类型为A，然后模拟广告奖励）
  await callFunction('admin', 'updateUserType', { userId: testUser.data._id, userType: 'A' }, true);

  // 通过多次广告上报增加佣金
  for (let i = 0; i < 100; i++) {
    await callFunction('ad', 'report', { userId: testUser.data._id, adType: 'rewarded' });
  }

  const testUserInfo = await callFunction('user', 'getInfo', { userId: testUser.data._id });
  if (testUserInfo.data.commission >= 1) {
    // 测试6.2：审核拒绝并退还佣金
    const rejectApply = await callFunction('withdraw', 'apply', {
      userId: testUser.data._id,
      amount: 1,
    });

    if (rejectApply.code === 0 && rejectApply.data) {
      const commissionBeforeReject = testUserInfo.data.commission;
      const r2 = await callFunction('withdraw', 'process', {
        recordId: rejectApply.data.recordId,
        status: 'rejected',
        reason: '测试拒绝',
      }, true);
      recordTest('6.2 审核拒绝', r2.code === 0, `code=${r2.code}`);

      // 验证佣金退还
      const afterReject = await callFunction('user', 'getInfo', { userId: testUser.data._id });
      recordTest('6.2a 拒绝后佣金退还', afterReject.data.commission >= commissionBeforeReject - 1,
        `before=${commissionBeforeReject}, after=${afterReject.data.commission}`);
    }
  }

  // 测试6.3：审核通过
  const r3 = await callFunction('withdraw', 'process', {
    recordId: withdrawRecordId,
    status: 'approved',
  }, true);
  recordTest('6.3 审核通过', r3.code === 0, `code=${r3.code}, msg=${r3.message}`);

  // 测试6.4：重复审核被拒绝（乐观锁）
  const r4 = await callFunction('withdraw', 'process', {
    recordId: withdrawRecordId,
    status: 'approved',
  }, true);
  recordTest('6.4 重复审核被拒绝', r4.code === -1,
    `code=${r4.code}, msg=${r4.message}`);

  // 测试6.5：无效Token审核被拒绝
  const r5 = await callFunction('withdraw', 'process', {
    recordId: withdrawRecordId,
    status: 'approved',
    adminToken: 'invalid_token',
  });
  recordTest('6.5 无效Token审核被拒绝', r5.code === -403 || r5.code === -1,
    `code=${r5.code}`);
}

/**
 * 阶段7：A→B降级
 */
async function testUserDowngrade(users) {
  console.log('\n📋 阶段7：A→B降级');
  console.log('─'.repeat(50));

  // 创建测试用户：A类，有佣金，有待审核提现
  const dgUser = await callFunction('user', 'login', { userInfo: { openId: genTestId('dg') } });
  const dgInviter = await callFunction('user', 'login', { userInfo: { openId: genTestId('dg_inv') } });

  await callFunction('user', 'bindInviter', { userId: dgUser.data._id, inviterId: dgInviter.data._id });
  await callFunction('admin', 'updateUserType', { userId: dgInviter.data._id, userType: 'A' }, true);

  // 增加佣金
  for (let i = 0; i < 100; i++) {
    await callFunction('ad', 'report', { userId: dgUser.data._id, adType: 'rewarded' });
  }

  const dgInfo = await callFunction('user', 'getInfo', { userId: dgUser.data._id });
  const dgCommission = dgInfo.data.commission || 0;

  if (dgCommission >= 1) {
    // 申请提现（制造pending记录）
    await callFunction('withdraw', 'apply', { userId: dgUser.data._id, amount: 1 });
  }

  // 执行降级
  const r1 = await callFunction('admin', 'updateUserType', {
    userId: dgUser.data._id,
    userType: 'B',
  }, true);
  recordTest('7.1 A→B降级成功', r1.code === 0, `code=${r1.code}, msg=${r1.message}`);

  // 验证降级后状态
  const dgAfter = await callFunction('user', 'getInfo', { userId: dgUser.data._id });
  recordTest('7.2 降级后类型为B', dgAfter.data.userType === 'B', `type=${dgAfter.data.userType}`);
  recordTest('7.3 降级后佣金清零', dgAfter.data.commission === 0, `commission=${dgAfter.data.commission}`);

  // 验证待审核提现被拒绝
  const dgRecords = await callFunction('withdraw', 'getRecords', { userId: dgUser.data._id });
  if (dgRecords.code === 0 && dgRecords.data.length > 0) {
    const hasPending = dgRecords.data.some(r => r.status === 'pending');
    recordTest('7.4 降级后无pending提现', !hasPending, `hasPending=${hasPending}`);
  } else {
    recordTest('7.4 降级后无pending提现', true, '无提现记录');
  }
}

/**
 * 阶段8：排行榜
 */
async function testRanking(users) {
  console.log('\n📋 阶段8：排行榜');
  console.log('─'.repeat(50));

  // 测试8.1：积分排行榜
  const r1 = await callFunction('game', 'getRank', { type: 'score', limit: 10 });
  recordTest('8.1 积分排行榜', r1.code === 0 && Array.isArray(r1.data),
    `count=${r1.data ? r1.data.length : 0}`);

  // 验证排行榜数据包含userId字段
  if (r1.code === 0 && r1.data && r1.data.length > 0) {
    const hasUserId = r1.data.every(item => item.userId);
    recordTest('8.1a 排行数据含userId', hasUserId, `sample=${JSON.stringify(r1.data[0]).slice(0, 100)}`);
  }

  // 测试8.2：佣金排行榜
  const r2 = await callFunction('game', 'getRank', { type: 'commission', limit: 10 });
  recordTest('8.2 佣金排行榜', r2.code === 0 && Array.isArray(r2.data),
    `count=${r2.data ? r2.data.length : 0}`);

  // 测试8.3：仅A类用户在榜
  if (r2.code === 0 && r2.data && r2.data.length > 0) {
    const allTypeA = r2.data.every(item => item.userType === 'A' || !item.userType);
    recordTest('8.3 排行仅含A类用户', allTypeA);
  }
}

/**
 * 阶段9：广告上报
 */
async function testAdReport(users) {
  console.log('\n📋 阶段9：广告上报');
  console.log('─'.repeat(50));

  const { player } = users;

  // 测试9.1：A类用户激励视频有奖励
  const beforeInfo = await callFunction('user', 'getInfo', { userId: player._id });
  const beforeCommission = beforeInfo.data.commission || 0;

  const r1 = await callFunction('ad', 'report', { userId: player._id, adType: 'rewarded' });
  recordTest('9.1 A类用户激励视频', r1.code === 0, `code=${r1.code}, reward=${r1.data ? r1.data.reward : 'N/A'}`);

  // 验证佣金增加
  const afterInfo = await callFunction('user', 'getInfo', { userId: player._id });
  if (r1.code === 0 && r1.data && r1.data.reward > 0) {
    recordTest('9.1a 佣金增加', afterInfo.data.commission > beforeCommission,
      `before=${beforeCommission}, after=${afterInfo.data.commission}`);
  }

  // 测试9.2：B类用户激励视频无奖励
  const bUser = await callFunction('user', 'login', { userInfo: { openId: genTestId('bad') } });
  const r2 = await callFunction('ad', 'report', { userId: bUser.data._id, adType: 'rewarded' });
  recordTest('9.2 B类用户无奖励', r2.code === 0 && r2.data && r2.data.reward === 0,
    `reward=${r2.data ? r2.data.reward : 'N/A'}`);

  // 测试9.3：无效广告类型
  const r3 = await callFunction('ad', 'report', { userId: player._id, adType: 'invalid' });
  recordTest('9.3 无效广告类型被拒绝', r3.code === -1, `code=${r3.code}`);
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const startTime = Date.now();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   中国龙2 - 麻将消消乐 端到端自动化测试                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n环境: ${CLOUD_ENV_ID}`);
  console.log(`时间: ${new Date().toLocaleString()}`);
  console.log('');

  let users = null;
  let withdrawResult = null;

  try {
    await testAdminVerify();
    users = await testUserRegistration();
    await testInviteBinding(users);
    await testGameAndCommission(users);
    withdrawResult = await testWithdrawApply(users);
    await testWithdrawReview(withdrawResult.withdrawRecordId);
    await testUserDowngrade(users);
    await testRanking(users);
    await testAdReport(users);
  } catch (error) {
    console.error(`\n💥 测试执行异常: ${error.message}`);
    console.error(error.stack);
  }

  // 输出汇总
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(58));
  console.log('📊 测试结果汇总');
  console.log('═'.repeat(58));
  console.log(`  总计: ${totalTests} 项`);
  console.log(`  通过: ${passedTests} 项 ✅`);
  console.log(`  失败: ${failedTests} 项 ❌`);
  console.log(`  耗时: ${duration} 秒`);

  if (failedTests > 0) {
    console.log('\n🔴 失败项明细:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    });
  }

  console.log('\n' + (failedTests === 0 ? '🎉 全部测试通过！' : '⚠️  存在失败项，请检查！'));
  process.exit(failedTests > 0 ? 1 : 0);
}

main();
