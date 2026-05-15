/**
 * 小程序入口
 * 初始化云开发、用户登录、广告模块
 */

const { initAds } = require('./utils/ad');
const { userApi } = require('./services/api');

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

    await initAds();

    await this.login();

    console.log('小程序初始化完成');
  },

  onShow() {
    console.log('小程序显示');
  },

  /**
   * 用户登录
   * 调用后端登录接口，由云函数自动获取openId
   */
  async login() {
    try {
      if (!tt.cloud) {
        console.warn('云开发不可用，跳过登录');
        return;
      }

      const result = await userApi.login({});
      if (result.code === 0 && result.data) {
        this.globalData.userInfo = result.data;
        this.globalData.userId = result.data._id;
        this.globalData.hasLogin = true;
        console.log('登录成功, userId:', result.data._id);
      }
    } catch (error) {
      console.warn('登录失败:', error.message);
    }
  },
});
