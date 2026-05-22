/**
 * 麻将消消乐 - 抖音小游戏纯 Canvas 版
 */

// 创建画布
const canvas = tt.createCanvas();
const ctx = canvas.getContext('2d');

// 屏幕尺寸
const width = canvas.width;
const height = canvas.height;

console.log('小游戏启动，尺寸:', width, height);

// ========== 游戏配置 ==========
const LEVELS = [
  { id: 1, name: '入门', iconCount: 6, unlocked: true },
  { id: 2, name: '简单', iconCount: 7, unlocked: false },
  { id: 3, name: '普通', iconCount: 8, unlocked: false },
  { id: 4, name: '中等', iconCount: 9, unlocked: false },
  { id: 5, name: '困难', iconCount: 10, unlocked: false },
  { id: 6, name: '挑战', iconCount: 11, unlocked: false },
  { id: 7, name: '专家', iconCount: 12, unlocked: false },
  { id: 8, name: '大师', iconCount: 13, unlocked: false },
  { id: 9, name: '传奇', iconCount: 14, unlocked: false },
  { id: 10, name: '神话', iconCount: 15, unlocked: false },
];

// ========== 游戏状态 ==========
const state = {
  screen: 'loading',
  loadingProgress: 0,
  level: 1,
  score: 0,
  timeProgress: 100,
};

// ========== 颜色配置 ==========
const COLORS = {
  bg: '#1a1a2e',
  bgGreen: '#2d5a27',
  title: '#f7e358',
  text: '#ffffff',
  textDark: '#5a3e0b',
  btn: '#f7e358',
  btnLocked: '#555',
  progressBg: '#333',
  progressGood: '#4CAF50',
  progressBad: '#F44336',
};

// ========== 绘制 Loading 页面 ==========
function drawLoading() {
  // 背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  
  // 标题
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('麻将消消乐', width / 2, height / 2 - 80);
  
  // 副标题
  ctx.fillStyle = COLORS.text;
  ctx.font = '18px Arial';
  ctx.fillText('三消益智游戏', width / 2, height / 2 - 40);
  
  // 进度条背景
  ctx.fillStyle = COLORS.progressBg;
  roundRect(ctx, width / 2 - 150, height / 2 + 20, 300, 24, 12);
  ctx.fill();
  
  // 进度条
  ctx.fillStyle = COLORS.progressGood;
  const progressWidth = state.loadingProgress * 3;
  roundRect(ctx, width / 2 - 150, height / 2 + 20, progressWidth, 24, 12);
  ctx.fill();
  
  // 百分比
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px Arial';
  ctx.fillText(state.loadingProgress + '%', width / 2, height / 2 + 70);
}

// ========== 绘制关卡选择页面 ==========
function drawLevels() {
  // 背景
  ctx.fillStyle = COLORS.bgGreen;
  ctx.fillRect(0, 0, width, height);
  
  // 标题
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('关卡选择', width / 2, 40);
  
  // 关卡按钮布局
  const cols = 5;
  const rows = 2;
  const btnW = 110;
  const btnH = 70;
  const gap = 15;
  const startX = (width - (cols * btnW + (cols - 1) * gap)) / 2;
  const startY = 90;
  
  LEVELS.forEach((level, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * (btnW + gap);
    const y = startY + row * (btnH + gap + 20);
    
    // 按钮背景
    ctx.fillStyle = level.unlocked ? COLORS.btn : COLORS.btnLocked;
    roundRect(ctx, x, y, btnW, btnH, 10);
    ctx.fill();
    
    // 关卡编号
    ctx.fillStyle = level.unlocked ? COLORS.textDark : '#888';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(level.id, x + btnW / 2, y + btnH / 2 - 10);
    
    // 关卡名称
    ctx.font = '14px Arial';
    ctx.fillText(level.name, x + btnW / 2, y + btnH / 2 + 15);
    
    // 锁定标记
    if (!level.unlocked) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText('锁定', x + btnW / 2, y + btnH - 8);
    }
  });
  
  // 底部提示
  ctx.fillStyle = '#aaa';
  ctx.font = '12px Arial';
  ctx.fillText('点击解锁关卡开始游戏', width / 2, height - 25);
}

