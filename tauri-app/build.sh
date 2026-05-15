#!/bin/bash

# 中国龙2 - APK构建和签名脚本
# 使用新的keystore配置

set -e

echo "🚀 开始构建中国龙2签名版本APK..."
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 签名配置
KEYSTORE_FILE="/Users/linhonghao/Documents/trae_projects/mjh_app/mah-release-2026.keystore"
KEYSTORE_PASSWORD="mah123456"
KEY_ALIAS="mah"
KEY_PASSWORD="mah123456"

# 步骤 1: 检查keystore
echo -e "${YELLOW}📦 步骤 1/5: 检查签名密钥${NC}"
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo -e "${RED}❌ 签名密钥文件不存在: $KEYSTORE_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 签名密钥文件存在${NC}"
echo ""

# 步骤 2: 清理旧文件
echo -e "${YELLOW}📦 步骤 2/5: 清理旧文件${NC}"
cd /Users/linhonghao/Documents/trae_projects/mjh_app
rm -f china-dragon-2-*.apk 2>/dev/null || true
echo -e "${GREEN}✅ 清理完成${NC}"
echo ""

# 步骤 3: 构建前端
echo -e "${YELLOW}🔨 步骤 3/5: 构建前端应用${NC}"
cd mah
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    yarn install
fi
yarn build
echo -e "${GREEN}✅ 前端构建完成${NC}"
echo ""

# 步骤 4: 构建Android apk
echo -e "${YELLOW}📱 步骤 4/5: 构建Android APK${NC}"
cd src-tauri/gen/android
export ANDROID_HOME=/Users/linhonghao/Android/sdk
export NDK_HOME=/Users/linhonghao/Android/sdk/ndk/26.1.10909125

# 构建release版本
./gradlew assembleRelease --quiet

cd ../../..
echo -e "${GREEN}✅ Android APK构建完成${NC}"
echo ""

# 步骤 5: 签名APK
echo -e "${YELLOW}🔐 步骤 5/5: 签名APK${NC}"

UNSIGNED_APK="mah/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SIGNED_APK="china-dragon-2-signed-${TIMESTAMP}.apk"
ALIGNED_APK="china-dragon-2-${TIMESTAMP}.apk"

# 签名
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$KEYSTORE_FILE" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  "$UNSIGNED_APK" "$KEY_ALIAS"

# 对齐
/Users/linhonghao/Android/sdk/build-tools/35.0.0/zipalign -v 4 "$UNSIGNED_APK" "$ALIGNED_APK"

FILE_SIZE=$(ls -lh "$ALIGNED_APK" | awk '{print $5}')

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 签名APK构建成功!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📱 APK文件: ${GREEN}$ALIGNED_APK${NC}"
echo -e "📊 文件大小: ${GREEN}$FILE_SIZE${NC}"
echo -e "📍 文件位置: ${GREEN}$(pwd)/$ALIGNED_APK${NC}"
echo -e "🔐 签名算法: ${GREEN}SHA256withRSA${NC}"
echo ""

# 验证签名
echo -e "${YELLOW}验证签名...${NC}"
jarsigner -verify -verbose "$ALIGNED_APK" | grep "jar 已验证" || echo "签名验证失败"

open -R "$ALIGNED_APK"

echo -e "${BLUE}构建完成!${NC}"
