/**
 * 游戏页面 - 麻将消消乐主题
 * 麻将三消益智游戏
 */

const { showRewardedAd } = require('../../utils/ad');
const { playSound, preloadSounds, destroySounds } = require('../../utils/sound');
const { gameApi, userApi, adApi } = require('../../services/api');

// 关卡名称映射 - 麻将主题
const LEVEL_NAMES = {
  1: '入门', 2: '初学', 3: '入门', 4: '熟练', 5: '精通',
  6: '高手', 7: '大师', 8: '宗师', 9: '王者', 10: '传奇',
};

const MAHJONG_TILES = [
  'Bamboo_1', 'Bamboo_2', 'Bamboo_3', 'Bamboo_4', 'Bamboo_5',
  'Bamboo_6', 'Bamboo_7', 'Bamboo_8', 'Bamboo_9',
  'Char_1', 'Char_2', 'Char_3', 'Char_4', 'Char_5',
  'Char_6', 'Char_7', 'Char_8', 'Char_9',
  'Wheel_1', 'Wheel_2', 'Wheel_3', 'Wheel_4', 'Wheel_5',
  'Wheel_6', 'Wheel_7', 'Wheel_8', 'Wheel_9',
  'Wind_East', 'Wind_South', 'Wind_West', 'Wind_North',
  'Dragon_Red', 'Dragon_Green', 'Dragon_White'
];

const MAX_SLOTS = 7;
const CARD_W_RPX = 72;
const CARD_H_RPX = 96;

function shuffleArray(arr) {
  const res = arr.slice();
  for (let i = res.length - 1; i > 0; i--) {
    const idx = Math.floor(Math.random() * (i + 1));
    [res[i], res[idx]] = [res[idx], res[i]];
  }
  return res;
}

function generateId() {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36).slice(-4);
}

function generateScene(level, customIconCount = null, customLayers = null) {
  // 支持自定义参数，或根据关卡计算默认值
  const iconCount = customIconCount || Math.min(6 + Math.floor((level - 1) / 2), MAHJONG_TILES.length);
  const selectedIcons = MAHJONG_TILES.slice(0, iconCount);
  const layers = customLayers || (level <= 2 ? 3 : level <= 5 ? 4 : 5);

  const allCards = [];
  selectedIcons.forEach(icon => {
    for (let i = 0; i < 3; i++) {
      allCards.push({ icon });
    }
  });

  const shuffledCards = shuffleArray(allCards);
  const totalCards = shuffledCards.length;
  const scene = [];
  let cardIndex = 0;

  const areaW = 640;
  const areaH = 520;

  for (let layer = 0; layer < layers && cardIndex < totalCards; layer++) {
    let layerCards = layer === layers - 1 
      ? totalCards - cardIndex 
      : Math.min(Math.ceil(totalCards / layers) + 2, totalCards - cardIndex);

    const cols = layer === 0 ? 5 : 4;
    const rows = Math.ceil(layerCards / cols);
    const offsetX = layer * 12;
    const offsetY = layer * 8;
    const gridWidth = cols * (CARD_W_RPX + 6);
    const gridHeight = rows * (CARD_H_RPX + 6);
    const startX = (areaW - gridWidth) / 2;
    const startY = (areaH - gridHeight) / 2;

    for (let i = 0; i < layerCards && cardIndex < totalCards; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (CARD_W_RPX + 6) + offsetX + (Math.random() - 0.5) * 4;
      const y = startY + row * (CARD_H_RPX + 6) + offsetY + (Math.random() - 0.5) * 4;

      scene.push({
        id: generateId(),
        icon: shuffledCards[cardIndex].icon,
        x: Math.max(0, Math.min(areaW - CARD_W_RPX, x)),
        y: Math.max(0, Math.min(areaH - CARD_H_RPX, y)),
        layer,
        isCover: false,
        status: 0
      });
      cardIndex++;
    }
  }

  return checkCover(scene.sort((a, b) => a.layer - b.layer));
}

