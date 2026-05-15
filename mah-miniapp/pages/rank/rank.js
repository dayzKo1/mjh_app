/**
 * 排行榜页面 - 积分排行 / 佣金排行
 * 接入云开发API：gameApi.getRank
 */

const { gameApi } = require('../../services/api');

Page({
  data: {
    tabs: ['积分排行', '佣金排行'],
    currentTab: 0,
    rankList: [],
    loading: true,
    myRank: null,
  },

  onLoad() {
    this.loadRankList();
  },

  /**
   * 切换Tab
   * @param {Object} e - 事件对象，通过 dataset.index 获取目标tab索引
   */
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.currentTab) return;

    this.setData({
      currentTab: index,
      rankList: [],
      loading: true,
      myRank: null,
    });

    this.loadRankList();
  },

  /**
   * 加载排行列表数据
   * 根据 currentTab 决定请求 type：0=score, 1=commission
   */
  async loadRankList() {
    const type = this.data.currentTab === 0 ? 'score' : 'commission';

    try {
      const result = await gameApi.getRank(type, 100);
      const list = result.data || [];

      const app = getApp();
      const userId = app.globalData.userId;
      let myRank = null;

      if (userId) {
        const found = list.find(item => item.userId === userId);
        if (found) {
          myRank = found;
        }
      }

      this.setData({
        rankList: list,
        loading: false,
        myRank,
      });
    } catch (error) {
      console.warn('获取排行榜失败:', error.message);
      this.setData({ loading: false });
      tt.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 获取排名图标
   * 前三名返回金银铜标识，其余返回排名数字
   * @param {number} rank - 排名序号（从1开始）
   * @returns {string} 排名显示内容
   */
  getRankIcon(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return String(rank);
  },
});