// ========== 绘制游戏页面 ==========
function drawGame() {
  // 背景
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);
  
  // 左侧游戏区域
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, 20, 70, width - 220, height - 100, 10);
  ctx.fill();
  
  // 顶部信息栏
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, 20, 15, width - 220, 40, 8);
  ctx.fill();
  
  ctx.fillStyle = COLORS.title;
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('麻将消消乐', 35, 35);
  
  ctx.textAlign = 'right';
  ctx.fillText('第' + state.level + '关 | ' + state.score + '分', width - 240, 35);
  
  // 进度条
  const timeColor = state.timeProgress > 30 ? COLORS.progressGood : COLORS.progressBad;
  ctx.fillStyle = COLORS.progressBg;
  roundRect(ctx, 20, 60, 200, 14, 7);
  ctx.fill();
  
  ctx.fillStyle = timeColor;
  roundRect(ctx, 20, 60, state.timeProgress * 2, 14, 7);
  ctx.fill();
  
  // 右侧控制面板
  const panelX = width - 190;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, panelX, 70, 170, height - 100, 10);
  ctx.fill();
  
  // 暂存槽
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, panelX + 10, 80, 150, 50, 8);
  ctx.fill();
  
  ctx.fillStyle = '#aaa';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('暂存槽 (7格)', panelX + 85, 105);
  
  // 道具按钮
  const items = [
    { name: '回退', count: 3 },
    { name: '寻找', count: 3 },
    { name: '炸弹', count: 2 },
  ];
  
  items.forEach((item, i) => {
    const btnY = 150 + i * 50;
    
    ctx.fillStyle = COLORS.btn;
    roundRect(ctx, panelX + 10, btnY, 150, 35, 8);
    ctx.fill();
    
    ctx.fillStyle = COLORS.textDark;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, panelX + 60, btnY + 22);
    
    ctx.font = '12px Arial';
    ctx.fillText('x' + item.count, panelX + 130, btnY + 22);
  });
  
  // 游戏提示
  ctx.fillStyle = '#888';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('点击麻将牌消除', (width - 220) / 2 + 20, height / 2);
}

// ========== 辅助函数：圆角矩形 ==========
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ========== 主渲染循环 ==========
function render() {
  ctx.clearRect(0, 0, width, height);
  
  switch (state.screen) {
    case 'loading':
      drawLoading();
      break;
    case 'levels':
      drawLevels();
      break;
    case 'game':
      drawGame();
      break;
  }
}

// ========== 加载进度 ==========
let loadingTimer = setInterval(() => {
  state.loadingProgress += 8;
  if (state.loadingProgress >= 100) {
    clearInterval(loadingTimer);
    state.screen = 'levels';
    render();
  }
}, 150);

// ========== 触摸处理 ==========
function handleTouch(x, y) {
  console.log('触摸:', x, y, '当前页面:', state.screen);
  
  if (state.screen === 'levels') {
    // 检测关卡点击
    const cols = 5;
    const btnW = 110;
    const btnH = 70;
    const gap = 15;
    const startX = (width - (cols * btnW + (cols - 1) * gap)) / 2;
    const startY = 90;
    
    LEVELS.forEach((level, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const bx = startX + col * (btnW + gap);
      const by = startY + row * (btnH + gap + 20);
      
      if (x >= bx && x <= bx + btnW && y >= by && y <= by + btnH) {
        if (level.unlocked) {
          state.level = level.id;
          state.screen = 'game';
          state.score = 0;
          state.timeProgress = 100;
          console.log('进入关卡:', level.id);
          render();
        } else {
          console.log('关卡未解锁:', level.id);
        }
      }
    });
  }
}

// 监听触摸
tt.onTouchStart((e) => {
  const touch = e.touches[0];
  handleTouch(touch.clientX, touch.clientY);
});

// 每帧渲染
const gameLoop = () => {
  render();
  requestAnimationFrame(gameLoop);
};

gameLoop();

console.log('麻将消消乐小游戏已启动！');