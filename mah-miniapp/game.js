/**
 * 麻将消消乐 - 跨平台 Canvas 横屏版
 * 支持：抖音小游戏、微信小游戏、H5/Web、Android APK
 * 布局：暂存槽左下角、道具栏右下角、积分倒计时右上角
 * 关卡选择：入门/挑战两个分支，各3条线路共8关
 */

const platform = require('./utils/platform');
const { userApi, gameApi, adApi } = require('./services/api');
const { initSound, playSound } = require('./utils/sound');

const canvas = platform.createCanvas();
const ctx = platform.getContext(canvas, '2d');
const W = canvas.width;
const H = canvas.height;

// 麻将图片文件名（不使用emoji）
const CARD_ICONS = ['Bamboo_1','Bamboo_2','Bamboo_3','Bamboo_4','Bamboo_5','Bamboo_6','Bamboo_7','Bamboo_8','Bamboo_9','Char_1','Char_2','Char_3','Char_4','Char_5'];
const cardImages = {}; // 图片缓存

// 关卡配置 - 入门/挑战各有入口关 + 三条线路
const LEVELS_CONFIG = {
  beginner: {
    name: '入门模式',
    color: '#22c55e',
    // 入口关卡
    entry: { id: 1, name: '入门', difficulty: 1, iconCount: 6, layers: 3, seed: 1001, shape: 'grid' },
    // 三条线路分支
    lines: [
      {
        id: 'a',
        name: '基础线',
        color: '#22c55e',
        levels: [
          { id: 2, name: '基础1', difficulty: 2, iconCount: 6, layers: 3, seed: 2001, shape: 'grid' },
          { id: 3, name: '基础2', difficulty: 3, iconCount: 7, layers: 3, seed: 2002, shape: 'circle' },
          { id: 8, name: '基础3', difficulty: 3, iconCount: 7, layers: 4, seed: 2003, shape: 'diamond' },
        ],
      },
      {
        id: 'b',
        name: '进防线',
        color: '#10b981',
        levels: [
          { id: 4, name: '进阶1', difficulty: 4, iconCount: 7, layers: 4, seed: 3001, shape: 'diamond' },
          { id: 5, name: '进阶2', difficulty: 5, iconCount: 8, layers: 4, seed: 3002, shape: 'cross' },
          { id: 9, name: '进阶3', difficulty: 5, iconCount: 8, layers: 5, seed: 3003, shape: 'spiral' },
        ],
      },
      {
        id: 'c',
        name: '精通线',
        color: '#14b8a6',
        levels: [
          { id: 6, name: '精通1', difficulty: 7, iconCount: 9, layers: 5, seed: 4001, shape: 'spiral' },
          { id: 7, name: '精通2', difficulty: 8, iconCount: 10, layers: 5, seed: 4002, shape: 'circle' },
          { id: 10, name: '精通3', difficulty: 9, iconCount: 10, layers: 6, seed: 4003, shape: 'cross' },
        ],
      },
    ],
  },
  challenge: {
    name: '挑战模式',
    color: '#8b5cf6',
    // 入口关卡
    entry: { id: 101, name: '挑战入门', difficulty: 3, iconCount: 8, layers: 4, seed: 5001, shape: 'diamond' },
    // 三条线路分支
    lines: [
      {
        id: 'a',
        name: '挑战线',
        color: '#06b6d4',
        levels: [
          { id: 102, name: '挑战1', difficulty: 4, iconCount: 8, layers: 4, seed: 6001, shape: 'cross' },
          { id: 103, name: '挑战2', difficulty: 5, iconCount: 9, layers: 4, seed: 6002, shape: 'spiral' },
          { id: 108, name: '挑战3', difficulty: 6, iconCount: 9, layers: 5, seed: 6003, shape: 'diamond' },
        ],
      },
      {
        id: 'b',
        name: '高手线',
        color: '#3b82f6',
        levels: [
          { id: 104, name: '高手1', difficulty: 6, iconCount: 9, layers: 5, seed: 7001, shape: 'circle' },
          { id: 105, name: '高手2', difficulty: 7, iconCount: 10, layers: 5, seed: 7002, shape: 'diamond' },
          { id: 109, name: '高手3', difficulty: 8, iconCount: 10, layers: 6, seed: 7003, shape: 'spiral' },
        ],
      },
      {
        id: 'c',
        name: '王者线',
        color: '#a855f7',
        levels: [
          { id: 106, name: '王者1', difficulty: 9, iconCount: 11, layers: 6, seed: 8001, shape: 'spiral' },
          { id: 107, name: '王者2', difficulty: 10, iconCount: 12, layers: 6, seed: 8002, shape: 'cross' },
          { id: 110, name: '王者3', difficulty: 11, iconCount: 12, layers: 7, seed: 8003, shape: 'circle' },
        ],
      },
    ],
  },
};

/** 基于种子的伪随机数生成器 (Mulberry32) */
function createSeededRandom(seed) {
  let state = seed;
  return function() {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 根据形状生成卡牌位置 */
function generateShapePositions(shape, count, centerX, centerY, maxRadius, offset, random) {
  const positions = [];
  const safeRadius = Math.max(maxRadius - offset, CARD_W);
  
  switch (shape) {
    case 'grid':
      // 矩形网格布局
      const cols = Math.ceil(Math.sqrt(count * 1.5));
      const rows = Math.ceil(count / cols);
      const gridW = cols * CARD_W + (cols - 1) * CARD_GAP;
      const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;
      const startX = centerX - gridW / 2 + CARD_W / 2;
      const startY = centerY - gridH / 2 + CARD_H / 2;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (positions.length >= count) break;
          positions.push({
            x: startX + c * (CARD_W + CARD_GAP) + offset / 2,
            y: startY + r * (CARD_H + CARD_GAP) + offset / 2
          });
        }
      }
      break;
      
    case 'circle':
      // 圆形分布
      const rings = Math.ceil(count / 8);
      let placed = 0;
      for (let ring = 0; ring < rings && placed < count; ring++) {
        const ringRadius = safeRadius * (ring + 1) / rings;
        const cardsInRing = Math.min(Math.ceil(6 + ring * 4), count - placed);
        for (let i = 0; i < cardsInRing && placed < count; i++) {
          const angle = (2 * Math.PI * i / cardsInRing) + random() * 0.3;
          positions.push({
            x: centerX + ringRadius * Math.cos(angle) - CARD_W / 2 + offset / 2,
            y: centerY + ringRadius * Math.sin(angle) - CARD_H / 2 + offset / 2
          });
          placed++;
        }
      }
      break;
      
    case 'diamond':
      // 菱形分布
      const halfCount = Math.ceil(count / 2);
      let dIdx = 0;
      for (let row = 0; dIdx < count; row++) {
        const rowWidth = row < halfCount ? row + 1 : count - row;
        const rowY = centerY - (halfCount * CARD_H) / 2 + row * CARD_H + offset / 2;
        const rowStartX = centerX - (rowWidth * CARD_W) / 2 + CARD_W / 2 + offset / 2;
        for (let col = 0; col < rowWidth && dIdx < count; col++) {
          positions.push({
            x: rowStartX + col * (CARD_W + CARD_GAP / 2),
            y: rowY
          });
          dIdx++;
        }
      }
      break;
      
    case 'cross':
      // 十字形分布
      const armLen = Math.ceil(count / 4);
      const crossGap = CARD_W + CARD_GAP;
      // 中心十字
      for (let i = -armLen; i <= armLen && positions.length < count; i++) {
        positions.push({
          x: centerX + i * crossGap - CARD_W / 2 + offset / 2,
          y: centerY - CARD_H / 2 + offset / 2
        });
      }
      for (let i = -armLen; i <= armLen && positions.length < count; i++) {
        if (i !== 0) {
          positions.push({
            x: centerX - CARD_W / 2 + offset / 2,
            y: centerY + i * crossGap - CARD_H / 2 + offset / 2
          });
        }
      }
      // 填充剩余
      while (positions.length < count) {
        const angle = random() * 2 * Math.PI;
        const r = random() * safeRadius * 0.6;
        positions.push({
          x: centerX + r * Math.cos(angle) - CARD_W / 2 + offset / 2,
          y: centerY + r * Math.sin(angle) - CARD_H / 2 + offset / 2
        });
      }
      break;
      
    case 'spiral':
      // 螺旋形分布
      for (let i = 0; i < count; i++) {
        const angle = i * 0.5 + random() * 0.1;
        const radius = safeRadius * (i / count) * 0.8;
        positions.push({
          x: centerX + radius * Math.cos(angle) - CARD_W / 2 + offset / 2,
          y: centerY + radius * Math.sin(angle) - CARD_H / 2 + offset / 2
        });
      }
      break;
      
    default:
      // 默认网格
      const defCols = Math.ceil(Math.sqrt(count * 1.5));
      const defRows = Math.ceil(count / defCols);
      for (let c = 0; c < defCols; c++) {
        for (let r = 0; r < defRows; r++) {
          if (positions.length >= count) break;
          positions.push({
            x: centerX - (defCols * CARD_W) / 2 + c * CARD_W + offset / 2,
            y: centerY - (defRows * CARD_H) / 2 + r * CARD_H + offset / 2
          });
        }
      }
  }
  
  // 随机打乱位置顺序
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  return positions;
}

