/**
 * 跨平台适配器
 * 支持：抖音小游戏、微信小游戏、H5/Web、Android APK
 */

// 检测运行环境
function detectPlatform() {
  if (typeof tt !== 'undefined') return 'douyin';
  if (typeof wx !== 'undefined') return 'wechat';
  if (typeof window !== 'undefined' && window.document) return 'web';
  return 'unknown';
}

const PLATFORM = detectPlatform();

// 获取平台 API 对象
function getNativeAPI() {
  if (PLATFORM === 'douyin') return tt;
  if (PLATFORM === 'wechat') return wx;
  return null; // Web 环境无原生 API
}

const nativeAPI = getNativeAPI();

/**
 * 统一 API 适配器
 */
const platform = {
  // 平台类型
  type: PLATFORM,
  
  // 是否是小游戏环境
  isMiniGame: PLATFORM === 'douyin' || PLATFORM === 'wechat',
  
  // ==================== 存储 ====================
  getStorage(key) {
    if (nativeAPI) {
      return nativeAPI.getStorageSync(key);
    }
    // Web 环境
    return localStorage.getItem(key);
  },
  
  setStorage(key, value) {
    if (nativeAPI) {
      nativeAPI.setStorageSync(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  },
  
  removeStorage(key) {
    if (nativeAPI) {
      nativeAPI.removeStorageSync(key);
    } else {
      localStorage.removeItem(key);
    }
  },
  
  // ==================== UI ====================
  showToast(options) {
    if (nativeAPI) {
      nativeAPI.showToast(options);
    } else {
      // Web 环境 - 简单提示
      alert(options.title);
    }
  },
  
  showModal(options) {
    if (nativeAPI) {
      nativeAPI.showModal(options);
    } else {
      // Web 环境
      const result = confirm(options.content || options.title);
      if (options.success) {
        options.success({ confirm: result, cancel: !result });
      }
    }
  },
  
  navigateTo(options) {
    if (nativeAPI) {
      nativeAPI.navigateTo(options);
    }
    // Web 无页面导航概念
  },
  
  navigateBack() {
    if (nativeAPI) {
      nativeAPI.navigateBack();
    } else {
      history.back();
    }
  },
  
  redirectTo(options) {
    if (nativeAPI) {
      nativeAPI.redirectTo(options);
    }
  },
  
  // ==================== 音频 ====================
  createInnerAudioContext() {
    if (nativeAPI) {
      return nativeAPI.createInnerAudioContext();
    }
    // Web 环境 - 使用 HTML5 Audio
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
  
  // ==================== 广告 ====================
  createRewardedVideoAd(options) {
    if (nativeAPI) {
      return nativeAPI.createRewardedVideoAd(options);
    }
    // Web 环境 - 返回模拟对象
    return {
      show() {
        console.log('[Web] 激励视频广告 - 模拟播放');
        return Promise.resolve();
      },
      load() {
        return Promise.resolve();
      },
      onClose(cb) {
        // 模拟关闭后奖励
        setTimeout(() => cb({ isEnded: true }), 100);
      },
      onError(cb) {}
    };
  },
  
  createInterstitialAd(options) {
    if (nativeAPI) {
      return nativeAPI.createInterstitialAd(options);
    }
    // Web 环境 - 返回模拟对象
    return {
      show() {
        console.log('[Web] 插屏广告 - 模拟显示');
        return Promise.resolve();
      },
      load() {
        return Promise.resolve();
      },
      onClose(cb) {},
      onError(cb) {}
    };
  },
  
  // ==================== 触摸事件 ====================
  onTouchStart(callback) {
    if (nativeAPI) {
      nativeAPI.onTouchStart(callback);
    } else {
      // Web 环境
      document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        callback({ touches: [{ clientX: touch.clientX, clientY: touch.clientY }] });
      });
      // 同时支持鼠标点击（测试用）
      document.addEventListener('mousedown', (e) => {
        callback({ touches: [{ clientX: e.clientX, clientY: e.clientY }] });
      });
    }
  },
  
  onTouchEnd(callback) {
    if (nativeAPI) {
      nativeAPI.onTouchEnd(callback);
    } else {
      document.addEventListener('touchend', callback);
      document.addEventListener('mouseup', callback);
    }
  },
  
  // ==================== Canvas ====================
  createCanvas() {
    if (nativeAPI) {
      return nativeAPI.createCanvas();
    }
    // Web 环境 - 使用 DOM Canvas
    const canvas = document.createElement('canvas');
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    document.body.appendChild(canvas);
    
    // 设置实际尺寸
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 监听尺寸变化
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
    
    return canvas;
  },
  
  getContext(canvas, type) {
    return canvas.getContext(type || '2d');
  },
  
  // ==================== 云开发 ====================
  createCloud(options) {
    if (PLATFORM === 'douyin' && nativeAPI.createCloud) {
      return nativeAPI.createCloud(options);
    }
    if (PLATFORM === 'wechat' && nativeAPI.cloud) {
      // 微信云开发初始化方式略有不同
      nativeAPI.cloud.init(options);
      return nativeAPI.cloud;
    }
    // Web 环境 - 返回模拟对象或使用 HTTP API
    console.warn('[Web] 云开发功能需要在 Web 端使用 HTTP API 或 BaaS 服务');
    return null;
  },
  
  // ==================== 系统信息 ====================
  getSystemInfo() {
    if (nativeAPI) {
      return nativeAPI.getSystemInfoSync();
    }
    // Web 环境
    return {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      pixelRatio: window.devicePixelRatio || 1,
      platform: navigator.userAgent
    };
  },
  
  // ==================== 登录 ====================
  login() {
    if (nativeAPI) {
      return nativeAPI.login();
    }
    // Web 环境 - 返回模拟用户
    return Promise.resolve({
      code: 'web_mock_code',
      errMsg: 'login:ok'
    });
  },
  
  getUserInfo() {
    if (nativeAPI) {
      return nativeAPI.getUserInfo();
    }
    // Web 环境
    return Promise.resolve({
      userInfo: {
        nickName: 'Web User',
        avatarUrl: ''
      }
    });
  },
  
  // ==================== 场景/导航 ====================
  checkScene(options) {
    if (PLATFORM === 'douyin' && nativeAPI.checkScene) {
      return nativeAPI.checkScene(options);
    }
    // 其他平台不支持
    console.warn('[Platform] checkScene 仅支持抖音');
    return Promise.reject('not_supported');
  },
  
  navigateToScene(options) {
    if (PLATFORM === 'douyin' && nativeAPI.navigateToScene) {
      return nativeAPI.navigateToScene(options);
    }
    console.warn('[Platform] navigateToScene 仅支持抖音');
    return Promise.reject('not_supported');
  },
  
  openCustomerServiceChat(options) {
    if (PLATFORM === 'douyin' && nativeAPI.openCustomerServiceChat) {
      return nativeAPI.openCustomerServiceChat(options);
    }
    if (PLATFORM === 'wechat' && nativeAPI.openCustomerServiceChat) {
      return nativeAPI.openCustomerServiceChat(options);
    }
    console.warn('[Platform] openCustomerServiceChat 仅支持小游戏');
    return Promise.reject('not_supported');
  },
  
  // ==================== 生命周期 ====================
  getLaunchOptionsSync() {
    if (nativeAPI && nativeAPI.getLaunchOptionsSync) {
      return nativeAPI.getLaunchOptionsSync();
    }
    return {};
  },
  
  // ==================== 图片 ====================
  getImageInfo(options) {
    if (nativeAPI) {
      return nativeAPI.getImageInfo(options);
    }
    // Web 环境
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height, path: options.src });
      img.onerror = reject;
      img.src = options.src;
    });
  },
  
  // ==================== 其他 ====================
  request(options) {
    if (nativeAPI) {
      return nativeAPI.request(options);
    }
    // Web 环境 - 使用 fetch
    return fetch(options.url, {
      method: options.method || 'GET',
      headers: options.header || {},
      body: options.data ? JSON.stringify(options.data) : null
    }).then(res => res.json()).then(data => {
      if (options.success) options.success({ data, statusCode: 200 });
    }).catch(err => {
      if (options.fail) options.fail(err);
    });
  }
};

module.exports = platform;