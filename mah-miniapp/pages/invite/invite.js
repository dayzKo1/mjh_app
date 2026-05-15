/**
 * 邀请好友页面
 * 三级分佣体系：一级10%、二级5%、三级2%
 * 绑定邀请人后B类用户自动升级为A类
 */

const { userApi } = require('../../services/api');

Page({
  data: {
    userId: '',
    inviteList: {
      level1: [],
      level2: [],
      level3: [],
    },
    totalInvite: 0,
    userType: 'B',
    loading: true,
    showBindModal: false,
    inviterIdInput: '',
    inviterId: '',
    level1Expanded: true,
    level2Expanded: false,
    level3Expanded: false,
  },

  /**
   * 页面显示时加载数据
   */
  onShow() {
    this.loadData();
  },

  /**
   * 加载页面数据
   * 获取用户信息和邀请列表，计算邀请总人数
   */
  async loadData() {
    const app = getApp();
    const userId = app.globalData.userId;
    if (!userId) {
      console.warn('用户未登录，跳过加载邀请数据');
      this.setData({ loading: false });
      return;
    }

    this.setData({ userId });

    try {
      const [infoRes, inviteRes] = await Promise.all([
        userApi.getInfo(userId),
        userApi.getInviteList(userId),
      ]);

      const userInfo = infoRes.data || {};
      const inviteList = inviteRes.data || { level1: [], level2: [], level3: [] };
      const totalInvite =
        (inviteList.level1 ? inviteList.level1.length : 0) +
        (inviteList.level2 ? inviteList.level2.length : 0) +
        (inviteList.level3 ? inviteList.level3.length : 0);

      this.setData({
        userType: userInfo.userType || 'B',
        inviterId: userInfo.inviterId || '',
        inviteList,
        totalInvite,
        loading: false,
      });
    } catch (error) {
      console.warn('加载邀请数据失败:', error.message);
      this.setData({ loading: false });
    }
  },

  /**
   * 分享功能
   * 返回分享标题和路径（携带userId参数）
   */
  onShareAppMessage() {
    return {
      title: '麻将消消乐 - 一起玩赚佣金！',
      path: `/pages/game/game?inviterId=${this.data.userId}`,
    };
  },

  /**
   * 复制邀请码到剪贴板
   */
  onCopyInviteCode() {
    tt.setClipboardData({
      data: this.data.userId,
      success: () => {
        tt.showToast({ title: '邀请码已复制', icon: 'success' });
      },
      fail: () => {
        tt.showToast({ title: '复制失败', icon: 'none' });
      },
    });
  },

  /**
   * 显示绑定邀请人弹窗
   */
  onShowBindModal() {
    this.setData({ showBindModal: true });
  },

  /**
   * 隐藏绑定邀请人弹窗
   */
  onHideBindModal() {
    this.setData({ showBindModal: false, inviterIdInput: '' });
  },

  /**
   * 输入邀请人ID
   */
  onInviterIdInput(e) {
    this.setData({ inviterIdInput: e.detail.value });
  },

  /**
   * 绑定邀请人
   * 调用API绑定后刷新页面数据
   */
  async onBindInviter() {
    const { userId, inviterIdInput } = this.data;
    if (!inviterIdInput.trim()) {
      tt.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    if (inviterIdInput.trim() === userId) {
      tt.showToast({ title: '不能绑定自己', icon: 'none' });
      return;
    }

    try {
      await userApi.bindInviter(userId, inviterIdInput.trim());
      tt.showToast({ title: '绑定成功', icon: 'success' });
      this.onHideBindModal();
      this.loadData();
    } catch (error) {
      tt.showToast({ title: error.message || '绑定失败', icon: 'none' });
    }
  },

  /**
   * 切换层级列表展开/折叠状态
   */
  onToggleLevel(e) {
    const level = e.currentTarget.dataset.level;
    const key = `level${level}Expanded`;
    this.setData({ [key]: !this.data[key] });
  },

  /**
   * 获取层级标签
   * @param {number} level - 层级（1/2/3）
   * @returns {string} 层级标签文本
   */
  getLevelLabel(level) {
    const labels = { 1: '一级好友', 2: '二级好友', 3: '三级好友' };
    return labels[level] || '';
  },
});