// 预加载麻将图片
function preloadImages() {
  CARD_ICONS.forEach(icon => {
    const img = tt.createImage();
    img.src = `images/${icon}.png`;
    cardImages[icon] = img;
  });
}
const SLOT_MAX = 7;
const MATCH_COUNT = 3;

let gameState = 'branchSelect'; // 启动时进入分支选择（入门/挑战）
let selectedBranch = null; // 当前选中分支
let selectedLine = null; // 选中的线路ID
let currentLevel = 1;
let currentLevelConfig = null; // 当前关卡详细配置
let currentLineId = null; // 当前线路ID（入口关卡时为null）
let entryCompleted = { beginner: true, challenge: true }; // 入口关卡是否通关（测试：全开）
let unlockedLevels = { 
  beginner: { entry: true, a: [2, 3, 8], b: [4, 5, 9], c: [6, 7, 10] }, 
  challenge: { entry: true, a: [102, 103, 108], b: [104, 105, 109], c: [106, 107, 110] } 
}; // 线路解锁状态（测试：全开）
let score = 0;
let timeLeft = 120;
let maxTime = 120;
let timerInterval = null;
let cards = [];
let slots = [];
let props = { undo: 3, find: 3, bomb: 3 };
let userId = null;
let showSidebarGift = false;
let showSidebarModal = false;
let sidebarTaskDone = false;
let sidebarRewardClaimed = false;
let showWinModal = false;
let showFailModal = false;

// 卡牌飞入暂存槽动画
let flyingCards = []; // { card, startX, startY, targetX, targetY, progress, startTime }
const FLY_DURATION = 200; // 动画时长(ms)

// 道具激活状态
let activeProp = null; // 'find' 或 'bomb' 时等待选择暂存槽
let highlightedCards = []; // 寻找道具高亮的卡牌

const CARD_W = Math.floor(H * 0.11);
const CARD_H = Math.floor(CARD_W * 1.3);
const CARD_GAP = Math.floor(CARD_W * 0.12);
// 游戏区域：中间主体，减少上下间距
const GAME_AREA_X = Math.floor(W * 0.05);
const GAME_AREA_Y = Math.floor(H * 0.065);
const GAME_AREA_W = Math.floor(W * 0.9);
const GAME_AREA_H = Math.floor(H * 0.68);
// 底部栏：暂存槽高度与麻将牌一致
const SLOT_W = Math.floor(W * 0.55);
const SLOT_H = CARD_H + 16; // 麻将牌高度 + 边距
const SLOT_X = Math.floor(W * 0.03);
const SLOT_Y = Math.floor(H * 0.78);
// 道具栏高度与暂存槽一致
const PROP_W = Math.floor(W * 0.35);
const PROP_H = SLOT_H;
const PROP_X = Math.floor(W * 0.62);
const PROP_Y = SLOT_Y;

/** 圆角矩形 */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

/** 判断卡牌是否被覆盖 */
function isCardCovered(card) {
  return cards.some(other => {
    if (other === card || other.removed || other.inSlot) return false;
    if (other.layer <= card.layer) return false;
    return !(card.x + CARD_W <= other.x || other.x + CARD_W <= card.x ||
             card.y + CARD_H <= other.y || other.y + CARD_H <= card.y);
  });
}

/** 初始化 */
function init() {
  preloadImages();
  initSound();
  loadUnlockProgress(); // 加载解锁进度
  if (typeof tt.checkScene === 'function') {
    tt.checkScene({
      scene: 'sidebar',
      success: (res) => { showSidebarGift = !!res.isExist; },
      fail: () => {},
    });
  }
  login();
  // 不直接开始游戏，等待玩家选择关卡
  bindTouchEvents();
  gameLoop();
}

/** 加载解锁进度 */
function loadUnlockProgress() {
  try {
    const saved = tt.getStorageSync('mah_unlocked');
    if (saved) {
      const data = JSON.parse(saved);
      if (data.entryCompleted) entryCompleted = data.entryCompleted;
      if (data.unlockedLevels) unlockedLevels = data.unlockedLevels;
    }
  } catch (e) {}
}

/** 保存解锁进度 */
function saveUnlockProgress() {
  try {
    tt.setStorageSync('mah_unlocked', JSON.stringify({
      entryCompleted,
      unlockedLevels,
    }));
  } catch (e) {}
}

