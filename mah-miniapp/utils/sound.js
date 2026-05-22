/**
 * 音效管理工具
 * 跨平台支持：抖音小游戏、微信小游戏、H5/Web、Android APK
 */

const platform = require('./platform');

/** 音效配置 */
const SOUND_CONFIG = {
  // 点击音效
  click: { src: 'audio/click.mp3', volume: 0.5 },
  // 拾取卡片
  pickup: { src: 'audio/pickup.mp3', volume: 0.6 },
  // 消除成功
  match: { src: 'audio/match.mp3', volume: 0.8 },
  // 放入暂存槽
  slot: { src: 'audio/slot.mp3', volume: 0.5 },
  // 道具使用
  item: { src: 'audio/item.mp3', volume: 0.7 },
  // 炸弹爆炸
  bomb: { src: 'audio/bomb.mp3', volume: 0.9 },
  // 过关成功
  win: { src: 'audio/win.mp3', volume: 1.0 },
  // 游戏失败
  lose: { src: 'audio/lose.mp3', volume: 0.8 },
  // 倒计时警告
  warning: { src: 'audio/warning.mp3', volume: 0.6 },
  // 按钮点击
  button: { src: 'audio/button.mp3', volume: 0.4 },
  // 弹窗打开
  modal: { src: 'audio/modal.mp3', volume: 0.3 },
  // 弹窗关闭
  closeModal: { src: 'audio/close-modal.mp3', volume: 0.2 },
  // 获得奖励
  reward: { src: 'audio/reward.mp3', volume: 0.8 },
  // 关卡解锁
  unlock: { src: 'audio/unlock.mp3', volume: 0.7 },
};

/** 音效实例缓存 */
const soundCache = {};

/** 音效是否启用 */
let soundEnabled = true;

/**
 * 初始化音效系统
 * 在 app.js onLaunch 中调用
 */
function initSound() {
  // 从本地存储读取音效开关状态
  try {
    const enabled = platform.getStorage('soundEnabled');
    if (enabled !== null && enabled !== '') {
      soundEnabled = enabled === true || enabled === 'true';
    }
  } catch (e) {
    console.warn('读取音效开关状态失败:', e);
  }

  console.log('音效系统初始化完成，状态:', soundEnabled);
}

/**
 * 获取或创建音效实例
 * @param {string} name - 音效名称
 * @returns {Object|null} 音效实例
 */
function getSoundInstance(name) {
  if (!soundEnabled) return null;

  const config = SOUND_CONFIG[name];
  if (!config) {
    console.warn('未找到音效配置:', name);
    return null;
  }

  // 使用缓存
  if (soundCache[name]) {
    return soundCache[name];
  }

  try {
    const audio = platform.createInnerAudioContext();
    audio.src = config.src;
    audio.volume = config.volume;

    audio.onError((err) => {
      console.warn('音效播放错误:', name, err);
    });

    soundCache[name] = audio;
    return audio;
  } catch (e) {
    console.warn('创建音效实例失败:', name, e);
    return null;
  }
}

/**
 * 播放音效
 * @param {string} name - 音效名称
 */
function playSound(name) {
  const audio = getSoundInstance(name);
  if (!audio) return;

  try {
    // 重置播放位置并播放
    audio.stop();
    audio.seek(0);
    audio.play();
  } catch (e) {
    console.warn('播放音效失败:', name, e);
  }
}

/**
 * 设置音效开关
 * @param {boolean} enabled - 是否启用音效
 */
function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    platform.setStorage('soundEnabled', enabled);
  } catch (e) {
    console.warn('保存音效开关状态失败:', e);
  }
}

/**
 * 获取音效开关状态
 * @returns {boolean} 音效是否启用
 */
function isSoundEnabled() {
  return soundEnabled;
}

/**
 * 预加载所有音效
 * 在游戏开始前调用
 */
function preloadSounds() {
  Object.keys(SOUND_CONFIG).forEach(name => {
    getSoundInstance(name);
  });
  console.log('音效预加载完成');
}

/**
 * 销毁所有音效实例
 * 在游戏结束或页面卸载时调用
 */
function destroySounds() {
  Object.keys(soundCache).forEach(name => {
    try {
      soundCache[name].destroy();
    } catch (e) {
      // ignore
    }
  });
  soundCache = {};
}

module.exports = {
  initSound,
  playSound,
  setSoundEnabled,
  isSoundEnabled,
  preloadSounds,
  destroySounds,
};