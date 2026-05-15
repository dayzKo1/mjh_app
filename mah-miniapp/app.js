/**
 * 小程序入口
 * 
 * 模拟器中云开发和广告API可能不可用，做了安全检查
 */

const { initAds } = require('./utils/ad');

App({
  globalData: {
    userInfo: null,
    userId: null,
    hasLogin: false,
  },

  /**
   * 小程序初始化
   */
  async onLaunch() {
    console.log('小程序启动', tt.getLaunchOptionsSync());

    // 初始化云开发（如果可用）
    try {
      if (tt.cloud) {
        tt.cloud.init({
          env: 'your-env-id',
          traceUser: true,
        });
        console.log('云开发初始化成功');
      } else {
        console.log('当前环境不支持云开发');
      }
    } catch (e) {
      console.warn('云开发初始化失败:', e.message);
    }

    // 初始化广告（模拟器中可能不可用）
    await initAds();

    // 模拟器中暂不登录，游戏可正常玩
    console.log('小程序初始化完成');
  },

  onShow() {
    console.log('小程序显示');
  },
});
