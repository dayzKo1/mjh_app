/**
 * 个人中心页面
 * 展示用户信息、资产数据、游戏记录及功能入口
 */

const { userApi, gameApi, withdrawApi } = require('../../services/api');

Page({
  data: {
    userInfo: null,
    userId: '',
    commission: 0,
    totalWithdraw: 0,
    userType: 'B',
    maxLevel: 1,
    totalScore: 0,
    totalGames: 0,
    loading: true,
  },

  /**
   * 页面显示时加载用户数据
   */
  onShow() {
    this.loadUserInfo();
  },

  /**
   * 加载用户信息与游戏记录
   * 从全局数据获取userId，并行请求用户信息和游戏记录
   */
  async loadUserInfo() {
    const app = getApp();
    const userId = app.globalData.userId;

    if (!userId) {
      tt.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        tt.navigateBack();
      }, 1500);
      return;
    }

    this.setData({ userId });

    try {
      const [userRes, gameRes] = await Promise.all([
        userApi.getInfo(userId),
        gameApi.getUserRecords(userId, 1),
      ]);

      const userData = userRes.data || {};
      const gameData = gameRes.data || {};

      const maxLevel = gameData.maxLevel || userData.level || 1;
      const totalScore = gameData.totalScore || 0;
      const totalGames = gameData.totalGames || 0;

      this.setData({
        userInfo: userData,
        userType: userData.userType || 'B',
        commission: userData.commission || 0,
        totalWithdraw: userData.totalWithdraw || 0,
        maxLevel,
        totalScore,
        totalGames,
        loading: false,
      });
    } catch (error) {
      console.warn('加载用户数据失败:', error.message);
      this.setData({ loading: false });
      tt.showToast({ title: '加载失败，请重试', icon: 'none' });
    }
  },

  /**
   * 页面跳转方法
   * 通过dataset中的page字段获取目标页面路径
   */
  onNavigateTo(e) {
    const page = e.currentTarget.dataset.page;
    if (!page) return;
    tt.navigateTo({ url: page });
  },

  /**
   * 跳转到提现页面
   */
  onWithdraw() {
    tt.navigateTo({ url: '/pages/withdraw/withdraw' });
  },

  /**
   * 跳转到邀请页面
   */
  onInvite() {
    tt.navigateTo({ url: '/pages/invite/invite' });
  },

  /**
   * 跳转到排行榜页面
   */
  onRank() {
    tt.navigateTo({ url: '/pages/rank/rank' });
  },

  /**
   * 查看游戏记录
   * 跳转回游戏页面查看历史记录
   */
  onGameRecords() {
    tt.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 关于页面
   */
  onAbout() {
    tt.showModal({
      title: '关于',
      content: '中国龙2 - 麻将消消乐\n一款休闲益智的麻将消除游戏\n邀请好友即可赚取佣金！',
      showCancel: false,
    });
  },

  /**
   * 联系客服
   * 使用抖音IM客服能力
   */
  onContactService() {
    if (typeof tt.openCustomerServiceChat === 'function') {
      tt.openCustomerServiceChat({
        success: () => {
          console.log('客服窗口已打开');
        },
        fail: (err) => {
          console.warn('打开客服失败:', err);
          tt.showModal({
            title: '联系客服',
            content: '客服微信：mjh_service\n工作时间：9:00-18:00',
            showCancel: false,
          });
        },
      });
    } else {
      tt.showModal({
        title: '联系客服',
        content: '客服微信：mjh_service\n工作时间：9:00-18:00',
        showCancel: false,
      });
    }
  },

  /**
   * 编辑昵称
   */
  onEditNickname() {
    const app = getApp();
    const userId = app.globalData.userId;
    if (!userId) return;

    tt.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      content: this.data.userInfo.nickName || '',
      success: async (res) => {
        if (res.confirm && res.content) {
          const nickName = res.content.trim();
          if (nickName.length > 0 && nickName.length <= 20) {
            try {
              const checkResult = await userApi.contentCheck(nickName);
              if (checkResult.code === 0 && checkResult.data && !checkResult.data.safe) {
                tt.showToast({ title: '昵称包含违规内容', icon: 'none' });
                return;
              }
            } catch (checkErr) {
              console.warn('内容安全检测失败，继续提交:', checkErr.message);
            }

            try {
              await userApi.updateInfo(userId, { nickName });
              tt.showToast({ title: '昵称修改成功', icon: 'success' });
              this.loadUserInfo();
            } catch (error) {
              tt.showToast({ title: '修改失败', icon: 'none' });
            }
          } else {
            tt.showToast({ title: '昵称长度1-20字', icon: 'none' });
          }
        }
      }
    });
  },
});