/** 解锁下一关 */
function unlockNextLevel(levelId, branch, lineId) {
  const branchConfig = LEVELS_CONFIG[branch];
  
  // 入口关卡通关后，解锁三条线路的第一关
  if (!lineId && levelId === branchConfig.entry.id) {
    entryCompleted[branch] = true;
    // 解锁三条线路的第一关
    branchConfig.lines.forEach(line => {
      const firstLevelId = line.levels[0].id;
      if (!unlockedLevels[branch][line.id].includes(firstLevelId)) {
        unlockedLevels[branch][line.id].push(firstLevelId);
      }
    });
    saveUnlockProgress();
    return;
  }
  
  // 线路关卡
  const line = branchConfig.lines.find(l => l.id === lineId);
  if (!line) return;
  
  const levels = line.levels;
  const idx = levels.findIndex(l => l.id === levelId);
  
  // 解锁当前线路的下一关
  if (idx >= 0 && idx < levels.length - 1) {
    const nextId = levels[idx + 1].id;
    if (!unlockedLevels[branch][lineId].includes(nextId)) {
      unlockedLevels[branch][lineId].push(nextId);
      saveUnlockProgress();
    }
  }
  
  // 当前线路通关后，解锁下一条线路的第一关
  if (idx === levels.length - 1) {
    const lineIdx = branchConfig.lines.findIndex(l => l.id === lineId);
    if (lineIdx >= 0 && lineIdx < branchConfig.lines.length - 1) {
      const nextLine = branchConfig.lines[lineIdx + 1];
      const firstLevelId = nextLine.levels[0].id;
      if (!unlockedLevels[branch][nextLine.id].includes(firstLevelId)) {
        unlockedLevels[branch][nextLine.id].push(firstLevelId);
        saveUnlockProgress();
      }
    }
  }
}

async function login() {
  try {
    if (!tt.createCloud && !tt.cloud) return;
    const result = await userApi.login({});
    if (result.code === 0 && result.data) {
      userId = result.data._id;
      // 从云端加载关卡进度
      await loadCloudProgress();
    }
  } catch (e) { console.warn('登录失败:', e.message); }
}

/** 从云端加载关卡进度 */
async function loadCloudProgress() {
  if (!userId) return;
  try {
    const result = await userApi.getProgress(userId);
    if (result.code === 0 && result.data) {
      const cloudProgress = result.data;
      // 合并云端进度（云端优先）
      if (cloudProgress.completedLevels) {
        unlockedLevels.beginner = cloudProgress.completedLevels.beginner || unlockedLevels.beginner;
        unlockedLevels.challenge = cloudProgress.completedLevels.challenge || unlockedLevels.challenge;
      }
      if (cloudProgress.currentBranch) {
        selectedBranch = cloudProgress.currentBranch;
      }
      saveUnlockProgress();
    }
  } catch (e) { console.warn('加载云端进度失败:', e.message); }
}

/** 开始关卡 */
function startLevel(levelId, branch, lineId) {
  const branchConfig = LEVELS_CONFIG[branch];
  
  // 入口关卡（lineId为null）
  if (!lineId) {
    currentLevelConfig = branchConfig.entry;
    currentLevel = levelId;
    selectedBranch = branch;
    currentLineId = null;
  } else {
    // 线路关卡
    const line = branchConfig.lines.find(l => l.id === lineId);
    if (!line) return;
    
    const levelConfig = line.levels.find(l => l.id === levelId);
    if (!levelConfig) return;
    
    currentLevelConfig = levelConfig;
    currentLevel = levelId;
    selectedBranch = branch;
    currentLineId = lineId;
  }
  
  gameState = 'playing';
  showWinModal = false;
  showFailModal = false;
  slots = [];
  cards = [];
  score = 0;

  // 使用种子生成关卡
  const seed = currentLevelConfig.seed || currentLevelConfig.id;
  const random = createSeededRandom(seed);
  
  const iconCount = Math.min(currentLevelConfig.iconCount, CARD_ICONS.length);
  const layerCount = Math.min(currentLevelConfig.layers, 5);
  const totalCards = iconCount * MATCH_COUNT;
  const icons = CARD_ICONS.slice(0, iconCount);

  // 随机分配图标到每张卡牌（确保每种图标有MATCH_COUNT张）
  const iconPool = [];
  for (let i = 0; i < iconCount; i++) {
    for (let j = 0; j < MATCH_COUNT; j++) {
      iconPool.push(icons[i]);
    }
  }
  // 使用种子随机打乱图标顺序
  for (let i = iconPool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [iconPool[i], iconPool[j]] = [iconPool[j], iconPool[i]];
  }

  const cardData = [];
  for (let i = 0; i < totalCards; i++) {
    cardData.push({ 
      icon: iconPool[i], 
      layer: 0, 
      id: i, 
      removed: false, 
      inSlot: false, 
      x: 0, 
      y: 0 
    });
  }

  // 基于种子的随机位置分布，支持不同形状，居中于屏幕中心
  const shape = currentLevelConfig.shape || 'grid';
  const centerX = GAME_AREA_X + GAME_AREA_W / 2;
  const centerY = GAME_AREA_Y + GAME_AREA_H / 2;
  const maxRadius = Math.min(GAME_AREA_W, GAME_AREA_H) / 2 - CARD_W;
  
  for (let layer = 0; layer < layerCount; layer++) {
    const layerStart = Math.floor(layer * totalCards / layerCount);
    const layerEnd = Math.floor((layer + 1) * totalCards / layerCount);
    const layerCardCount = layerEnd - layerStart;
    const layerOffset = layer * CARD_GAP * 2;
    
    // 根据形状生成位置
    const positions = generateShapePositions(shape, layerCardCount, centerX, centerY, maxRadius, layerOffset, random);
    
    // 分配位置到该层的卡牌
    for (let i = 0; i < layerCardCount; i++) {
      const idx = layerStart + i;
      if (idx >= totalCards) break;
      cardData[idx].x = positions[i].x;
      cardData[idx].y = positions[i].y;
      cardData[idx].layer = layer;
    }
  }

  cards = cardData;
  maxTime = Math.max(60, 120 - currentLevelConfig.difficulty * 5);
  timeLeft = maxTime;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState !== 'playing') return;
    timeLeft--;
    if (timeLeft <= 10 && timeLeft > 0) playSound('warning');
    if (timeLeft <= 0) {
      gameState = 'fail';
      showFailModal = true;
      playSound('lose');
      clearInterval(timerInterval);
    }
  }, 1000);
}

/** 点击卡牌 */
function onCardTap(card) {
  if (gameState !== 'playing') return;
  if (card.removed || card.inSlot || isCardCovered(card)) return;
  if (slots.length >= SLOT_MAX) return;
  if (flyingCards.some(f => f.card.id === card.id)) return; // 正在动画中

  playSound('click'); // 点击音效
  
  // 记录起始位置
  const startX = card.x;
  const startY = card.y;
  
  // 标记卡牌进入暂存槽
  card.inSlot = true;
  slots.push(card);
  
  // 计算目标位置（暂存槽中的位置）
  const slotIndex = slots.length - 1;
  const slotWidth = SLOT_W - 20;
  const cardInSlotW = (slotWidth - (SLOT_MAX - 1) * 4) / SLOT_MAX;
  const targetX = SLOT_X + 10 + slotIndex * (cardInSlotW + 4) + (cardInSlotW - CARD_W) / 2;
  const targetY = SLOT_Y + (SLOT_H - CARD_H) / 2;
  
  // 启动飞入动画
  flyingCards.push({
    card,
    startX,
    startY,
    targetX,
    targetY,
    startTime: Date.now()
  });
  
  // 播放进入暂存槽音效
  playSound('slot');
}

