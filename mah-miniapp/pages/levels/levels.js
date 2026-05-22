/**
 * 关卡选择页面 - 麻将消消乐主题
 * 支持：两个分支（入门/挑战），每个分支3条线路共8关
 */

const { userApi } = require('../../services/api');

// 关卡配置 - 分支结构
const LEVELS_CONFIG = {
  // 入门模式 - 8关分布在3条线路
  beginner: {
    name: '入门模式',
    color: '#22c55e',
    lines: [
      {
        id: 'a',
        name: '基础线',
        color: '#84cc16',
        levels: [
          { id: 1, name: '入门', difficulty: 1, iconCount: 6, layers: 3 },
          { id: 2, name: '初学', difficulty: 2, iconCount: 6, layers: 3 },
          { id: 3, name: '熟练', difficulty: 3, iconCount: 7, layers: 3 },
        ],
      },
      {
        id: 'b',
        name: '进防线',
        color: '#10b981',
        levels: [
          { id: 4, name: '精通', difficulty: 4, iconCount: 7, layers: 4 },
          { id: 5, name: '高手', difficulty: 5, iconCount: 8, layers: 4 },
          { id: 6, name: '大师', difficulty: 6, iconCount: 8, layers: 4 },
        ],
      },
      {
        id: 'c',
        name: '精通线',
        color: '#14b8a6',
        levels: [
          { id: 7, name: '宗师', difficulty: 7, iconCount: 9, layers: 5 },
          { id: 8, name: '王者', difficulty: 8, iconCount: 10, layers: 5 },
        ],
      },
    ],
  },
  // 挑战模式 - 8关分布在3条线路，难度更高
  challenge: {
    name: '挑战模式',
    color: '#8b5cf6',
    lines: [
      {
        id: 'a',
        name: '挑战线',
        color: '#06b6d4',
        levels: [
          { id: 101, name: '挑战1', difficulty: 3, iconCount: 8, layers: 4 },
          { id: 102, name: '挑战2', difficulty: 4, iconCount: 8, layers: 4 },
          { id: 103, name: '挑战3', difficulty: 5, iconCount: 9, layers: 4 },
        ],
      },
      {
        id: 'b',
        name: '高手线',
        color: '#3b82f6',
        levels: [
          { id: 104, name: '高手1', difficulty: 6, iconCount: 9, layers: 5 },
          { id: 105, name: '高手2', difficulty: 7, iconCount: 10, layers: 5 },
          { id: 106, name: '高手3', difficulty: 8, iconCount: 10, layers: 5 },
        ],
      },
      {
        id: 'c',
        name: '王者线',
        color: '#a855f7',
        levels: [
          { id: 107, name: '王者1', difficulty: 9, iconCount: 11, layers: 6 },
          { id: 108, name: '王者2', difficulty: 10, iconCount: 12, layers: 6 },
        ],
      },
    ],
  },
};

// 扁平化获取所有关卡
function getAllLevels() {
  const allLevels = [];
  Object.values(LEVELS_CONFIG).forEach((branch) => {
    branch.lines.forEach((line) => {
      line.levels.forEach((level) => {
        allLevels.push({
          ...level,
          branch: branch.name,
          branchColor: branch.color,
          lineName: line.name,
          lineColor: line.color,
        });
      });
    });
  });
  return allLevels;
}

Page({
  data: {
    currentBranch: 'beginner', // 当前选中的分支
    branches: [
      { id: 'beginner', name: '入门模式', color: '#22c55e' },
      { id: 'challenge', name: '挑战模式', color: '#8b5cf6' },
    ],
    lines: [], // 当前分支的线路列表
    allLevels: [], // 所有关卡（用于查找关卡配置）
    completedLevels: [],
    bestScores: {},
    totalScore: 0,
    loading: true,
  },

  onLoad() {
    this.loadUserProgress();
  },

  onShow() {
    this.loadUserProgress();
  },

  /**
   * 切换分支（入门/挑战）
   */
  switchBranch(e) {
    const branchId = e.currentTarget.dataset.branch;
    if (branchId === this.data.currentBranch) return;

    this.setData({ currentBranch: branchId });
    this.updateLinesData();
  },

  /**
   * 更新线路数据（包含关卡状态）
   */
  updateLinesData() {
    const branch = LEVELS_CONFIG[this.data.currentBranch];
    if (!branch) return;

    const { completedLevels, bestScores } = this.data;

    const lines = branch.lines.map((line) => {
      const levels = line.levels.map((level) => {
        const isCompleted = completedLevels.some(id => parseInt(id) === level.id);
        const bestScore = bestScores[level.id] || 0;

        let isUnlocked = false;
        if (level.id === 1 || level.id === 101) {
          isUnlocked = true;
        } else {
          const prevId = level.id <= 8 ? level.id - 1 : level.id - 1;
          isUnlocked = completedLevels.some(id => parseInt(id) === prevId);
        }

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
          lineColor: line.color,
        };
      });

      return {
        ...line,
        levels,
      };
    });

    this.setData({ lines });
  },

  /**
   * 加载用户进度数据
   */
  async loadUserProgress() {
    const app = getApp();
    const userId = app.globalData.userId;

    // 初始化所有关卡配置
    const allLevels = getAllLevels();

    if (userId) {
      try {
        const result = await userApi.getProgress(userId);
        const progress = result.data || {};

        const completedLevels = progress.completedLevels || [];
        const bestScores = progress.bestScores || {};
        let totalScore = 0;

        // 计算总分
        Object.values(bestScores).forEach((score) => {
          totalScore += score || 0;
        });

        this.setData(
          {
            allLevels,
            completedLevels,
            bestScores,
            totalScore,
            loading: false,
          },
          () => {
            this.updateLinesData();
          }
        );
      } catch (error) {
        console.warn('加载进度失败:', error.message);
        this.setData({ allLevels, loading: false }, () => {
          this.updateLinesData();
        });
      }
    } else {
      this.setData({ allLevels, loading: false }, () => {
        this.updateLinesData();
      });
    }
  },

  /**
   * 点击关卡
   */
  onLevelTap(e) {
    if (this.data.loading) {
      tt.showToast({ title: '加载中，请稍候', icon: 'none' });
      return;
    }

    const levelId = parseInt(e.currentTarget.dataset.id);
    
    if (!levelId || isNaN(levelId)) {
      tt.showToast({ title: '关卡ID无效', icon: 'none' });
      return;
    }

    const level = this.data.allLevels.find((l) => l.id === levelId);

    if (!level) {
      console.error('关卡不存在，levelId:', levelId, 'allLevels:', this.data.allLevels.map(l => l.id));
      tt.showToast({ title: '关卡不存在', icon: 'none' });
      return;
    }

    const { completedLevels } = this.data;
    let isUnlocked = false;
    if (levelId === 1 || levelId === 101) {
      isUnlocked = true;
    } else {
      const prevId = levelId <= 8 ? levelId - 1 : levelId - 1;
      isUnlocked = completedLevels.some(id => parseInt(id) === prevId);
    }

    if (!isUnlocked) {
      tt.showToast({ title: '关卡未解锁', icon: 'none' });
      return;
    }

    console.log('进入游戏，关卡:', levelId, 'iconCount:', level.iconCount, 'layers:', level.layers);

    tt.navigateTo({
      url: `/pages/game/game?level=${levelId}&iconCount=${level.iconCount}&layers=${level.layers}`,
      fail: (err) => {
        console.error('跳转失败:', err);
        tt.showToast({ title: '跳转失败', icon: 'none' });
      }
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