function calculateOverlap(x1, y1, x2, y2, x3, y3, x4, y4) {
  const ox1 = Math.max(x1, x3);
  const oy1 = Math.max(y1, y3);
  const ox2 = Math.min(x2, x4);
  const oy2 = Math.min(y2, y4);

  if (ox1 >= ox2 || oy1 >= oy2) return 0;
  const overlapArea = (ox2 - ox1) * (oy2 - oy1);
  const minArea = Math.min((x2 - x1) * (y2 - y1), (x4 - x3) * (y4 - y3));
  return overlapArea / minArea;
}

function checkCover(scene) {
  for (let i = 0; i < scene.length; i++) {
    const cur = scene[i];
    cur.isCover = false;
    if (cur.status !== 0) continue;

    const x1 = cur.x, y1 = cur.y;
    const x2 = x1 + CARD_W_RPX, y2 = y1 + CARD_H_RPX;

    for (let j = 0; j < scene.length; j++) {
      const cmp = scene[j];
      if (cmp.status !== 0 || cmp.layer <= cur.layer || i === j) continue;

      const overlap = calculateOverlap(x1, y1, x2, y2, cmp.x, cmp.y, cmp.x + CARD_W_RPX, cmp.y + CARD_H_RPX);
      if (overlap > 0.3) {
        cur.isCover = true;
        break;
      }
    }
  }
  return scene;
}

function arrangeSlots(slots) {
  const filled = slots.filter(s => s !== null);
  const groups = {};
  const order = [];
  filled.forEach(card => {
    if (!groups[card.icon]) {
      groups[card.icon] = [];
      order.push(card.icon);
    }
    groups[card.icon].push(card);
  });

  const arranged = [];
  order.forEach(iconName => {
    arranged.push(...groups[iconName]);
  });

  while (arranged.length < MAX_SLOTS) {
    arranged.push(null);
  }
  return arranged;
}