/** 更新飞入动画 */
function updateFlyingCards() {
  const now = Date.now();
  flyingCards = flyingCards.filter(f => {
    const elapsed = now - f.startTime;
    if (elapsed >= FLY_DURATION) {
      return false; // 动画完成，移除
    }
    f.progress = elapsed / FLY_DURATION;
    return true;
  });
}

/** 绘制飞入动画卡牌 */
function drawFlyingCards() {
  flyingCards.forEach(f => {
    // 缓动函数：ease-out
    const t = f.progress;
    const ease = 1 - (1 - t) * (1 - t);
    
    const x = f.startX + (f.targetX - f.startX) * ease;
    const y = f.startY + (f.targetY - f.startY) * ease;
    const scale = 1 - ease * 0.15; // 飞入时略微缩小
    
    ctx.save();
    ctx.translate(x + CARD_W / 2, y + CARD_H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_W / 2, -CARD_H / 2);
    
    drawCard(f.card, 0, 0, CARD_W, CARD_H);
    
    ctx.restore();
  });
}

/** 检测并处理消除（三张相同） */
function checkMatch() {
  for (let i = slots.length - 1; i >= 2; i--) {
    if (slots[i].icon === slots[i - 1].icon && slots[i].icon === slots[i - 2].icon) {
      playSound('match');
      const removed = slots.splice(i - 2, 3);
      removed.forEach(c => c.removed = true);
      score += 30;
      if (cards.every(c => c.removed)) {
        gameState = 'win';
        showWinModal = true;
        playSound('win');
        playSound('unlock');
        clearInterval(timerInterval);
        saveRecord();
      }
      return;
    }
  }
  
  if (slots.length >= SLOT_MAX) {
    gameState = 'fail';
    showFailModal = true;
    playSound('lose');
    clearInterval(timerInterval);
  }
}

/** 动画完成后检测消除 */
function onFlyComplete() {
  checkMatch();
}

async function saveRecord() {
  if (!userId) return;
  try {
    await gameApi.saveRecord(userId, currentLevel, score, maxTime - timeLeft);
    
    // 同步关卡进度到云端
    const progress = {
      completedLevels: unlockedLevels[selectedBranch],
      currentBranch: selectedBranch,
      unlockedLevel: currentLevel,
    };
    await userApi.updateProgress(userId, progress);
  } catch (e) { console.warn('保存记录失败:', e.message); }
}

/** 使用道具 */
function useProp(propKey) {
  if (gameState !== 'playing') return;
  if (props[propKey] <= 0) return;
  
  // 如果已经有道具激活，取消它
  if (activeProp) {
    activeProp = null;
    highlightedCards = [];
    return;
  }

  if (propKey === 'undo' && slots.length > 0) {
    props.undo--;
    const card = slots.pop();
    card.inSlot = false;
    card.removed = false;
    playSound('item');
  } else if (propKey === 'find') {
    // 寻找道具：激活等待选择暂存槽
    if (slots.length === 0) return; // 暂存槽为空无法使用
    activeProp = 'find';
    highlightedCards = [];
    playSound('item');
  } else if (propKey === 'bomb') {
    // 炸弹道具：激活等待选择暂存槽
    if (slots.length === 0) return; // 暂存槽为空无法使用
    activeProp = 'bomb';
    highlightedCards = [];
    playSound('item');
  }
}

/** 选择暂存槽卡牌执行道具效果 */
function onSlotCardSelected(slotCard) {
  if (!activeProp) return;
  
  const icon = slotCard.icon;
  
  if (activeProp === 'find') {
    // 寻找：高亮棋盘中相同图标的卡牌
    props.find--;
    highlightedCards = cards.filter(c => 
      c.icon === icon && !c.removed && !c.inSlot && !isCardCovered(c)
    );
    playSound('item');
    // 3秒后取消高亮
    setTimeout(() => {
      highlightedCards = [];
      activeProp = null;
    }, 3000);
  } else if (activeProp === 'bomb') {
    // 炸弹：消除棋盘中相同图标的所有卡牌
    props.bomb--;
    const toRemove = cards.filter(c => c.icon === icon && !c.removed && !c.inSlot);
    toRemove.forEach(c => c.removed = true);
    score += toRemove.length * 10;
    playSound('bomb');
    activeProp = null;
    
    // 检查是否通关
    if (cards.every(c => c.removed)) {
      gameState = 'win';
      showWinModal = true;
      playSound('win');
      clearInterval(timerInterval);
      saveRecord();
    }
  }
  
  activeProp = null;
}

// ==================== 渲染 ====================
function gameLoop() {
  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  if (gameState === 'branchSelect') {
    drawBranchSelect();
  } else if (gameState === 'levelSelect') {
    drawLevelSelect();
  } else {
    drawBackground();
    drawCards();
    drawSlots();
    drawProps();
    drawInfo();
    if (showSidebarGift) drawSidebarGift();
    if (showSidebarModal) drawSidebarModal();
    if (showWinModal) drawWinModal();
    if (showFailModal) drawFailModal();
  }
}

/** 绘制关卡选择界面 */
function drawLevelSelect() {
  // 背景
  drawBackground();
  
  // 标题
  ctx.fillStyle = '#f7e358';
  ctx.font = `bold ${Math.floor(H * 0.04)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('麻将消消乐', W / 2, H * 0.04);
  
  // 返回按钮
  const backBtnW = W * 0.12;
  const backBtnH = H * 0.05;
  const backBtnX = W * 0.03;
  const backBtnY = H * 0.03;
  
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, backBtnX, backBtnY, backBtnW, backBtnH, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.floor(backBtnH * 0.5)}px sans-serif`;
  ctx.fillText('返回', backBtnX + backBtnW / 2, backBtnY + backBtnH / 2);
  
  // 显示选中分支的关卡地图
  const branch = LEVELS_CONFIG[selectedBranch];
  if (!branch) return;
  
  drawBranchMap(branch, selectedBranch);
}

