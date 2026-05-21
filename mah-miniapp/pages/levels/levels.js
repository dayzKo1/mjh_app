/**
 * 关卡选择页面
 * 支持关卡解锁机制：通关后解锁下一关
 */

const { userApi } = require('../../services/api');

// 关卡配置
const LEVELS_CONFIG = [
  { id: 1, name: '入门', difficulty: 1, iconCount: 6, layers: 3 },
  { id: 2, name: '简单', difficulty: 2, iconCount: 7, layers: 3 },
  { id: 3, name: '普通', difficulty: 3, iconCount: 8, layers: 4 },
  { id: 4, name: '中等', difficulty: 4, iconCount: 9, layers: 4 },
  { id: 5, name: '困难', difficulty: 5, iconCount: 10, layers: 5 },
  { id: 6, name: '挑战', difficulty: 6, iconCount: 11, layers: 5 },
  { id: 7, name: '专家', difficulty: 7, iconCount: 12, layers: 5 },
  { id: 8, name: '大师', difficulty: 8, iconCount: 13, layers: 6 },
  { id: 9, name: '传奇', difficulty: 9, iconCount: 14, layers: 6 },
  { id: 10, name: '神话', difficulty: 10, iconCount: 15, layers: 7 },
];

// 麻将牌图标名称映射（用于显示）
const ICON_NAMES = {
  'Bamboo_1': '一万', 'Bamboo_2': '二万', 'Bamboo_3': '三万',
  'Bamboo_4': '四万', 'Bamboo_5': '五万', 'Bamboo_6': '六万',
  'Bamboo_7': '七万', 'Bamboo_8': '八万', 'Bamboo_9': '九万',
  'Char_1': '一条', 'Char_2': '二条', 'Char_3': '三条',
  'Char_4': '四条', 'Char_5': '五条', 'Char_6': '六条',
  'Char_7': '七条', 'Char_8': '八条', 'Char_9': '九条',
  'Wheel_1': '一筒', 'Wheel_2': '二筒', 'Wheel_3': '三筒',
  'Wheel_4': '四筒', 'Wheel_5': '五筒', 'Wheel_6': '六筒',
  'Wheel_7': '七筒', 'Wheel_8': '八筒', 'Wheel_9': '九筒',
  'Wind_East': '东风', 'Wind_South': '南风', 'Wind_West': '西风', 'Wind_North': '北风',
  'Dragon_Red': '红中', 'Dragon_Green': '发财', 'Dragon_White': '白板',
};

Page({
  data: {
    levels: [],
    unlockedLevel: 1,      // 已解锁的最高关卡
    totalScore: 0,         // 总积分
    completedLevels: [],   // 已通关关卡列表
    bestScores: {},        // 各关卡最高分
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
      isUnlocked: level.id === 1,  // 只有第一关默认解锁
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

        // 通关上一关才能解锁下一关
        levels = levels.map((level, index) => {
          const isCompleted = completedLevels.includes(level.id);
          const bestScore = bestScores[level.id] || 0;
          
          // 解锁条件：第一关默认解锁，或上一关已通关
          const isUnlocked = level.id === 1 || (index > 0 && levels[index - 1].isCompleted);

          // 计算星级
          let stars = 0;
          if (isCompleted) {
            stars = 1;
            if (bestScore >= 30) stars = 2;
            if (bestScore >= 50) stars = 3;
          }

          return {
            ...level,
            isUnlocked,
            isCompleted,
            bestScore,
            stars,
          };
        });

        // 需要再次处理解锁状态（因为map中levels[index-1]还未更新）
        levels = levels.map((level, index) => {
          if (level.id === 1) return level;
          const prevCompleted = completedLevels.includes(level.id - 1);
          return {
            ...level,
            isUnlocked: prevCompleted,
          };
        });

        this.setData({
          levels,
          completedLevels,
          bestScores,
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
   * 获取难度颜色
   */
  getDifficultyColor(difficulty) {
    const colors = {
      1: '#4CAF50',   // 绿色 - 入门
      2: '#8BC34A',   // 浅绿 - 简单
      3: '#CDDC39',   // 黄绿 - 普通
      4: '#FFEB3B',   // 黄色 - 中等
      5: '#FFC107',   // 橙黄 - 困难
      6: '#FF9800',   // 橙色 - 挑战
      7: '#FF5722',   // 深橙 - 专家
      8: '#F44336',   // 红色 - 大师
      9: '#E91E63',   // 粉红 - 传奇
      10: '#9C27B0',  // 紫色 - 神话
    };
    return colors[difficulty] || '#4CAF50';
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