Page({
  data: {
    level: 1,
    levelName: '入门',
    customIconCount: null,
    customLayers: null,
    score: 0,
    cards: [],
    slots: [null, null, null, null, null, null, null],
    timer: null,
    animating: false,
    cardAnimations: {},
    gameOverState: false,
    
    undoCount: 3,
    findCount: 3,
    bombCount: 2,
    
    showUndoPanel: false,
    showFindPanel: false,
    showBombPanel: false,
    undoCandidates: [],
    findCandidates: [],
    bombCandidates: [],
    hintCardId: null,
    
    timeProgress: 100,
    hasUsedTimeAd: false,
    hasUsedReviveAd: false,
    
    showWinModal: false,
    showFailModal: false,
    showTimeWarningModal: false,
    
    savedProgress: null,

    /** 是否显示侧边栏礼包入口 */
    showSidebarGift: false,
    /** 是否显示侧边栏引导弹窗 */
    showSidebarModal: false,
    /** 侧边栏任务是否已完成 */
    sidebarTaskDone: false,
    /** 加载状态 */
    loading: false,
  },

  onLoad(options) {
    const level = parseInt(options.level) || 1;
    const iconCount = parseInt(options.iconCount) || null;
    const layers = parseInt(options.layers) || null;

    // 更新关卡名称映射以支持挑战模式关卡
    const levelName = this.getLevelName(level);

    this.setData({ 
      level,
      levelName,
      customIconCount: iconCount,
      customLayers: layers,
    });
    preloadSounds();
  },

  getLevelName(level) {
    // 入门模式关卡名称
    const beginnerNames = {
      1: '入门', 2: '初学', 3: '熟练', 4: '精通',
      5: '高手', 6: '大师', 7: '宗师', 8: '王者',
    };
    // 挑战模式关卡名称
    const challengeNames = {
      101: '挑战1', 102: '挑战2', 103: '挑战3',
      104: '高手1', 105: '高手2', 106: '高手3',
      107: '王者1', 108: '王者2',
    };

    return beginnerNames[level] || challengeNames[level] || '未知';
  },

  onShow() {
    this.initGame();
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
    destroySounds();
  },

  initGame() {
    const level = this.data.level;
    const iconCount = this.data.customIconCount;
    const layers = this.data.customLayers;
    const cards = generateScene(level, iconCount, layers);
    const levelName = this.getLevelName(level);

    console.log('关卡', level, levelName, '卡片数', cards.length, 'iconCount', iconCount, 'layers', layers);

    this.setData({
      levelName,
      cards,
      slots: [null, null, null, null, null, null, null],
      animating: false,
      gameOverState: false,
      undoCount: 3,
      findCount: 3,
      bombCount: 2,
      showUndoPanel: false,
      showFindPanel: false,
      showBombPanel: false,
      undoCandidates: [],
      findCandidates: [],
      bombCandidates: [],
      hintCardId: null,
      timeProgress: 100,
      hasUsedTimeAd: false,
      hasUsedReviveAd: false,
      savedProgress: null,
      showWinModal: false,
      showFailModal: false,
      showTimeWarningModal: false,
    });

    this.startTimer();
  },

  saveCurrentProgress() {
    this.setData({
      savedProgress: {
        cards: this.data.cards.map(c => ({ ...c })),
        slots: this.data.slots.map(s => s ? { ...s } : null),
        score: this.data.score,
        undoCount: this.data.undoCount,
        findCount: this.data.findCount,
        bombCount: this.data.bombCount,
      }
    });
  },

  startTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }

    let warningShown = false;

    const timer = setInterval(() => {
      let timeProgress = this.data.timeProgress - 2;
      
      if (timeProgress <= 0) {
        clearInterval(timer);
        this.onTimeOut();
        return;
      }

      if (timeProgress < 20 && !warningShown && !this.data.hasUsedTimeAd) {
        warningShown = true;
        this.saveCurrentProgress();
        playSound('warning');
        this.setData({ showTimeWarningModal: true });
      }
      
      this.setData({ timeProgress });
    }, 1000);

    this.setData({ timer });
  },

  addTimeProgress() {
    let timeProgress = Math.min(100, this.data.timeProgress + 8);
    this.setData({ timeProgress });
  },

  onTimeOut() {
    clearInterval(this.data.timer);
    playSound('lose');
    this.saveCurrentProgress();
    this.setData({ showFailModal: true, gameOverState: true });
  },

  async watchAdForTime() {
    playSound('click');
    const app = getApp();
    const userId = app.globalData.userId;
    
    const result = await showRewardedAd(async (isCompleted) => {
      if (isCompleted) {
        this.setData({
          timeProgress: Math.min(100, this.data.timeProgress + 30),
          showTimeWarningModal: false,
          hasUsedTimeAd: true,
        });
        playSound('reward');
        this.startTimer();
        tt.showToast({ title: '+30秒', icon: 'success' });
        
        // 上报广告观看
        if (userId) {
          try {
            await adApi.report(userId, 'time_warning');
          } catch (e) {
            console.warn('广告上报失败:', e.message);
          }
        }
      }
    });
    
    if (!result) {
      tt.showToast({ title: '广告加载失败', icon: 'none' });
    }
  },

  continueWithoutAd() {
    playSound('click');
    this.setData({ showTimeWarningModal: false });
  },

  async watchAdToRevive() {
    if (this.data.hasUsedReviveAd) {
      tt.showToast({ title: '每局只能复活一次', icon: 'none' });
      return;
    }
    
    playSound('click');
    const app = getApp();
    const userId = app.globalData.userId;
    
    const result = await showRewardedAd(async (isCompleted) => {
      if (isCompleted) {
        const saved = this.data.savedProgress;
        if (saved) {
          this.setData({
            cards: saved.cards,
            slots: saved.slots,
            score: saved.score,
            undoCount: saved.undoCount,
            findCount: saved.findCount,
            bombCount: saved.bombCount,
            showFailModal: false,
            gameOverState: false,
            timeProgress: 50,
            hasUsedReviveAd: true,
          });
          playSound('reward');
          this.startTimer();
          tt.showToast({ title: '复活成功!', icon: 'success' });
          
          // 上报广告观看
          if (userId) {
            try {
              await adApi.report(userId, 'revive');
            } catch (e) {
              console.warn('广告上报失败:', e.message);
            }
          }
        }
      }
    });
    
    if (!result) {
      tt.showToast({ title: '广告加载失败', icon: 'none' });
    }
  },

  onCardTap(e) {
    if (this.data.animating || this.data.gameOverState) return;

    playSound('pickup');

    const index = e.currentTarget.dataset.index;
    const cards = this.data.cards.slice();
    const card = cards[index];

    if (!card || card.isCover || card.status !== 0) return;

    const slots = this.data.slots.slice();
    const emptyIndex = slots.findIndex(s => s === null);
    if (emptyIndex === -1) {
      this.checkSlotsFull();
      return;
    }

    card.status = 1;
    slots[emptyIndex] = card;
    const arranged = arrangeSlots(slots);

    this.setData({
      cards: checkCover(cards),
      slots: arranged,
    });

    this.addTimeProgress();

    const remaining = cards.filter(c => c.status === 0).length;
    if (remaining === 0) {
      this.checkWin();
    } else {
      this.checkAndEliminate(arranged);
    }
  },

  checkAndEliminate(slots) {
    const filled = slots.filter(s => s !== null);
    const groups = {};
    filled.forEach(card => {
      if (!groups[card.icon]) {
        groups[card.icon] = [];
      }
      groups[card.icon].push(card);
    });

    Object.keys(groups).forEach(icon => {
      if (groups[icon].length >= 3) {
        const toRemove = groups[icon].slice(0, 3);
        playSound('match');

        const newSlots = this.data.slots.slice();
        toRemove.forEach(card => {
          const idx = newSlots.findIndex(s => s && s.id === card.id);
          if (idx !== -1) {
            newSlots[idx] = null;
          }
        });

        const newCards = this.data.cards.slice();
        toRemove.forEach(card => {
          const c = newCards.find(c => c.id === card.id);
          if (c) {
            c.status = 2;
          }
        });

        this.setData({
          cards: checkCover(newCards),
          slots: arrangeSlots(newSlots),
          score: this.data.score + 10,
        });

        const remaining = newCards.filter(c => c.status === 0).length;
        if (remaining === 0) {
          this.checkWin();
        }
      }
    });

    this.checkSlotsFull();
  },

  checkSlotsFull() {
    const filledCount = this.data.slots.filter(s => s !== null).length;
    if (filledCount >= MAX_SLOTS) {
      clearInterval(this.data.timer);
      playSound('lose');
      this.saveCurrentProgress();
      this.setData({ showFailModal: true, gameOverState: true });
    }
  },

  async checkWin() {
    clearInterval(this.data.timer);
    playSound('win');

    // 保存游戏记录和更新进度
    const app = getApp();
    const userId = app.globalData.userId;
    const level = this.data.level;
    const score = this.data.score;
    const timeSpent = 100 - this.data.timeProgress; // 剩余时间转用时

    if (userId) {
      try {
        // 保存游戏记录
        await gameApi.saveRecord(userId, level, score, timeSpent);

        // 更新关卡进度
        const result = await userApi.getProgress(userId);
        const progress = result.data || {};
        const completedLevels = progress.completedLevels || [];
        const bestScores = progress.bestScores || {};

        // 添加本关到已完成列表（如果还没完成）
        if (!completedLevels.includes(level)) {
          completedLevels.push(level);
        }

        // 更新最高分
        if (!bestScores[level] || score > bestScores[level]) {
          bestScores[level] = score;
        }

        // 解锁下一关
        const unlockedLevel = Math.max(progress.unlockedLevel || 1, level + 1);

        await userApi.updateProgress(userId, {
          completedLevels,
          bestScores,
          unlockedLevel,
        });

        console.log('游戏记录已保存，进度已更新');
      } catch (error) {
        console.warn('保存游戏数据失败:', error.message);
      }
    }

    this.setData({ showWinModal: true, gameOverState: true });
  },

  nextLevel() {
    playSound('click');
    const nextLevelId = this.data.level + 1;
    this.setData({
      level: nextLevelId,
      levelName: LEVEL_NAMES[nextLevelId] || '传奇',
      score: 0,
      showWinModal: false,
      gameOverState: false,
    });
    this.initGame();
  },

  restartGame() {
    playSound('click');
    this.setData({
      score: 0,
      showFailModal: false,
      gameOverState: false,
    });
    this.initGame();
  },

  backToLevels() {
    playSound('click');
    clearInterval(this.data.timer);
    tt.navigateBack();
  },

  // ========== 道具系统 ==========

  useUndoOrAd() {
    if (this.data.animating || this.data.gameOverState) return;
    if (this.data.undoCount > 0) {
      this.openUndoPanel();
    } else {
      tt.showToast({ title: '点击下方看广告获取', icon: 'none' });
    }
  },

  async watchAdForUndo() {
    playSound('click');
    const app = getApp();
    const userId = app.globalData.userId;
    
    const result = await showRewardedAd(async (isCompleted) => {
      if (isCompleted) {
        this.setData({ undoCount: this.data.undoCount + 1 });
        playSound('reward');
        tt.showToast({ title: '获得回退道具', icon: 'success' });
        
        // 上报广告观看
        if (userId) {
          try {
            await adApi.report(userId, 'prop_undo');
          } catch (e) {
            console.warn('广告上报失败:', e.message);
          }
        }
      }
    });
    if (!result) tt.showToast({ title: '广告加载失败', icon: 'none' });
  },

  openUndoPanel() {
    const undoCandidates = this.data.slots
      .filter(s => s !== null)
      .map(s => ({
        id: s.id,
        icon: s.icon,
        iconName: this.getIconName(s.icon),
      }));

    this.setData({ showUndoPanel: true, undoCandidates });
  },

  selectUndoItem(e) {
    playSound('item');

    const index = e.currentTarget.dataset.index;
    const item = this.data.undoCandidates[index];
    if (!item) return;

    const slots = this.data.slots.slice();
    const slotIndex = slots.findIndex(s => s && s.id === item.id);
    if (slotIndex === -1) return;

    slots[slotIndex] = null;

    const cards = this.data.cards.slice();
    const card = cards.find(c => c.id === item.id);
    if (card) {
      card.status = 0;
      card.isCover = false;
    }

    this.setData({
      cards: checkCover(cards),
      slots: arrangeSlots(slots),
      undoCount: this.data.undoCount - 1,
      showUndoPanel: false,
      undoCandidates: [],
    });

    tt.showToast({ title: '已取回牌', icon: 'success' });
  },

  useFindOrAd() {
    if (this.data.animating || this.data.gameOverState) return;
    if (this.data.findCount > 0) {
      this.openFindPanel();
    } else {
      tt.showToast({ title: '点击下方看广告获取', icon: 'none' });
    }
  },

  async watchAdForFind() {
    playSound('click');
    const app = getApp();
    const userId = app.globalData.userId;
    
    const result = await showRewardedAd(async (isCompleted) => {
      if (isCompleted) {
        this.setData({ findCount: this.data.findCount + 1 });
        playSound('reward');
        tt.showToast({ title: '获得寻找道具', icon: 'success' });
        
        // 上报广告观看
        if (userId) {
          try {
            await adApi.report(userId, 'prop_find');
          } catch (e) {
            console.warn('广告上报失败:', e.message);
          }
        }
      }
    });
    if (!result) tt.showToast({ title: '广告加载失败', icon: 'none' });
  },

  openFindPanel() {
    // 从暂存槽中选择牌类型
    const slotStats = {};
    this.data.slots.forEach(s => {
      if (s) {
        slotStats[s.icon] = (slotStats[s.icon] || 0) + 1;
      }
    });

    // 暂存槽中有的牌类型才能选择
    const findCandidates = Object.keys(slotStats).map(icon => ({
      icon,
      iconName: this.getIconName(icon),
      slotCount: slotStats[icon],
    }));

    this.setData({ showFindPanel: true, findCandidates });
  },

  selectFindItem(e) {
    playSound('item');

    const index = e.currentTarget.dataset.index;
    const item = this.data.findCandidates[index];
    if (!item) return;

    const clickableCards = this.data.cards.filter(c => 
      c.status === 0 && !c.isCover && c.icon === item.icon
    );

    if (clickableCards.length > 0) {
      this.setData({
        hintCardId: clickableCards[0].id,
        findCount: this.data.findCount - 1,
        showFindPanel: false,
        findCandidates: [],
      });

      setTimeout(() => {
        this.setData({ hintCardId: null });
      }, 3000);

      tt.showToast({ title: '已高亮' + item.iconName, icon: 'none' });
    }
  },

  useBombOrAd() {
    if (this.data.animating || this.data.gameOverState) return;
    if (this.data.bombCount > 0) {
      this.openBombPanel();
    } else {
      tt.showToast({ title: '点击下方看广告获取', icon: 'none' });
    }
  },

  async watchAdForBomb() {
    playSound('click');
    const app = getApp();
    const userId = app.globalData.userId;
    
    const result = await showRewardedAd(async (isCompleted) => {
      if (isCompleted) {
        this.setData({ bombCount: this.data.bombCount + 1 });
        playSound('reward');
        tt.showToast({ title: '获得炸弹道具', icon: 'success' });
        
        // 上报广告观看
        if (userId) {
          try {
            await adApi.report(userId, 'prop_bomb');
          } catch (e) {
            console.warn('广告上报失败:', e.message);
          }
        }
      }
    });
    if (!result) tt.showToast({ title: '广告加载失败', icon: 'none' });
  },

  openBombPanel() {
    // 从暂存槽中选择要炸掉的牌
    const bombCandidates = this.data.slots
      .filter(s => s !== null)
      .map(s => ({
        id: s.id,
        icon: s.icon,
        iconName: this.getIconName(s.icon),
      }));

    this.setData({ showBombPanel: true, bombCandidates });
  },

  selectBombItem(e) {
    playSound('bomb');

    const index = e.currentTarget.dataset.index;
    const item = this.data.bombCandidates[index];
    if (!item) return;

    // 从暂存槽中移除该牌
    const slots = this.data.slots.slice();
    const slotIndex = slots.findIndex(s => s && s.id === item.id);
    if (slotIndex !== -1) {
      slots[slotIndex] = null;
    }

    this.setData({
      slots: arrangeSlots(slots),
      bombCount: this.data.bombCount - 1,
      showBombPanel: false,
      bombCandidates: [],
      score: this.data.score + 5,
    });

    tt.showToast({ title: '已炸掉' + item.iconName, icon: 'success' });

    // 检查游戏是否结束
    this.checkGameOver();
  },

  closeAllPanels() {
    this.setData({
      showUndoPanel: false,
      showFindPanel: false,
      showBombPanel: false,
      undoCandidates: [],
      findCandidates: [],
      bombCandidates: [],
    });
  },

  getIconName(icon) {
    const names = {
      'Bamboo_1': '一条', 'Bamboo_2': '二条', 'Bamboo_3': '三条',
      'Bamboo_4': '四条', 'Bamboo_5': '五条', 'Bamboo_6': '六条',
      'Bamboo_7': '七条', 'Bamboo_8': '八条', 'Bamboo_9': '九条',
      'Char_1': '一万', 'Char_2': '二万', 'Char_3': '三万',
      'Char_4': '四万', 'Char_5': '五万', 'Char_6': '六万',
      'Char_7': '七万', 'Char_8': '八万', 'Char_9': '九万',
      'Wheel_1': '一筒', 'Wheel_2': '二筒', 'Wheel_3': '三筒',
      'Wheel_4': '四筒', 'Wheel_5': '五筒', 'Wheel_6': '六筒',
      'Wheel_7': '七筒', 'Wheel_8': '八筒', 'Wheel_9': '九筒',
      'Wind_East': '东', 'Wind_South': '南', 'Wind_West': '西', 'Wind_North': '北',
      'Dragon_Red': '红中', 'Dragon_Green': '发财', 'Dragon_White': '白板',
    };
    return names[icon] || icon;
  },

  stopPropagation() {
    // 阻止事件冒泡，空方法
  },

  closeTimeWarningModal() {
    playSound('click');
    this.setData({ showTimeWarningModal: false });
  },

  closeSidebarModal() {
    playSound('click');
    this.setData({ showSidebarModal: false });
  },

  goSidebarTask() {
    playSound('click');
    this.setData({ showSidebarModal: false });
    // TODO: 跳转到侧边栏任务页面
    tt.showToast({ title: '功能开发中', icon: 'none' });
  },
});