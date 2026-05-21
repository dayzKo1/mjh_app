/**
 * 游戏页面 - 马将消消乐横屏版
 * 支持广告复活、道具看广告使用、倒计时警告
 */

const { showRewardedAd } = require('../../utils/ad');
const { playSound, preloadSounds } = require('../../utils/sound');

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

function generateScene(level) {
  const iconCount = Math.min(6 + Math.floor((level - 1) / 2), MAHJONG_TILES.length);
  const selectedIcons = MAHJONG_TILES.slice(0, iconCount);
  const layers = level <= 2 ? 3 : level <= 5 ? 4 : 5;

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

  const areaW = 600;
  const areaH = 400;

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
  },

  onLoad(options) {
    const level = parseInt(options.level) || 1;
    this.setData({ level });
    preloadSounds();
  },

  onShow() {
    this.initGame();
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  initGame() {
    const level = this.data.level;
    const cards = generateScene(level);

    console.log('关卡', level, '卡片数', cards.length);

    this.setData({
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
    const result = await showRewardedAd((isCompleted) => {
      if (isCompleted) {
        this.setData({
          timeProgress: Math.min(100, this.data.timeProgress + 30),
          showTimeWarningModal: false,
          hasUsedTimeAd: true,
        });
        playSound('reward');
        this.startTimer();
        tt.showToast({ title: '+30秒', icon: 'success' });
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
    const result = await showRewardedAd((isCompleted) => {
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

  checkWin() {
    clearInterval(this.data.timer);
    playSound('win');
    this.setData({ showWinModal: true, gameOverState: true });
  },

  nextLevel() {
    playSound('click');
    this.setData({
      level: this.data.level + 1,
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
    const result = await showRewardedAd((isCompleted) => {
      if (isCompleted) {
        this.setData({ undoCount: this.data.undoCount + 1 });
        playSound('reward');
        tt.showToast({ title: '获得回退道具!', icon: 'success' });
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

  closeUndoPanel() {
    this.setData({ showUndoPanel: false, undoCandidates: [] });
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

    tt.showToast({ title: '已取回方块', icon: 'success' });
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
    const result = await showRewardedAd((isCompleted) => {
      if (isCompleted) {
        this.setData({ findCount: this.data.findCount + 1 });
        playSound('reward');
        tt.showToast({ title: '获得寻找道具!', icon: 'success' });
      }
    });
    if (!result) tt.showToast({ title: '广告加载失败', icon: 'none' });
  },

  openFindPanel() {
    const slotStats = {};
    this.data.slots.forEach(s => {
      if (s) {
        slotStats[s.icon] = (slotStats[s.icon] || 0) + 1;
      }
    });

    const clickableStats = {};
    this.data.cards.forEach(c => {
      if (c.status === 0 && !c.isCover) {
        clickableStats[c.icon] = (clickableStats[c.icon] || 0) + 1;
      }
    });

    const icons = new Set([...Object.keys(slotStats), ...Object.keys(clickableStats)]);
    const findCandidates = Array.from(icons).map(icon => ({
      icon,
      iconName: this.getIconName(icon),
      slotCount: slotStats[icon] || 0,
      clickableCount: clickableStats[icon] || 0,
      canEliminate: (slotStats[icon] || 0) + (clickableStats[icon] || 0) >= 3,
    }));

    this.setData({ showFindPanel: true, findCandidates });
  },

  closeFindPanel() {
    this.setData({ showFindPanel: false, findCandidates: [], hintCardId: null });
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
    const result = await showRewardedAd((isCompleted) => {
      if (isCompleted) {
        this.setData({ bombCount: this.data.bombCount + 1 });
        playSound('reward');
        tt.showToast({ title: '获得炸弹道具!', icon: 'success' });
      }
    });
    if (!result) tt.showToast({ title: '广告加载失败', icon: 'none' });
  },

  openBombPanel() {
    const bombCandidates = this.data.cards
      .filter(c => c.status === 0 && !c.isCover)
      .map(c => ({
        id: c.id,
        icon: c.icon,
        iconName: this.getIconName(c.icon),
      }));

    this.setData({ showBombPanel: true, bombCandidates });
  },

  closeBombPanel() {
    this.setData({ showBombPanel: false, bombCandidates: [] });
  },

  selectBombItem(e) {
    playSound('bomb');

    const index = e.currentTarget.dataset.index;
    const item = this.data.bombCandidates[index];
    if (!item) return;

    const cards = this.data.cards.slice();
    const card = cards.find(c => c.id === item.id);
    if (card) {
      card.status = 2;
    }

    this.setData({
      cards: checkCover(cards),
      bombCount: this.data.bombCount - 1,
      showBombPanel: false,
      bombCandidates: [],
      score: this.data.score + 5,
    });

    const remaining = cards.filter(c => c.status === 0).length;
    if (remaining === 0) {
      this.checkWin();
    }

    tt.showToast({ title: '已炸掉' + item.iconName, icon: 'success' });
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
      'Char_1': '一万', 'Char_2': '两万', 'Char_3': '三万',
      'Char_4': '四万', 'Char_5': '五万', 'Char_6': '六万',
      'Char_7': '七万', 'Char_8': '八万', 'Char_9': '九万',
      'Wheel_1': '一筒', 'Wheel_2': '两筒', 'Wheel_3': '三筒',
      'Wheel_4': '四筒', 'Wheel_5': '五筒', 'Wheel_6': '六筒',
      'Wheel_7': '七筒', 'Wheel_8': '八筒', 'Wheel_9': '九筒',
      'Wind_East': '东', 'Wind_South': '南', 'Wind_West': '西', 'Wind_North': '北',
      'Dragon_Red': '红中', 'Dragon_Green': '发财', 'Dragon_White': '白板',
    };
    return names[icon] || icon;
  },

  goToProfile() {
    tt.navigateTo({ url: '/pages/profile/profile' });
  },

  goToRank() {
    tt.navigateTo({ url: '/pages/rank/rank' });
  },
});