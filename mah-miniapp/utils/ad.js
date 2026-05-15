/**
 * 抖音广告管理
 * 
 * 注意：需要真实的广告位ID才能使用
 * 部署时替换 adUnitId 后启用对应广告
 */

// 广告是否已启用（有真实adUnitId时改为true）
const ADS_ENABLED = false;

/**
 * 初始化广告
 */
async function initAds() {
  if (!ADS_ENABLED) {
    console.log('广告未启用，跳过初始化');
    return;
  }
}

/**
 * 展示激励视频广告
 * @param {string} userId - 用户ID
 * @returns {Promise<boolean>} 是否获得奖励
 */
function showRewardedAd(userId) {
  return Promise.resolve(false);
}

/**
 * 展示Banner广告
 */
function showBannerAd() {}

/**
 * 隐藏Banner广告
 */
function hideBannerAd() {}

/**
 * 展示插屏广告
 * @param {string} userId - 用户ID
 */
async function showInterstitialAd(userId) {}

/**
 * 销毁广告
 */
function destroyAds() {}

module.exports = {
  initAds,
  showRewardedAd,
  showBannerAd,
  hideBannerAd,
  showInterstitialAd,
  destroyAds,
};
