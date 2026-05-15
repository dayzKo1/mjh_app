#!/bin/bash

# 签名现有的APK文件

set -e

echo "🔐 签名APK文件..."
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
INPUT_APK="/Users/linhonghao/Documents/trae_projects/mjh_app/mah-signed.apk"

# 步骤 1: 检查文件
echo -e "${YELLOW}📦 步骤 1/3: 检查文件${NC}"
if [ ! -f "$KEYSTORE_FILE" ]; then
    echo -e "${RED}❌ 签名密钥文件不存在${NC}"
    exit 1
fi
if [ ! -f "$INPUT_APK" ]; then
    echo -e "${RED}❌ APK文件不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 所有文件检查通过${NC}"
echo ""

# 步骤 2: 签名APK (使用SHA256)
echo -e "${YELLOW}📱 步骤 2/3: 签名APK (SHA256)${NC}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SIGNED_APK="/Users/linhonghao/Documents/trae_projects/mjh_app/mah-signed-temp-${TIMESTAMP}.apk"

# 复制APK
cp "$INPUT_APK" "$SIGNED_APK"

# 使用jarsigner签名 (SHA256withRSA)
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$KEYSTORE_FILE" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  "$SIGNED_APK" "$KEY_ALIAS"

echo -e "${GREEN}✅ APK签名完成${NC}"
echo ""

# 步骤 3: 对齐APK
echo -e "${YELLOW}📦 步骤 3/3: 对齐APK${NC}"
ALIGNED_APK="/Users/linhonghao/Documents/trae_projects/mjh_app/mah-final-${TIMESTAMP}.apk"

# 使用zipalign对齐
/Users/linhonghao/Android/sdk/build-tools/35.0.0/zipalign -v 4 "$SIGNED_APK" "$ALIGNED_APK"

FILE_SIZE=$(ls -lh "$ALIGNED_APK" | awk '{print $5}')

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 签名APK构建成功!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📱 APK文件: ${GREEN}$(basename "$ALIGNED_APK")${NC}"
echo -e "📊 文件大小: ${GREEN}$FILE_SIZE${NC}"
echo -e "📍 文件位置: ${GREEN}$ALIGNED_APK${NC}"
echo -e "🔐 签名算法: ${GREEN}SHA256withRSA${NC}"
echo ""

# 清理临时文件
rm -f "$SIGNED_APK"

# 验证签名
echo -e "${YELLOW}验证签名...${NC}"
jarsigner -verify -verbose "$ALIGNED_APK" | grep -A 5 "jar 已验证"

open -R "$ALIGNED_APK"

echo -e "${BLUE}签名完成!${NC}"
