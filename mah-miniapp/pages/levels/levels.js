/**
 * 关卡选择页面 - 包了个包主题
 * 支持关卡解锁机制：通关后解锁下一关
 */

const { userApi } = require('../../services/api');

// 关卡配置 - 面包主题名称
const LEVELS_CONFIG = [
  { id: 1, name: '吐司', difficulty: 1, iconCount: 6, layers: 3, color: '#84cc16' },
  { id: 2, name: '甜甜圈', difficulty: 2, iconCount: 7, layers: 3, color: '#22c55e' },
  { id: 3, name: '法棍', difficulty: 3, iconCount: 8, layers: 4, color: '#10b981' },
  { id: 4, name: '松饼', difficulty: 4, iconCount: 9, layers: 4, color: '#14b8a6' },
  { id: 5, name: '可颂', difficulty: 5, iconCount: 10, layers: 5, color: '#06b6d4' },
  { id: 6, name: '牛角包', difficulty: 6, iconCount: 11, layers: 5, color: '#0ea5e9' },
  { id: 7, name: '菠萝包', difficulty: 7, iconCount: 12, layers: 5, color: '#3b82f6' },
  { id: 8, name: '丹麦包', difficulty: 8, iconCount: 13, layers: 6, color: '#8b5cf6' },
  { id: 9, name: '欧包', difficulty: 9, iconCount: 14, layers: 6, color: '#a855f7' },
  { id: 10, name: '大师包', difficulty: 10, iconCount: 15, layers: 7, color: '#ec4899' },
];

Page({
  data: {
    levels: [],
    unlockedLevel: 1,
    totalScore: 0,
    completedLevels: [],
    bestScores: {},
    loading: true,
  },

  onLoad() {
    this.loadUserProgress();
  },

  onShow() {
    this.loadUserProgress();
  },

  /**
   * 加载用户进度数据
   */
  async loadUserProgress() {
    const app = getApp();
    const userId = app.globalData.userId;

    // 初始化关卡列表 - 第一关默认解锁
    let levels = LEVELS_CONFIG.map(level => ({
      ...level,
      isUnlocked: level.id === 1,
      isCompleted: false,
      bestScore: 0,
      stars: 0,
    }));

    if (userId) {
      try {
        const result = await userApi.getProgress(userId);
        const progress = result.data || {};

        const completedLevels = progress.completedLevels || [];
        const bestScores = progress.bestScores || {};
        let totalScore = 0;

        // 处理关卡状态
        levels = levels.map((level) => {
          const isCompleted = completedLevels.includes(level.id);
          const bestScore = bestScores[level.id] || 0;
          totalScore += bestScore;
          
          // 解锁条件：第一关默认解锁，或上一关已通关
          const prevCompleted = level.id === 1 || completedLevels.includes(level.id - 1);

          // 计算星级
          let stars = 0;
          if (isCompleted) {
            stars = 1;
            if (bestScore >= 30) stars = 2;
            if (bestScore >= 50) stars = 3;
          }

          return {
            ...level,
            isUnlocked: prevCompleted,
            isCompleted,
            bestScore,
            stars,
          };
        });

        this.setData({
          levels,
          completedLevels,
          bestScores,
          totalScore,
          loading: false,
        });
      } catch (error) {
        console.warn('加载进度失败:', error.message);
        this.setData({ levels, loading: false });
      }
    } else {
      this.setData({ levels, loading: false });
    }
  },

  /**
   * 点击关卡
   */
  onLevelTap(e) {
    const levelId = e.currentTarget.dataset.id;
    const level = this.data.levels.find(l => l.id === levelId);

    if (!level || !level.isUnlocked) {
      tt.showToast({ title: '关卡未解锁', icon: 'none' });
      return;
    }

    // 进入游戏页面
    tt.navigateTo({
      url: `/pages/game/game?level=${levelId}`,
    });
  },

  /**
   * 跳转到个人中心
   */
  goToProfile() {
    tt.navigateTo({ url: '/pages/profile/profile' });
  },

  /**
   * 跳转到排行榜
   */
  goToRank() {
    tt.navigateTo({ url: '/pages/rank/rank' });
  },
});