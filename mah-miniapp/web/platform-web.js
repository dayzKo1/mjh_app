/**
 * Web 游戏入口
 * 将 Canvas 游戏代码包装为 Web 可运行版本
 */

// 模拟小游戏 require
function createRequire(modules) {
  return function(modulePath) {
    // 处理相对路径
    let resolvedPath = modulePath;
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      resolvedPath = modulePath.replace(/^\.\.\/utils\//, '').replace(/^\.\//, '');
    }
    
    if (modules[resolvedPath]) {
      return modules[resolvedPath];
    }
    
    // 默认返回空对象
    console.warn('Module not found:', modulePath);
    return {};
  };
}

// 平台适配器 - Web 版本
const platform = {
  type: 'web',
  isMiniGame: false,
  
  // 存储
  getStorage(key) {
    const value = localStorage.getItem(key);
    return value;
  },
  
  setStorage(key, value) {
    localStorage.setItem(key, String(value));
  },
  
  removeStorage(key) {
    localStorage.removeItem(key);
  },
  
  // UI
  showToast(options) {
    alert(options.title);
  },
  
  showModal(options) {
    const result = confirm(options.content || options.title);
    if (options.success) {
      options.success({ confirm: result, cancel: !result });
    }
  },
  
  // 音频
  createInnerAudioContext() {
    return {
      src: '',
      _audio: null,
      volume: 1,
      loop: false,
      play() {
        if (!this._audio) {
          this._audio = new Audio(this.src);
          this._audio.volume = this.volume;
          this._audio.loop = this.loop;
        }
        this._audio.play();
      },
      pause() {
        if (this._audio) this._audio.pause();
      },
      stop() {
        if (this._audio) {
          this._audio.pause();
          this._audio.currentTime = 0;
        }
      },
      destroy() {
        this._audio = null;
      },
      onPlay(cb) { if (this._audio) this._audio.onplay = cb; },
      onPause(cb) { if (this._audio) this._audio.onpause = cb; },
      onStop(cb) { if (this._audio) this._audio.onended = cb; },
      onError(cb) { if (this._audio) this._audio.onerror = cb; }
    };
  },
  
  // 广告 - Web 模拟
  createRewardedVideoAd(options) {
    return {
      show() {
        return Promise.resolve();
      },
      load() {
        return Promise.resolve();
      },
      onClose(cb) {
        setTimeout(() => cb({ isEnded: true }), 100);
      },
      onError(cb) {}
    };
  },
  
  createInterstitialAd(options) {
    return {
      show() {
        return Promise.resolve();
      },
      load() {
        return Promise.resolve();
      },
      onClose(cb) {},
      onError(cb) {}
    };
  },
  
  // 触摸事件
  onTouchStart(callback) {
    document.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      callback({ touches: [{ clientX: touch.clientX, clientY: touch.clientY }] });
    });
    document.addEventListener('mousedown', (e) => {
      callback({ touches: [{ clientX: e.clientX, clientY: e.clientY }] });
    });
  },
  
  onTouchEnd(callback) {
    document.addEventListener('touchend', callback);
    document.addEventListener('mouseup', callback);
  },
  
  // Canvas
  createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    document.body.appendChild(canvas);
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
    
    return canvas;
  },
  
  getContext(canvas, type) {
    return canvas.getContext(type || '2d');
  },
  
  // 系统
  getSystemInfo() {
    return {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      platform: navigator.userAgent
    };
  },
  
  // 云开发 - Web 使用 HTTP API
  createCloud(options) {
    console.warn('[Web] 云开发需要在 Web 端使用 HTTP API');
    return null;
  }
};

// 导出模块
window.__modules = {
  'utils/platform': platform,
  '../utils/platform': platform,
  './utils/platform': platform
};

window.require = createRequire(window.__modules);

// 启动游戏
window.startGame = function() {
  console.log('麻将消消乐启动...');
};