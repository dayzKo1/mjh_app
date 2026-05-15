/**
 * 共享配置模块
 * 集中管理所有云函数的配置，包括管理员Token等敏感信息
 */

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'mah_admin_2026';

module.exports = {
  ADMIN_TOKEN,

  verifyAdminToken(event) {
    const token = event.adminToken || event.headers?.adminToken || event.headers?.['x-admin-token'] || '';
    return token === ADMIN_TOKEN;
  },
};
