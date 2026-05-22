/**
 * 开屏加载页面 - 麻将消消乐主题
 * 显示加载动画，预加载资源后跳转到关卡选择
 */

Page({
  data: {
    loadingProgress: 0,
    loadingText: '正在洗牌...',
    showTip: false,
    tipIndex: 0,
  },

  // 麻将主题提示文案
  tips: [
    '点击相同的三张麻将牌即可消除',
    '暂存槽最多容纳7张牌，满了就失败',
    '道具可以帮助你更快通关',
    '通关上一关才能解锁下一关',
    '每次点击会增加倒计时时间',
    '被覆盖的牌无法点击，需要先点击上层',
  ],

  onLoad() {
    this.startLoading();
    this.showTips();
  },

  onUnload() {
    if (this._loadingTimer) clearInterval(this._loadingTimer);
    if (this._tipTimer) clearInterval(this._tipTimer);
  },

  /** 启动加载动画 - 麻将主题 */
  startLoading() {
    const loadingTexts = [
      { progress: 0, text: '正在洗牌...' },
      { progress: 20, text: '排列麻将牌...' },
      { progress: 40, text: '加载关卡数据...' },
      { progress: 60, text: '准备道具系统...' },
      { progress: 80, text: '检查游戏引擎...' },
      { progress: 95, text: '即将开局...' },
      { progress: 100, text: '加载完成!' },
    ];

    this._loadingTimer = setInterval(() => {
      let progress = this.data.loadingProgress + Math.random() * 12 + 3;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(this._loadingTimer);
        
        this.setData({
          loadingProgress: progress,
          loadingText: '加载完成!',
        });

        // 延迟跳转
        setTimeout(() => {
          tt.redirectTo({ url: '/pages/levels/levels' });
        }, 800);
      } else {
        // 根据进度更新文案
        let loadingText = loadingTexts[0].text;
        for (const item of loadingTexts) {
          if (progress >= item.progress) {
            loadingText = item.text;
          }
        }

        this.setData({
          loadingProgress: progress,
          loadingText,
        });
      }
    }, 180);
  },

  /** 显示提示轮播 */
  showTips() {
    this.setData({ showTip: true, tipIndex: 0 });
    
    this._tipTimer = setInterval(() => {
      let tipIndex = (this.data.tipIndex + 1) % this.tips.length;
      this.setData({ tipIndex });
    }, 4000);
  },
});