/** 绘制分支选择页面（入门/挑战）*/
function drawBranchSelect() {
  // 背景
  drawBackground();
  
  // 标题
  ctx.fillStyle = '#f7e358';
  ctx.font = `bold ${Math.floor(H * 0.05)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('麻将消消乐', W / 2, H * 0.08);
  
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.floor(H * 0.03)}px sans-serif`;
  ctx.fillText('选择游戏模式', W / 2, H * 0.14);
  
  // 两个模式按钮
  const branches = Object.entries(LEVELS_CONFIG);
  const btnW = W * 0.4;
  const btnH = H * 0.35;
  const gap = W * 0.08;
  const startX = (W - btnW * 2 - gap) / 2;
  const btnY = H * 0.25;
  
  branches.forEach(([branchKey, branch], i) => {
    const btnX = startX + i * (btnW + gap);
    
    // 按钮背景
    ctx.fillStyle = branch.color;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 12;
    roundRect(ctx, btnX, btnY, btnW, btnH, 15);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    
    // 模式名称
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(btnH * 0.15)}px sans-serif`;
    ctx.fillText(branch.name, btnX + btnW / 2, btnY + btnH * 0.25);
    
    // 入口关卡信息
    const entry = branch.entry;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `${Math.floor(btnH * 0.08)}px sans-serif`;
    ctx.fillText(`入口: ${entry.name}`, btnX + btnW / 2, btnY + btnH * 0.4);
    
    // 难度星星
    const stars = Math.min(entry.difficulty, 5);
    ctx.fillStyle = '#f7e358';
    ctx.font = `${Math.floor(btnH * 0.08)}px sans-serif`;
    ctx.fillText(Array(stars).fill('').join(''), btnX + btnW / 2, btnY + btnH * 0.5);
    
    // 线路信息
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.floor(btnH * 0.06)}px sans-serif`;
    const lineNames = branch.lines.map(l => l.name).join(' / ');
    ctx.fillText(lineNames, btnX + btnW / 2, btnY + btnH * 0.6);
    
    const totalLevels = branch.lines.reduce((sum, l) => sum + l.levels.length, 0);
    ctx.fillText(`共 ${totalLevels} 关`, btnX + btnW / 2, btnY + btnH * 0.68);
    
    // 进入按钮
    const enterBtnH = btnH * 0.15;
    const enterBtnY = btnY + btnH * 0.75;
    ctx.fillStyle = '#f7e358';
    roundRect(ctx, btnX + btnW * 0.25, enterBtnY, btnW * 0.5, enterBtnH, enterBtnH / 2);
    ctx.fill();
    ctx.fillStyle = '#5a3e0b';
    ctx.font = `bold ${Math.floor(enterBtnH * 0.55)}px sans-serif`;
    ctx.fillText('进入', btnX + btnW / 2, enterBtnY + enterBtnH / 2);
  });
}

/** 绘制单个分支的关卡地图 - 横向卷轴风格 */
function drawBranchMap(branch, branchKey) {
  // 分支标题
  ctx.fillStyle = branch.color;
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 6;
  roundRect(ctx, W * 0.35, H * 0.03, W * 0.3, H * 0.04, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(H * 0.02)}px sans-serif`;
  ctx.fillText(branch.name, W / 2, H * 0.03 + H * 0.02);
  
  // 绘制路径背景（草地/道路）
  ctx.fillStyle = 'rgba(34,139,34,0.15)';
  roundRect(ctx, W * 0.02, H * 0.1, W * 0.96, H * 0.85, 20);
  ctx.fill();
  
  // 入口关卡 - 起点位置
  const startX = W * 0.08;
  const startY = H * 0.5;
  drawLevelNode(branch.entry, startX, startY, entryCompleted[branchKey] || unlockedLevels[branchKey]?.entry, branch.color, 'entry');
  
  // 三条线路从入口分支
  const branchPointX = startX + W * 0.12;
  const lineOffsets = [
    { y: H * 0.25, color: '#4CAF50' },  // 上路 - 绿色
    { y: H * 0.5, color: '#2196F3' },    // 中路 - 蓝色
    { y: H * 0.75, color: '#FF9800' }    // 下路 - 橙色
  ];
  
  // 绘制分支路径线
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 4]);
  
  // 入口到分支点
  ctx.beginPath();
  ctx.moveTo(startX + W * 0.05, startY);
  ctx.lineTo(branchPointX, startY);
  ctx.stroke();
  
  // 分支点到各线路
  lineOffsets.forEach((offset, i) => {
    ctx.beginPath();
    ctx.moveTo(branchPointX, startY);
    ctx.bezierCurveTo(
      branchPointX + W * 0.05, startY,
      branchPointX + W * 0.05, offset.y,
      branchPointX + W * 0.08, offset.y
    );
    ctx.stroke();
  });
  
  ctx.setLineDash([]);
  
  // 绘制三条线路的关卡节点
  const levelSpacing = W * 0.18;
  branch.lines.forEach((line, lineIdx) => {
    const baseY = lineOffsets[lineIdx].y;
    const lineColor = lineOffsets[lineIdx].color;
    
    // 线路名称标签
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.8;
    roundRect(ctx, branchPointX - W * 0.02, baseY - H * 0.02, W * 0.08, H * 0.04, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.floor(H * 0.018)}px sans-serif`;
    ctx.fillText(line.name, branchPointX + W * 0.02, baseY);
    
    // 绘制线路路径
    const lineStartX = branchPointX + W * 0.1;
    const lineEndX = lineStartX + (line.levels.length - 1) * levelSpacing + W * 0.06;
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(lineStartX, baseY);
    ctx.lineTo(lineEndX, baseY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // 绘制关卡节点
    line.levels.forEach((level, levelIdx) => {
      const nodeX = lineStartX + levelIdx * levelSpacing;
      const isUnlocked = unlockedLevels[branchKey]?.[line.id]?.includes(level.id);
      drawLevelNode(level, nodeX, baseY, isUnlocked, lineColor, 'level', levelIdx);
    });
  });
}

