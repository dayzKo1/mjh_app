/**
 * 共享配置模块
 * 集中管理所有云函数的配置，包括管理员Token等敏感信息
 * 上线前必须通过环境变量设置 ADMIN_TOKEN，否则验证将始终失败
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

if (!ADMIN_TOKEN) {
  console.warn('[config] ADMIN_TOKEN 未设置，管理员验证将始终失败！请通过环境变量配置 ADMIN_TOKEN');
}

module.exports = {
  ADMIN_TOKEN,

  verifyAdminToken(event) {
    if (!ADMIN_TOKEN) return false;
    const token = event.adminToken || event.headers?.adminToken || event.headers?.['x-admin-token'] || '';
    return token === ADMIN_TOKEN;
  },
};
