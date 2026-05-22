/**
 * 跨平台广告管理
 *
 * 支持：抖音小游戏、微信小游戏、H5/Web（模拟）
 *
 * 使用说明：
 * 1. 在开发者后台创建广告位，获取真实的 adUnitId
 * 2. 将 ADS_ENABLED 改为 true
 * 3. 替换下方 xxx 为真实广告位ID
 */

const platform = require('./platform');

// 广告是否已启用（有真实adUnitId时改为true）
const ADS_ENABLED = false;

/** 广告位配置 - 需替换为真实ID */
const AD_UNIT_IDS = {
  // 激励视频广告 - 用于领取奖励
  rewarded: 'xxx-rewarded-video-ad',
  // 插屏广告 - 用于过关后展示
  interstitial: 'xxx-interstitial-ad',
  // Banner广告 - 用于游戏底部展示（可选）
  banner: 'xxx-banner-ad',
};

/** 激励视频广告实例 */
let rewardedVideoAd = null;

/** 插屏广告实例 */
let interstitialAd = null;

/** Banner广告实例 */
let bannerAd = null;

/** 插屏广告是否已加载 */
let interstitialLoaded = false;

/** 激励视频广告回调 */
let rewardedCallback = null;

/**
 * 初始化广告
 * 在app.js onLaunch中调用
 */
async function initAds() {
  if (!ADS_ENABLED) {
    console.log('广告未启用，跳过初始化');
    return;
  }

  console.log('开始初始化广告...');

  try {
    // 初始化激励视频广告
    rewardedVideoAd = platform.createRewardedVideoAd({
      adUnitId: AD_UNIT_IDS.rewarded,
    });

    rewardedVideoAd.onLoad(() => {
      console.log('激励视频广告加载成功');
    });

    rewardedVideoAd.onError((err) => {
      console.warn('激励视频广告错误:', err);
    });

    rewardedVideoAd.onClose((res) => {
      if (res && res.isEnded) {
        console.log('激励视频广告观看完成');
        if (rewardedCallback) {
          rewardedCallback(true);
          rewardedCallback = null;
        }
      } else {
        console.log('激励视频广告未观看完成');
        if (rewardedCallback) {
          rewardedCallback(false);
          rewardedCallback = null;
        }
      }
      // 预加载下一次广告
      rewardedVideoAd.load().catch(() => {});
    });

    // 初始化插屏广告
    interstitialAd = platform.createInterstitialAd({
      adUnitId: AD_UNIT_IDS.interstitial,
    });

    interstitialAd.onLoad(() => {
      interstitialLoaded = true;
      console.log('插屏广告加载成功');
    });

    interstitialAd.onError((err) => {
      interstitialLoaded = false;
      console.warn('插屏广告错误:', err);
    });

    interstitialAd.onClose(() => {
      interstitialLoaded = false;
      console.log('插屏广告关闭');
      // 预加载下一次插屏广告
      if (interstitialAd) {
        interstitialAd.load().catch(() => {});
      }
    });

    // 预加载插屏广告
    interstitialAd.load().catch(() => {});

    console.log('广告初始化完成');
  } catch (error) {
    console.warn('广告初始化失败:', error.message);
  }
}

/**
 * 展示激励视频广告
 * @param {function} callback - 观看完成回调 (isCompleted: boolean)
 * @returns {Promise<boolean>} 广告是否成功展示
 */
function showRewardedAd(callback) {
  if (!ADS_ENABLED || !rewardedVideoAd) {
    // 广告未启用，直接返回成功
    if (callback) callback(true);
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    rewardedCallback = (isCompleted) => {
      callback && callback(isCompleted);
      resolve(isCompleted);
    };

    rewardedVideoAd.show()
      .then(() => {
        console.log('激励视频广告展示成功');
      })
      .catch((err) => {
        console.warn('激励视频广告展示失败，尝试重新加载:', err);
        rewardedVideoAd.load()
          .then(() => rewardedVideoAd.show())
          .catch(() => {
            rewardedCallback && rewardedCallback(false);
            rewardedCallback = null;
            resolve(false);
          });
      });
  });
}

/**
 * 展示插屏广告
 * 过关后调用
 * @returns {Promise<boolean>} 广告是否成功展示
 */
function showInterstitialAd() {
  if (!ADS_ENABLED || !interstitialAd) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    if (interstitialLoaded) {
      interstitialAd.show()
        .then(() => {
          console.log('插屏广告展示成功');
          resolve(true);
        })
        .catch((err) => {
          console.warn('插屏广告展示失败:', err);
          resolve(false);
        });
    } else {
      interstitialAd.load()
        .then(() => interstitialAd.show())
        .then(() => resolve(true))
        .catch(() => resolve(false));
    }
  });
}

/**
 * 展示Banner广告
 */
function showBannerAd() {
  if (!ADS_ENABLED || !bannerAd) return;

  try {
    bannerAd.show().catch(() => {});
  } catch (e) {
    // ignore
  }
}

/**
 * 隐藏Banner广告
 */
function hideBannerAd() {
  if (!ADS_ENABLED || !bannerAd) return;

  try {
    bannerAd.hide().catch(() => {});
  } catch (e) {
    // ignore
  }
}

/**
 * 预加载插屏广告
 * 在游戏开始时调用，确保过关时广告已就绪
 */
function preloadInterstitialAd() {
  if (!ADS_ENABLED || !interstitialAd) return;

  try {
    interstitialAd.load().catch(() => {});
  } catch (e) {
    // ignore
  }
}

/**
 * 检查广告是否可用
 * @returns {boolean} 广告是否已启用且可用
 */
function isAdAvailable() {
  return ADS_ENABLED;
}

/**
 * 销毁广告实例
 */
function destroyAds() {
  if (rewardedVideoAd) {
    rewardedVideoAd.destroy();
    rewardedVideoAd = null;
  }
  if (interstitialAd) {
    interstitialAd.destroy();
    interstitialAd = null;
    interstitialLoaded = false;
  }
  if (bannerAd) {
    bannerAd.destroy();
    bannerAd = null;
  }
}

module.exports = {
  initAds,
  showRewardedAd,
  showBannerAd,
  hideBannerAd,
  showInterstitialAd,
  preloadInterstitialAd,
  isAdAvailable,
  destroyAds,
  ADS_ENABLED,
};