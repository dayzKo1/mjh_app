/**
 * 小程序入口
 * 初始化云开发、用户登录、广告模块、侧边栏复访监听
 */

const { initAds } = require('./utils/ad');
const { userApi } = require('./services/api');

/** 侧边栏场景值 */
const SIDEBAR_SCENES = ['021036', '101036', '021012'];

App({
  globalData: {
    userInfo: null,
    userId: null,
    hasLogin: false,
    /** 是否支持侧边栏跳转 */
    sidebarSupported: false,
    /** 是否从侧边栏启动（最新 onShow 值） */
    fromSidebar: false,
    /** 今日是否已领取侧边栏奖励 */
    sidebarRewardClaimed: false,
  },

  /**
   * 小程序初始化
   * 抖音云通过 tt.createCloud 初始化，无需手动 init
   */
  async onLaunch() {
    console.log('小程序启动', tt.getLaunchOptionsSync());

    try {
      if (tt.createCloud) {
        console.log('云开发可用（支持 tt.createCloud）');
      } else if (tt.cloud) {
        console.log('云开发可用（旧版 tt.cloud）');
      } else {
        console.log('当前环境不支持云开发');
      }
    } catch (e) {
      console.warn('云开发检查失败:', e.message);
    }

    this.checkSidebarSupport();

    await initAds();

    await this.login();

    console.log('小程序初始化完成');
  },

  /**
   * 监听 onShow 事件
   * 必须在 onLaunch 时机同步注册，确保侧边栏热启动时能收到回调
   */
  onShow(options) {
    console.log('小程序显示', options);

    if (options) {
      const scene = options.scene || '';
      const launchFrom = options.launch_from || '';
      const location = options.location || '';

      const fromSidebar = SIDEBAR_SCENES.includes(String(scene))
        || launchFrom === 'homepage'
        || location === 'sidebar_card';

      this.globalData.fromSidebar = fromSidebar;

      if (fromSidebar) {
        console.log('从侧边栏启动，可领取奖励');
      }
    }
  },

  /**
   * 检查当前宿主是否支持侧边栏跳转
   */
  checkSidebarSupport() {
    if (typeof tt.checkScene === 'function') {
      tt.checkScene({
        scene: 'sidebar',
        success: (res) => {
          this.globalData.sidebarSupported = !!res.isExist;
          console.log('侧边栏能力检测结果:', res.isExist);
        },
        fail: () => {
          this.globalData.sidebarSupported = false;
        },
      });
    } else {
      this.globalData.sidebarSupported = false;
    }
  },

  /**
   * 跳转到抖音首页侧边栏
   * @returns {Promise<boolean>} 是否跳转成功
   */
  navigateToSidebar() {
    return new Promise((resolve) => {
      if (typeof tt.navigateToScene !== 'function') {
        tt.showToast({ title: '当前版本不支持', icon: 'none' });
        resolve(false);
        return;
      }

      tt.navigateToScene({
        scene: 'sidebar',
        success: () => {
          console.log('跳转侧边栏成功');
          resolve(true);
        },
        fail: (err) => {
          console.warn('跳转侧边栏失败:', err);
          tt.showToast({ title: '跳转失败，请手动从侧边栏进入', icon: 'none' });
          resolve(false);
        },
      });
    });
  },

  /**
   * 用户登录
   * 调用后端登录接口，由云函数自动获取openId
   */
  async login() {
    try {
      if (!tt.createCloud && !tt.cloud) {
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