/** 绘制关卡节点 */
function drawLevelNode(level, x, y, isUnlocked, color, type, index) {
  const nodeRadius = type === 'entry' ? H * 0.06 : H * 0.05;
  
  // 节点外圈光晕（解锁时）
  if (isUnlocked) {
    ctx.beginPath();
    ctx.arc(x, y, nodeRadius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  
  // 节点主体
  ctx.beginPath();
  ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
  ctx.fillStyle = isUnlocked ? color : 'rgba(80,80,80,0.6)';
  ctx.shadowColor = isUnlocked ? 'rgba(0,0,0,0.3)' : 'transparent';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  
  // 节点内圈
  ctx.beginPath();
  ctx.arc(x, y, nodeRadius * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = isUnlocked ? '#fff' : '#555';
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;
  
  // 关卡编号/名称
  ctx.fillStyle = isUnlocked ? '#fff' : '#888';
  ctx.font = `bold ${Math.floor(nodeRadius * 0.6)}px sans-serif`;
  if (type === 'entry') {
    ctx.fillText('起', x, y);
  } else {
    ctx.fillText(String(index + 1), x, y);
  }
  
  // 未解锁遮罩
  if (!isUnlocked) {
    ctx.beginPath();
    ctx.arc(x, y, nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    
    // 锁图标
    ctx.fillStyle = '#666';
    ctx.font = `${Math.floor(nodeRadius * 0.5)}px sans-serif`;
    ctx.fillText('', x, y);
  }
  
  // 难度指示（小星星在节点下方）
  if (isUnlocked && level.difficulty) {
    const stars = Math.min(level.difficulty, 3);
    ctx.fillStyle = '#f7e358';
    ctx.font = `${Math.floor(nodeRadius * 0.35)}px sans-serif`;
    ctx.fillText(Array(stars).fill('').join(''), x, y + nodeRadius * 1.5);
  }
}

/** 处理分支选择页面点击 */
function handleBranchSelectTouch(x, y) {
  const branches = Object.entries(LEVELS_CONFIG);
  const btnW = W * 0.4;
  const btnH = H * 0.35;
  const gap = W * 0.08;
  const startX = (W - btnW * 2 - gap) / 2;
  const btnY = H * 0.25;
  
  branches.forEach(([branchKey, branch], i) => {
    const btnX = startX + i * (btnW + gap);
    const enterBtnH = btnH * 0.15;
    const enterBtnY = btnY + btnH * 0.75;
    
    // 点击进入按钮
    if (x >= btnX + btnW * 0.25 && x <= btnX + btnW * 0.75 &&
        y >= enterBtnY && y <= enterBtnY + enterBtnH) {
      selectedBranch = branchKey;
      gameState = 'levelSelect';
      return;
    }
  });
}

/** 处理关卡选择页面点击 - 横向卷轴地图 */
function handleLevelSelectTouch(x, y) {
  // 返回按钮
  const backBtnW = W * 0.12;
  const backBtnH = H * 0.05;
  const backBtnX = W * 0.03;
  const backBtnY = H * 0.03;
  
  if (x >= backBtnX && x <= backBtnX + backBtnW &&
      y >= backBtnY && y <= backBtnY + backBtnH) {
    playSound('click');
    gameState = 'branchSelect';
    selectedBranch = null;
    return;
  }
  
  const branch = LEVELS_CONFIG[selectedBranch];
  if (!branch) return;
  
  // 入口关卡节点点击
  const startX = W * 0.08;
  const startY = H * 0.5;
  const entryRadius = H * 0.06;
  const isEntryUnlocked = entryCompleted[selectedBranch] || unlockedLevels[selectedBranch]?.entry;
  
  if (isEntryUnlocked) {
    const dist = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
    if (dist <= entryRadius * 1.5) {
      playSound('click');
      currentLevel = branch.entry.id;
      currentLevelConfig = branch.entry;
      currentLineId = null;
      startLevel();
      return;
    }
  }
  
  // 三条线路关卡节点点击
  const branchPointX = startX + W * 0.12;
  const levelSpacing = W * 0.18;
  const lineOffsets = [H * 0.25, H * 0.5, H * 0.75];
  const levelRadius = H * 0.05;
  const lineStartX = branchPointX + W * 0.1;
  
  // 使用 for 循环以便正确跳出
  for (let lineIdx = 0; lineIdx < branch.lines.length; lineIdx++) {
    const line = branch.lines[lineIdx];
    const baseY = lineOffsets[lineIdx];
    
    for (let levelIdx = 0; levelIdx < line.levels.length; levelIdx++) {
      const level = line.levels[levelIdx];
      const nodeX = lineStartX + levelIdx * levelSpacing;
      const isUnlocked = unlockedLevels[selectedBranch]?.[line.id]?.includes(level.id);
      
      if (isUnlocked) {
        const dist = Math.sqrt((x - nodeX) ** 2 + (y - baseY) ** 2);
        if (dist <= levelRadius * 1.5) {
          playSound('click');
          selectedLine = line.id;
          currentLevel = level.id;
          currentLevelConfig = level;
          currentLineId = line.id;
          startLevel();
          return;
        }
      }
    }
  }
}

/** 绘制卡牌 */
function drawCards() {
  const sorted = cards.filter(c => !c.removed && !c.inSlot).sort((a, b) => a.layer - b.layer);
  for (const card of sorted) {
    const covered = isCardCovered(card);
    const isHighlighted = highlightedCards.includes(card);
    
    ctx.save();
    if (covered) ctx.globalAlpha = 0.5;
    
    // 高亮效果
    if (isHighlighted) {
      ctx.shadowColor = '#f7e358';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;
    }

    const g = ctx.createLinearGradient(card.x, card.y, card.x, card.y + CARD_H);
    g.addColorStop(0, '#fffef9');
    g.addColorStop(1, '#efe0c6');
    ctx.fillStyle = g;
    roundRect(ctx, card.x, card.y, CARD_W, CARD_H, 6);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    
    // 绘制麻将图片
    const img = cardImages[card.icon];
    if (img && img.complete) {
      const imgW = CARD_W * 0.8;
      const imgH = CARD_H * 0.8;
      ctx.drawImage(img, card.x + (CARD_W - imgW) / 2, card.y + (CARD_H - imgH) / 2, imgW, imgH);
    }

    if (covered) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      roundRect(ctx, card.x, card.y, CARD_W, CARD_H, 6);
      ctx.fill();
    }
    
    // 高亮边框
    if (isHighlighted) {
      ctx.strokeStyle = '#f7e358';
      ctx.lineWidth = 3;
      roundRect(ctx, card.x, card.y, CARD_W, CARD_H, 6);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

/** 绘制背景 */
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a472a');
  grad.addColorStop(0.5, '#2d5a3f');
  grad.addColorStop(1, '#1a472a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** 绘制暂存槽 - 底部左侧 */
function drawSlots() {
  // 暂存槽背景
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, SLOT_X, SLOT_Y, SLOT_W, SLOT_H, 8);
  ctx.fill();
  
  // 边框高光
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, SLOT_X, SLOT_Y, SLOT_W, SLOT_H, 8);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // 使用原始麻将牌尺寸，居中排列
  const padding = 8;
  const gap = Math.floor(CARD_W * 0.08);
  const totalWidth = CARD_W * SLOT_MAX + gap * (SLOT_MAX - 1);
  const startX = SLOT_X + (SLOT_W - totalWidth) / 2;
  const startY = SLOT_Y + padding;
  
  for (let i = 0; i < SLOT_MAX; i++) {
    const sx = startX + i * (CARD_W + gap);
    const sy = startY;
    
    if (i < slots.length) {
      // 已放置的卡牌 - 使用原始尺寸
      const g = ctx.createLinearGradient(sx, sy, sx, sy + CARD_H);
      g.addColorStop(0, '#fffef9');
      g.addColorStop(1, '#efe0c6');
      ctx.fillStyle = g;
      roundRect(ctx, sx, sy, CARD_W, CARD_H, 4);
      ctx.fill();
      
      // 绘制麻将图片
      const img = cardImages[slots[i].icon];
      if (img && img.complete) {
        const imgW = CARD_W * 0.75;
        const imgH = CARD_H * 0.75;
        ctx.drawImage(img, sx + (CARD_W - imgW) / 2, sy + (CARD_H - imgH) / 2, imgW, imgH);
      }
    } else {
      // 空槽位
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, sx, sy, CARD_W, CARD_H, 4);
      ctx.fill();
    }
  }
}

/** 绘制道具栏 - 底部右侧 */
function drawProps() {
  const propDefs = [
    { key: 'undo', label: '回退' },
    { key: 'find', label: '寻找' },
    { key: 'bomb', label: '炸弹' },
  ];
  
  // 道具栏背景
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, PROP_X, PROP_Y, PROP_W, PROP_H, 8);
  ctx.fill();
  
  // 边框高光
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  roundRect(ctx, PROP_X, PROP_Y, PROP_W, PROP_H, 8);
  ctx.stroke();
  
  const btnW = Math.floor((PROP_W - 16) / 3 - 4);
  const btnH = Math.floor(PROP_H - 10);
  const btnGap = 4;
  const startX = PROP_X + 8;
  const startY = PROP_Y + 5;
  
  propDefs.forEach((p, i) => {
    const bx = startX + i * (btnW + btnGap);
    const by = startY;
    const isActive = activeProp === p.key;
    
    // 背景 - 激活时高亮
    if (isActive) {
      ctx.fillStyle = '#f7e358';
      roundRect(ctx, bx, by, btnW, btnH, 4);
      ctx.fill();
    } else {
      const bgAlpha = props[p.key] > 0 ? 0.2 : 0.06;
      ctx.fillStyle = `rgba(255,255,255,${bgAlpha})`;
      roundRect(ctx, bx, by, btnW, btnH, 4);
      ctx.fill();
    }
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 道具名称
    ctx.fillStyle = isActive ? '#5a3e0b' : (props[p.key] > 0 ? '#fff' : '#555');
    ctx.font = `bold ${Math.floor(btnH * 0.32)}px sans-serif`;
    ctx.fillText(p.label, bx + btnW / 2, by + btnH * 0.35);
    
    // 数量
    ctx.fillStyle = isActive ? '#8b6914' : (props[p.key] > 0 ? '#f7e358' : '#444');
    ctx.font = `${Math.floor(btnH * 0.22)}px sans-serif`;
    ctx.fillText(`${props[p.key]}`, bx + btnW / 2, by + btnH * 0.7);
  });
  
  // 道具激活提示
  if (activeProp) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const tipW = W * 0.5;
    const tipH = H * 0.06;
    const tipX = (W - tipW) / 2;
    const tipY = H * 0.5;
    roundRect(ctx, tipX, tipY, tipW, tipH, 8);
    ctx.fill();
    
    ctx.fillStyle = '#f7e358';
    ctx.font = `${Math.floor(tipH * 0.4)}px sans-serif`;
    ctx.fillText(activeProp === 'find' ? '请点击暂存槽中的麻将' : '请点击暂存槽中的麻将', W / 2, tipY + tipH / 2);
  }
}

/** 绘制顶部信息栏 - 一行：左侧积分 + 右侧倒计时进度条 */
function drawInfo() {
  const topH = H * 0.055;
  const fs = Math.floor(H * 0.03);
  const centerY = H * 0.036;
  
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // 顶部栏背景
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, W * 0.02, H * 0.01, W * 0.96, topH, 8);
  ctx.fill();
  
  // 左侧：积分
  const scoreX = W * 0.05;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${fs}px sans-serif`;
  ctx.fillText('积分', scoreX, centerY);
  ctx.fillStyle = '#f7e358';
  ctx.font = `bold ${fs + 4}px sans-serif`;
  ctx.fillText(`${score}`, scoreX + fs * 2.5, centerY);
  
  // 右侧：倒计时进度条
  const barW = W * 0.22;
  const barH = H * 0.022;
  const barX = W - barW - W * 0.05;
  const barY = centerY - barH / 2;
  const progress = Math.max(0, timeLeft / maxTime);
  
  // 进度条轨道
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, barX, barY, barW, barH, 3);
  ctx.fill();
  
  // 进度条填充
  const fillW = Math.max(barW * progress, 2);
  if (progress > 0.3) {
    ctx.fillStyle = '#22c55e';
  } else if (progress > 0.15) {
    ctx.fillStyle = '#f59e0b';
  } else {
    ctx.fillStyle = '#ef4444';
  }
  roundRect(ctx, barX, barY, fillW, barH, 3);
  ctx.fill();
  
  // 时间标签
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${fs}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('时间', barX - 8, centerY);
}

function drawSidebarGift() {
  ctx.fillStyle = '#f7931e';
  roundRect(ctx, 10, 10, 50, 55, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('福利', 35, 37);
}

function drawButton(x, y, w, h, text, bgColor, textColor) {
  ctx.fillStyle = bgColor;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = `bold ${Math.floor(h * 0.45)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function drawModalOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);
}

function drawWinModal() {
  drawModalOverlay();
  const mw = W * 0.4, mh = H * 0.4;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  ctx.fillStyle = '#2d5a27';
  roundRect(ctx, mx, my, mw, mh, 20);
  ctx.fill();
  ctx.fillStyle = '#f7e358';
  ctx.font = `bold ${Math.floor(H * 0.05)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('恭喜过关', mx + mw / 2, my + mh * 0.2);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.floor(H * 0.025)}px sans-serif`;
  ctx.fillText(`得分: ${score}   关卡: ${currentLevel}`, mx + mw / 2, my + mh * 0.4);
  drawButton(mx + mw * 0.08, my + mh * 0.55, mw * 0.4, mh * 0.18, '继续', '#f7e358', '#5a3e0b');
  drawButton(mx + mw * 0.52, my + mh * 0.55, mw * 0.4, mh * 0.18, '选关', 'rgba(255,255,255,0.1)', '#fff');
}

function drawFailModal() {
  drawModalOverlay();
  const mw = W * 0.45, mh = H * 0.5;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  ctx.fillStyle = '#2d5a27';
  roundRect(ctx, mx, my, mw, mh, 20);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.font = `bold ${Math.floor(H * 0.05)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('游戏失败', mx + mw / 2, my + mh * 0.12);
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.floor(H * 0.025)}px sans-serif`;
  ctx.fillText(`得分: ${score}   关卡: ${currentLevel}`, mx + mw / 2, my + mh * 0.25);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${Math.floor(H * 0.02)}px sans-serif`;
  ctx.fillText('看广告可从当前进度继续', mx + mw / 2, my + mh * 0.37);
  drawButton(mx + mw * 0.05, my + mh * 0.48, mw * 0.42, mh * 0.14, '看广告复活', '#ef4444', '#fff');
  drawButton(mx + mw * 0.53, my + mh * 0.48, mw * 0.42, mh * 0.14, '重新开始', 'rgba(255,255,255,0.1)', '#fff');
  drawButton(mx + mw * 0.25, my + mh * 0.7, mw * 0.5, mh * 0.14, '选关', 'rgba(255,255,255,0.1)', '#fff');
}

function drawSidebarModal() {
  drawModalOverlay();
  const mw = W * 0.5, mh = H * 0.55;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  ctx.fillStyle = '#2d5a27';
  roundRect(ctx, mx, my, mw, mh, 20);
  ctx.fill();
  ctx.fillStyle = '#f7e358';
  ctx.font = `bold ${Math.floor(H * 0.04)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('侧边栏入口奖励', mx + mw / 2, my + mh * 0.12);

  const steps = ['1. 点击「去首页侧边栏」', '2. 在侧边栏点击「麻将消消乐」', '3. 返回游戏领取奖励'];
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${Math.floor(H * 0.025)}px sans-serif`;
  steps.forEach((s, i) => ctx.fillText(s, mx + mw / 2, my + mh * (0.25 + i * 0.1)));

  ctx.fillStyle = '#f7e358';
  ctx.font = `bold ${Math.floor(H * 0.03)}px sans-serif`;
  ctx.fillText('奖励：提示次数 +3', mx + mw / 2, my + mh * 0.6);

  if (!sidebarTaskDone) {
    drawButton(mx + mw * 0.05, my + mh * 0.72, mw * 0.42, mh * 0.14, '去首页侧边栏', '#3d8bfd', '#fff');
  }
  drawButton(mx + mw * 0.53, my + mh * 0.72, mw * 0.42, mh * 0.14,
    sidebarTaskDone ? '立即领奖' : '未完成',
    sidebarTaskDone ? '#f7e358' : '#555',
    sidebarTaskDone ? '#5a3e0b' : '#999');

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `${Math.floor(H * 0.03)}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('X', mx + mw - 15, my + 20);
  ctx.textAlign = 'left';
}

// ==================== 触摸事件 ====================
function bindTouchEvents() {
  platform.onTouchStart((res) => {
    const t = res.touches[0];
    const x = t.clientX, y = t.clientY;
    handleTouch(x, y);
  });
}

function handleTouch(x, y) {
  // 分支选择界面
  if (gameState === 'branchSelect') {
    handleBranchSelectTouch(x, y);
    return;
  }
  
  // 关卡选择界面
  if (gameState === 'levelSelect') {
    handleLevelSelectTouch(x, y);
    return;
  }

  if (showWinModal) { handleWinModalTouch(x, y); return; }
  if (showFailModal) { handleFailModalTouch(x, y); return; }
  if (showSidebarModal) { handleSidebarModalTouch(x, y); return; }

  if (showSidebarGift && x >= 10 && x <= 60 && y >= 10 && y <= 65) {
    playSound('modal');
    showSidebarModal = true;
    return;
  }

  if (gameState !== 'playing') return;

  // 道具激活时，点击暂存槽卡牌触发道具效果
  if (activeProp) {
    const padding = 8;
    const gap = Math.floor(CARD_W * 0.08);
    const totalWidth = CARD_W * SLOT_MAX + gap * (SLOT_MAX - 1);
    const startX = SLOT_X + (SLOT_W - totalWidth) / 2;
    const startY = SLOT_Y + padding;
    
    for (let i = 0; i < slots.length; i++) {
      const sx = startX + i * (CARD_W + gap);
      const sy = startY;
      if (x >= sx && x <= sx + CARD_W && y >= sy && y <= sy + CARD_H) {
        playSound('click');
        onSlotCardSelected(slots[i]);
        return;
      }
    }
    // 点击暂存槽外的区域取消道具
    activeProp = null;
    highlightedCards = [];
    return;
  }

  // 道具栏点击
  const propDefs = ['undo', 'find', 'bomb'];
  const btnW = Math.floor((PROP_W - 16) / 3 - 4);
  const btnH = Math.floor(PROP_H - 10);
  const btnGap = 4;
  const startX = PROP_X + 8;
  const startY = PROP_Y + 5;
  for (let i = 0; i < 3; i++) {
    const bx = startX + i * (btnW + btnGap);
    const by = startY;
    if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
      useProp(propDefs[i]);
      return;
    }
  }

  const sorted = cards.filter(c => !c.removed && !c.inSlot).sort((a, b) => b.layer - a.layer);
  for (const card of sorted) {
    if (x >= card.x && x <= card.x + CARD_W && y >= card.y && y <= card.y + CARD_H) {
      if (!isCardCovered(card)) {
        onCardTap(card);
        return;
      }
    }
  }
}

/** 处理关卡选择点击 */
function handleWinModalTouch(x, y) {
  const mw = W * 0.4, mh = H * 0.4;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  const btnY = my + mh * 0.55, btnH = mh * 0.18;
  if (y >= btnY && y <= btnY + btnH) {
    if (x >= mx + mw * 0.08 && x <= mx + mw * 0.48) {
      playSound('click');
      // 解锁下一关
      unlockNextLevel(currentLevel, selectedBranch, currentLineId);
      
      // 入口关卡通关后，返回关卡选择（显示线路分支）
      if (!currentLineId) {
        gameState = 'levelSelect';
        return;
      }
      
      // 查找当前线路的下一关
      const branch = LEVELS_CONFIG[selectedBranch];
      const line = branch.lines.find(l => l.id === currentLineId);
      const levels = line.levels;
      const idx = levels.findIndex(l => l.id === currentLevel);
      if (idx >= 0 && idx < levels.length - 1) {
        startLevel(levels[idx + 1].id, selectedBranch, currentLineId);
      } else {
        // 当前线路通关，返回关卡选择
        gameState = 'levelSelect';
      }
    } else if (x >= mx + mw * 0.52 && x <= mx + mw * 0.92) {
      playSound('click');
      gameState = 'levelSelect';
    }
  }
}

function handleFailModalTouch(x, y) {
  const mw = W * 0.45, mh = H * 0.5;
  const mx = (W - mw) / 2, my = (H - mh) / 2;
  const btn1Y = my + mh * 0.48, btnH = mh * 0.14;
  if (y >= btn1Y && y <= btn1Y + btnH) {
    if (x >= mx + mw * 0.05 && x <= mx + mw * 0.47) {
      playSound('click');
      showFailModal = false;
      gameState = 'playing';
      slots = [];
      cards.forEach(c => { if (c.inSlot) c.inSlot = false; });
      timeLeft = Math.max(timeLeft, 30);
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (gameState !== 'playing') return;
        timeLeft--;
        if (timeLeft <= 0) { gameState = 'fail'; showFailModal = true; playSound('lose'); clearInterval(timerInterval); }
      }, 1000);
    } else if (x >= mx + mw * 0.53 && x <= mx + mw * 0.95) {
      playSound('click');
      startLevel(currentLevel, selectedBranch);
    }
  }
  const btn2Y = my + mh * 0.7;
  if (y >= btn2Y && y <= btn2Y + btnH && x >= mx + mw * 0.25 && x <= mx + mw * 0.75) {
    playSound('click');
    gameState = 'levelSelect';
  }
}

