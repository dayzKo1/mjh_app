/**
 * 抖音广告管理
 *
 * 注意：需要真实的广告位ID才能使用
 * 部署时替换 adUnitId 后启用对应广告
 */

// 广告是否已启用（有真实adUnitId时改为true）
const ADS_ENABLED = false;

/** 激励视频广告实例 */
let rewardedVideoAd = null;

/** 插屏广告实例 */
let interstitialAd = null;

/** Banner广告实例 */
let bannerAd = null;

/** 插屏广告是否已加载 */
let interstitialLoaded = false;

/**
 * 初始化广告
 * 在app.js onLaunch中调用
 */
async function initAds() {
  if (!ADS_ENABLED) {
    console.log('广告未启用，跳过初始化');
    return;
  }

  try {
    // 初始化激励视频广告
    rewardedVideoAd = tt.createRewardedVideoAd({
      adUnitId: 'your-rewarded-ad-unit-id',
    });

    rewardedVideoAd.onError((err) => {
      console.warn('激励视频广告错误:', err);
    });

    rewardedVideoAd.onClose((res) => {
      if (res && res.isEnded) {
        console.log('激励视频广告观看完成');
      } else {
        console.log('激励视频广告未观看完成');
      }
    });

    // 初始化插屏广告
    interstitialAd = tt.createInterstitialAd({
      adUnitId: 'your-interstitial-ad-unit-id',
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
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否获得奖励
 */
function showRewardedAd(userId) {
  if (!ADS_ENABLED || !rewardedVideoAd) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    rewardedVideoAd.show()
      .then(() => resolve(true))
      .catch(() => {
        rewardedVideoAd.load()
          .then(() => rewardedVideoAd.show())
          .then(() => resolve(true))
          .catch(() => resolve(false));
      });
  });
}

/**
 * 展示插屏广告
 * 过关后调用，用户必须看完才能继续
 * @returns {Promise<boolean>} 广告是否成功展示
 */
function showInterstitialAd() {
  if (!ADS_ENABLED || !interstitialAd) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    if (interstitialLoaded) {
      interstitialAd.show()
        .then(() => resolve(true))
        .catch(() => resolve(false));
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
 * 销毁广告
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
  destroyAds,
};
