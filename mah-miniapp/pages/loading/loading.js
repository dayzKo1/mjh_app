/**
 * 开屏加载页面
 * 显示加载动画，预加载资源后跳转到关卡选择
 */

Page({
  data: {
    loadingProgress: 0,
    loadingText: '正在加载游戏资源...',
    showTip: false,
    tipIndex: 0,
  },

  tips: [
    '点击消除相同的三张麻将牌',
    '暂存槽最多容纳7张牌',
    '道具可以帮助你更快通关',
    '通关上一关解锁下一关',
    '每次操作会增加倒计时时间',
  ],

  onLoad() {
    this.startLoading();
    this.showTips();
  },

  onUnload() {
    if (this._loadingTimer) clearInterval(this._loadingTimer);
    if (this._tipTimer) clearInterval(this._tipTimer);
  },

  /** 启动加载动画 */
  startLoading() {
    this._loadingTimer = setInterval(() => {
      let progress = this.data.loadingProgress + Math.random() * 15 + 5;
      
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
        }, 500);
      } else {
        // 更新加载文案
        let loadingText = '正在加载游戏资源...';
        if (progress > 30) loadingText = '准备麻将牌...';
        if (progress > 60) loadingText = '初始化游戏引擎...';
        if (progress > 85) loadingText = '即将进入...';

        this.setData({
          loadingProgress: progress,
          loadingText,
        });
      }
    }, 200);
  },

  /** 显示提示轮播 */
  showTips() {
    this.setData({ showTip: true, tipIndex: 0 });
    
    this._tipTimer = setInterval(() => {
      let tipIndex = (this.data.tipIndex + 1) % this.tips.length;
      this.setData({ tipIndex });
    }, 3000);
  },
});