function handleSidebarModalTouch(x, y) {
  const mw = W * 0.5, mh = H * 0.55;
  const mx = (W - mw) / 2, my = (H - mh) / 2;

  if (x >= mx + mw - 30 && x <= mx + mw - 5 && y >= my + 5 && y <= my + 30) {
    playSound('close-modal');
    showSidebarModal = false;
    return;
  }

  const btnY = my + mh * 0.72, btnH = mh * 0.14;
  if (y >= btnY && y <= btnY + btnH) {
    if (!sidebarTaskDone && x >= mx + mw * 0.05 && x <= mx + mw * 0.47) {
      playSound('click');
      if (typeof tt.navigateToScene === 'function') {
        tt.navigateToScene({ scene: 'sidebar', fail: () => {} });
      }
    } else if (x >= mx + mw * 0.53 && x <= mx + mw * 0.95) {
      if (sidebarTaskDone && !sidebarRewardClaimed) {
        playSound('reward');
        props.find += 3;
        sidebarRewardClaimed = true;
        showSidebarModal = false;
        tt.showToast({ title: '领取成功！寻找+3', icon: 'success' });
      }
    }
  }
}

// ==================== onShow 监听侧边栏 ====================
tt.onShow((options) => {
  if (!options) return;
  const scene = String(options.scene || '');
  const launchFrom = options.launch_from || '';
  const location = options.location || '';
  const fromSidebar = ['021036', '101036', '021012'].includes(scene) || launchFrom === 'homepage' || location === 'sidebar_card';
  if (fromSidebar) sidebarTaskDone = true;
});

// ==================== 启动 ====================
init();
