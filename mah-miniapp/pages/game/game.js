/**
 * 游戏页面 - 羊了个羊玩法
 * 接入云开发API：登录、保存记录、广告上报
 */

const { showRewardedAd, showBannerAd, hideBannerAd, showInterstitialAd, preloadInterstitialAd } = require('../../utils/ad');
const { gameApi, adApi, userApi } = require('../../services/api');

/** 麻将牌类型（与images目录下的文件名对应） */
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

/** 暂存槽最大容量 */
const MAX_SLOTS = 7;

/** 卡片宽度rpx */
const CARD_W_RPX = 88;

/** 卡片高度rpx */
const CARD_H_RPX = 116;

/** 卡片间距rpx */
const CARD_GAP_RPX = 8;

/**
 * 洗牌算法
 */
function shuffleArray(arr) {
  const res = arr.slice();
  for (let i = res.length - 1; i > 0; i--) {
    const idx = Math.floor(Math.random() * (i + 1));
    [res[i], res[idx]] = [res[idx], res[i]];
  }
  return res;
}

/**
 * 生成唯一ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 8) + Date.now().toString(36).slice(-4);
}

/**
 * 生成关卡场景
 * 保证可解：每种牌3张（3的倍数），总共一定能消除完
 */
function generateScene(level) {
  const iconCount = Math.min(8 + Math.floor(level / 2), MAHJONG_TILES.length);
  const selectedIcons = MAHJONG_TILES.slice(0, iconCount);
  const layers = level <= 2 ? 3 : level <= 5 ? 4 : 5;

  // 每种牌3张，保证可解
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

  // 游戏区域宽高（rpx），需与 ttss 中 .game-area 的 max-width/max-height 匹配
  const areaW = 710;
  const areaH = 620;

  for (let layer = 0; layer < layers && cardIndex < totalCards; layer++) {
    let layerCards;
    if (layer === layers - 1) {
      layerCards = totalCards - cardIndex;
    } else {
      layerCards = Math.min(Math.ceil(totalCards / layers) + 2, totalCards - cardIndex);
    }

    const cols = layer === 0 ? 5 : 4;
    const rows = Math.ceil(layerCards / cols);

    // 每层偏移，形成覆盖效果
    const offsetX = layer * 20;
    const offsetY = layer * 15;

    // 计算网格起始位置（居中）
    const gridWidth = cols * (CARD_W_RPX + CARD_GAP_RPX);
    const gridHeight = rows * (CARD_H_RPX + CARD_GAP_RPX);
    const startX = (areaW - gridWidth) / 2;
    const startY = (areaH - gridHeight) / 2;

    for (let i = 0; i < layerCards && cardIndex < totalCards; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = startX + col * (CARD_W_RPX + CARD_GAP_RPX) + offsetX + (Math.random() - 0.5) * 6;
      const y = startY + row * (CARD_H_RPX + CARD_GAP_RPX) + offsetY + (Math.random() - 0.5) * 6;

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

/**
 * 计算两个矩形的重叠面积比例
 */
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

/**
 * 检查覆盖状态 - 被上层卡片遮挡超过30%则不可点击
 */
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

/**
 * 将暂存槽中的卡片按图标分组排列（羊了个羊核心特性）
 * 相同图标自动靠在一起，方便三消
 */
function arrangeSlots(slots) {
  const filled = slots.filter(s => s !== null);

  // 按图标名分组，保持首次出现顺序
  const groups = {};
  const order = [];
  filled.forEach(card => {
    if (!groups[card.icon]) {
      groups[card.icon] = [];
      order.push(card.icon);
    }
    groups[card.icon].push(card);
  });

  // 展开分组
  const arranged = [];
  order.forEach(iconName => {
    arranged.push(...groups[iconName]);
  });

  // 补齐空位
  while (arranged.length < MAX_SLOTS) {
    arranged.push(null);
  }

  return arranged;
}

Page({
  data: {
    level: 1,
    score: 0,
    time: 0,
    cards: [],
    slots: [null, null, null, null, null, null, null],
    timer: null,
    animating: false,
    /** 每张卡片的动画数据，key为 card.id */
    cardAnimations: {},
    /** 暂存槽每个位置的动画数据，key为 slot index */
    slotAnimations: {},
    /** 正在飞行的卡片 ID */
    flyingCardId: null,
    /** 游戏是否已结束 */
    gameOverState: false,
    /** 过关广告过渡状态 */
    showAdTransition: false,
    /** 过关倒计时 */
    adCountdown: 5,
    /** 撤销操作历史栈 */
    undoStack: [],
    /** 提示剩余次数 */
    hintCount: 3,
    /** 当前提示高亮的卡片ID */
    hintCardId: null,
  },

  onLoad(options) {
    this.initGame();
    if (options && options.inviterId) {
      this._pendingInviterId = options.inviterId;
      this.tryBindInviter();
    }
  },

  onShow() {
    showBannerAd();
    if (this.data._paused && !this.data.gameOverState) {
      this.startTimer();
      this.setData({ _paused: false });
    }
  },

  onHide() {
    hideBannerAd();
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ _paused: true });
    }
  },

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
    hideBannerAd();
  },

  /** 初始化游戏 */
  initGame() {
    const cards = generateScene(this.data.level);

    console.log('生成卡片数量:', cards.length);
    console.log('前3张卡片:', JSON.stringify(cards.slice(0, 3)));

    this.setData({
      cards,
      slots: [null, null, null, null, null, null, null],
      animating: false,
      gameOverState: false,
      showAdTransition: false,
      undoStack: [],
      hintCount: 3,
    });

    this.startTimer();
    preloadInterstitialAd();
  },

  /** 开始计时器 */
  startTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }

    const timer = setInterval(() => {
      this.setData({ time: this.data.time + 1 });
    }, 1000);

    this.setData({ timer });
  },

  /** 点击卡片 */
  onCardTap(e) {
    if (this.data.animating || this.data.gameOverState) return;

    const index = e.currentTarget.dataset.index;
    const cards = this.data.cards.slice();
    const card = cards[index];

    if (!card || card.isCover || card.status !== 0) return;

    const slots = this.data.slots.slice();
    const emptyIndex = slots.findIndex(s => s === null);
    if (emptyIndex === -1) {
      tt.showToast({ title: '暂存槽已满!', icon: 'none' });
      return;
    }

    this.setData({ animating: true, flyingCardId: card.id });

    if (this._animatingTimer) clearTimeout(this._animatingTimer);
    this._animatingTimer = setTimeout(() => {
      if (this.data.animating) {
        this.setData({ animating: false });
      }
    }, 3000);

    // 第一步：拾取动画（弹起 + 发光）
    this.playPickupAnimation(card.id, () => {
      const undoStack = this.data.undoStack.slice();
      undoStack.push({
        cards: this.data.cards.map(c => ({ ...c })),
        slots: this.data.slots.map(s => s ? { ...s } : null),
        score: this.data.score,
      });
      if (undoStack.length > 20) undoStack.shift();

      card.status = 1;
      slots[emptyIndex] = card;
      const arranged = arrangeSlots(slots);

      const cardAnimations = this.data.cardAnimations;
      delete cardAnimations[card.id];

      this.setData({
        cards: checkCover(cards),
        slots: arranged,
        cardAnimations,
        flyingCardId: null,
        undoStack,
      });

      // 第二步：直接检查消除（无弹入动画）
      setTimeout(() => {
        this.checkAndClearSlots();
      }, 200);
    });
  },

  /** 卡片拾取动画：弹起变大 + 发金光，动画完成后重置让 CSS 恢复原生样式 */
  playPickupAnimation(cardId, callback) {
    const animation = tt.createAnimation({
      duration: 150,
      timingFunction: 'ease-out',
    });
    animation.scale(1.15, 1.15).backgroundColor('#ffeb3b').step();
    animation.scale(0.1, 0.1).opacity(0).step({ duration: 180, timingFunction: 'ease-in' });
    /* 第三帧：瞬间重置为原生样式，让 CSS 的 .card 背景接管 */
    animation.scale(1, 1).opacity(0).backgroundColor('transparent').step({ duration: 0 });

    const cardAnimations = this.data.cardAnimations;
    cardAnimations[cardId] = animation.export();

    this.setData({ cardAnimations });

    setTimeout(() => { callback(); }, 350);
  },

  /** 检查并消除暂存槽中的三连卡片 */
  checkAndClearSlots() {
    const slots = this.data.slots.slice();
    const cards = this.data.cards.slice();

    const iconCounts = {};
    slots.forEach((slot, index) => {
      if (slot) {
        const name = slot.icon;
        if (!iconCounts[name]) {
          iconCounts[name] = { count: 0, indices: [] };
        }
        iconCounts[name].count++;
        iconCounts[name].indices.push(index);
      }
    });

    let cleared = false;
    let removedIndices = [];
    for (const name in iconCounts) {
      if (iconCounts[name].count >= 3) {
        removedIndices = iconCounts[name].indices.slice(0, 3);
        removedIndices.forEach(idx => {
          const card = slots[idx];
          if (card) {
            const sceneCard = cards.find(c => c.id === card.id);
            if (sceneCard) {
              sceneCard.status = 2;
            }
          }
          slots[idx] = null;
        });
        cleared = true;
        break;
      }
    }

    if (cleared) {
      // 消除动画：消除的槽位闪烁
      this.playClearAnimation(removedIndices, () => {
        // 先清理消除槽位的动画数据，再更新 slots
        const slotAnimations = this.data.slotAnimations;
        removedIndices.forEach(idx => {
          delete slotAnimations[idx];
        });
        const arranged = arrangeSlots(slots);
        this.setData({
          slots: arranged,
          cards: checkCover(cards),
          score: this.data.score + 3,
          slotAnimations
        });

        setTimeout(() => {
          this.checkAndClearSlots();
        }, 200);
      });
    } else {
      this.setData({ cards: checkCover(cards), animating: false });

      const remaining = cards.filter(c => c.status === 0).length;
      if (remaining === 0) {
        this.checkWin();
      } else {
        const filledCount = slots.filter(s => s !== null).length;
        if (filledCount >= MAX_SLOTS) {
          this.gameOver();
        }
      }
    }
  },

  /** 消除动画：槽位缩小消失，完成后重置动画对象清除行内样式 */
  playClearAnimation(indices, callback) {
    if (!indices || indices.length === 0) {
      callback();
      return;
    }

    const slotAnimations = this.data.slotAnimations;
    indices.forEach(idx => {
      const animation = tt.createAnimation({
        duration: 200,
        timingFunction: 'ease-in',
      });
      animation.scale(0, 0).opacity(0).step();
      slotAnimations[idx] = animation.export();
    });

    this.setData({ slotAnimations });

    setTimeout(() => {
      /* 先 export 一个空白动画对象覆盖残留行内样式，再 delete */
      indices.forEach(idx => {
        const resetAnim = tt.createAnimation({ duration: 0 });
        resetAnim.opacity(1).scale(1, 1).step();
        slotAnimations[idx] = resetAnim.export();
      });
      this.setData({ slotAnimations }, () => {
        const cleanSlots = this.data.slotAnimations;
        indices.forEach(idx => {
          delete cleanSlots[idx];
        });
        this.setData({ slotAnimations: cleanSlots });
        callback();
      });
    }, 220);
  },

  /** 检查胜利 */
  checkWin() {
    clearInterval(this.data.timer);

    this.saveGameRecord();

    this.setData({ showAdTransition: true, adCountdown: 5 });

    this.showLevelAd();
  },

  /**
   * 展示过关插屏广告
   * 广告展示成功后开始倒计时，倒计时结束才能继续
   * 广告展示失败则跳过广告直接继续
   */
  async showLevelAd() {
    try {
      const adShown = await showInterstitialAd();

      if (adShown) {
        const app = getApp();
        const userId = app.globalData.userId;
        if (userId) {
          try {
            await adApi.report(userId, 'interstitial');
          } catch (error) {
            console.warn('插屏广告上报失败:', error.message);
          }
        }
      }
    } catch (error) {
      console.warn('插屏广告展示失败:', error.message);
    }

    this.startAdCountdown();
  },

  /**
   * 开始过关倒计时
   * 倒计时结束后显示继续按钮
   */
  startAdCountdown() {
    let count = 5;
    this.setData({ adCountdown: count });

    this._adTimer = setInterval(() => {
      count--;
      this.setData({ adCountdown: count });

      if (count <= 0) {
        clearInterval(this._adTimer);
        this._adTimer = null;
      }
    }, 1000);
  },

  /**
   * 继续下一关
   * 倒计时结束后点击继续
   */
  continueToNextLevel() {
    if (this.data.adCountdown > 0) return;

    if (this._adTimer) {
      clearInterval(this._adTimer);
      this._adTimer = null;
    }

    this.setData({ showAdTransition: false });
    this.nextLevel();
  },

  /** 游戏结束 */
  gameOver() {
    clearInterval(this.data.timer);
    this.setData({ gameOverState: true });

    this.saveGameRecord();

    tt.showModal({
      title: '游戏结束',
      content: '暂存槽已满，得分: ' + this.data.score,
      cancelText: '重新开始',
      confirmText: '再试一次',
      success: (res) => {
        if (res.confirm) {
          this.setData({ time: 0, score: 0 });
          this.initGame();
        } else {
          this.restartGame();
        }
      }
    });
  },

  /**
   * 看广告复活 - 清空暂存槽继续游戏
   */
  async watchAdForRevive() {
    if (!this.data.gameOverState) return;

    try {
      const app = getApp();
      const userId = app.globalData.userId;
      const rewarded = await showRewardedAd(userId);

      if (rewarded) {
        if (userId) {
          try {
            await adApi.report(userId, 'rewarded');
          } catch (error) {
            console.warn('广告上报失败:', error.message);
          }
        }

        this.setData({
          slots: [null, null, null, null, null, null, null],
          gameOverState: false,
        });

        this.startTimer();
        tt.showToast({ title: '已复活，继续游戏！', icon: 'success' });
      } else {
        tt.showToast({ title: '需要看完广告才能复活', icon: 'none' });
      }
    } catch (error) {
      console.warn('广告复活失败:', error.message);
      tt.showToast({ title: '广告加载失败', icon: 'none' });
    }
  },

  /**
   * 保存游戏记录到云端
   */
  async saveGameRecord() {
    const app = getApp();
    const userId = app.globalData.userId;
    if (!userId) {
      console.warn('用户未登录，跳过保存记录');
      return;
    }

    try {
      await gameApi.saveRecord(userId, this.data.level, this.data.score, this.data.time);
      console.log('游戏记录已保存到云端');
    } catch (error) {
      console.warn('保存游戏记录失败:', error.message);
    }
  },

  /**
   * 观看激励视频广告
   */
  async watchRewardedAd() {
    const app = getApp();
    const userId = app.globalData.userId;

    const rewarded = await showRewardedAd(userId);
    if (rewarded && userId) {
      try {
        const result = await adApi.report(userId, 'rewarded');
        if (result.data && result.data.reward > 0) {
          tt.showToast({ title: `获得${result.data.reward}元奖励`, icon: 'none' });
        }
      } catch (error) {
        console.warn('广告上报失败:', error.message);
      }
    }
  },

  /** 撤销操作 - 从历史栈恢复上一步状态 */
  undo() {
    if (this.data.animating || this.data.gameOverState) return;

    const undoStack = this.data.undoStack.slice();
    if (undoStack.length === 0) {
      tt.showToast({ title: '没有可撤销的操作', icon: 'none' });
      return;
    }

    const prevState = undoStack.pop();

    this.setData({
      cards: checkCover(prevState.cards),
      slots: arrangeSlots(prevState.slots),
      score: Math.max(0, prevState.score - 1),
      undoStack,
    });

    tt.showToast({ title: '已撤销 -1分', icon: 'none' });
  },

  /** 提示功能 - 高亮一张可点击且能与暂存槽形成三消的卡片 */
  hint() {
    if (this.data.animating || this.data.gameOverState) return;

    if (this.data.hintCount <= 0) {
      tt.showToast({ title: '提示次数已用完', icon: 'none' });
      return;
    }

    const cards = this.data.cards;
    const slots = this.data.slots;
    const activeSlots = slots.filter(s => s !== null);

    const slotIconCounts = {};
    activeSlots.forEach(s => {
      slotIconCounts[s.icon] = (slotIconCounts[s.icon] || 0) + 1;
    });

    let hintCard = null;

    for (const card of cards) {
      if (card.status !== 0 || card.isCover) continue;
      if (slotIconCounts[card.icon] >= 2) {
        hintCard = card;
        break;
      }
    }

    if (!hintCard) {
      for (const card of cards) {
        if (card.status !== 0 || card.isCover) continue;
        if (slotIconCounts[card.icon] >= 1) {
          hintCard = card;
          break;
        }
      }
    }

    if (!hintCard) {
      for (const card of cards) {
        if (card.status !== 0 || card.isCover) continue;
        hintCard = card;
        break;
      }
    }

    if (hintCard) {
      this.setData({
        hintCardId: hintCard.id,
        hintCount: this.data.hintCount - 1,
        score: Math.max(0, this.data.score - 1),
      });

      tt.showToast({ title: `已提示 剩余${this.data.hintCount - 1}次 -1分`, icon: 'none' });

      setTimeout(() => {
        this.setData({ hintCardId: null });
      }, 1500);
    } else {
      tt.showToast({ title: '没有可提示的卡片', icon: 'none' });
    }
  },

  /** 洗牌 - 打乱剩余卡片的图标，保持每种图标数量仍为3的倍数 */
  shuffle() {
    if (this.data.animating || this.data.gameOverState) return;

    const cards = this.data.cards.slice();
    const activeCards = cards.filter(c => c.status === 0);
    if (activeCards.length === 0) return;

    const icons = activeCards.map(c => c.icon);
    for (let i = icons.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [icons[i], icons[j]] = [icons[j], icons[i]];
    }

    activeCards.forEach((card, index) => {
      const original = cards.find(c => c.id === card.id);
      if (original) {
        original.icon = icons[index];
      }
    });

    this.setData({
      cards: checkCover(cards),
      score: Math.max(0, this.data.score - 1)
    });

    tt.showToast({ title: '已洗牌 -1分', icon: 'none' });
  },

  /** 重新开始 */
  restartGame() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
    this.setData({ level: 1, score: 0, time: 0 });
    this.initGame();
  },

  /** 下一关 */
  nextLevel() {
    this.setData({ level: this.data.level + 1, time: 0 });
    this.initGame();
  },

  /** 跳转到个人中心 */
  goToProfile() {
    tt.navigateTo({ url: '/pages/profile/profile' });
  },

  /** 跳转到排行榜 */
  goToRank() {
    tt.navigateTo({ url: '/pages/rank/rank' });
  },

  /** 跳转到提现页面 */
  goToWithdraw() {
    tt.navigateTo({ url: '/pages/withdraw/withdraw' });
  },

  /** 跳转到邀请页面 */
  goToInvite() {
    tt.navigateTo({ url: '/pages/invite/invite' });
  },

  /**
   * 尝试绑定邀请人
   * 用户通过邀请链接进入时，等待登录完成后自动绑定
   */
  async tryBindInviter() {
    const inviterId = this._pendingInviterId;
    if (!inviterId) return;

    const app = getApp();
    const userId = app.globalData.userId;

    this._bindRetryCount = (this._bindRetryCount || 0) + 1;
    if (this._bindRetryCount > 10) {
      console.warn('绑定邀请人超时，放弃重试');
      this._pendingInviterId = null;
      this._bindRetryCount = 0;
      return;
    }

    if (!userId) {
      setTimeout(() => this.tryBindInviter(), 500);
      return;
    }

    if (inviterId === userId) {
      console.warn('不可自我邀请');
      this._pendingInviterId = null;
      this._bindRetryCount = 0;
      return;
    }

    try {
      await userApi.bindInviter(userId, inviterId);
      console.log('邀请人绑定成功');
      tt.showToast({ title: '邀请码已绑定', icon: 'success' });
    } catch (error) {
      console.warn('绑定邀请人失败:', error.message);
    }

    this._pendingInviterId = null;
    this._bindRetryCount = 0;
  }
});
