#!/bin/bash
# 五子棋 APK 一键构建：aapt -> javac -> D8 -> 打包 -> zipalign -> apksigner
# 所有依赖路径均可用环境变量覆盖，详见 README.md
set -e

HERE=$(cd "$(dirname "$0")" && pwd)
SRC=$HERE/android
WEB=$HERE/web/gomoku.html
OUT=${OUT:-$HERE/releases/gomoku-game.apk}

SDK=${SDK:-/root/androidbuild}
DR=${DR:-$SDK/debroot}
AJAR=${AJAR:-$SDK/platform/android.jar}
R8=${R8:-$SDK/r8.jar}
JAVA_HOME=${JAVA_HOME:-$DR/usr/lib/jvm/java-21-openjdk-arm64}
APKSIGNER=${APKSIGNER:-$DR/usr/lib/android-sdk/build-tools/debian/apksigner.jar}
AAPT=$DR/usr/bin/aapt
ZIPALIGN=$DR/usr/bin/zipalign

KS=${KS:-$HERE/debug.keystore}
KS_ALIAS=${KS_ALIAS:-gomoku}
KS_PASS=${KS_PASS:-android}

BUILD=$HERE/build

missing=0
for f in "$AAPT" "$ZIPALIGN" "$AJAR" "$R8" "$APKSIGNER" \
         "$JAVA_HOME/bin/javac" "$JAVA_HOME/bin/java" "$JAVA_HOME/bin/keytool"; do
  [ -e "$f" ] || { echo "缺少依赖: $f" >&2; missing=1; }
done
command -v zip >/dev/null || { echo "缺少依赖: zip" >&2; missing=1; }
[ $missing -eq 0 ] || { echo "请用 SDK/DR/AJAR/R8/JAVA_HOME/APKSIGNER 环境变量指定路径（见 README.md）" >&2; exit 1; }

export JAVA_HOME
export PATH=$JAVA_HOME/bin:$PATH
export LD_LIBRARY_PATH=$DR/usr/lib/aarch64-linux-gnu/android:$DR/usr/lib/aarch64-linux-gnu:$DR/usr/lib:$DR/usr/lib/7zip${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}

rm -rf "$BUILD"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$BUILD/assets"
cp "$WEB" "$BUILD/assets/gomoku.html"

echo "[1/7] aapt 生成 R.java"
"$AAPT" package -f -m -J "$BUILD/gen" -M "$SRC/AndroidManifest.xml" -S "$SRC/res" -I "$AJAR"

echo "[2/7] javac 编译"
find "$SRC/src" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -nowarn -classpath "$AJAR" -d "$BUILD/classes" @"$BUILD/sources.txt"

echo "[3/7] D8 转 dex"
find "$BUILD/classes" -name '*.class' > "$BUILD/classes.txt"
java -cp "$R8" com.android.tools.r8.D8 --release --lib "$AJAR" --min-api 21 \
  --output "$BUILD/dex" @"$BUILD/classes.txt"

echo "[4/7] aapt 打包资源与清单"
"$AAPT" package -f -M "$SRC/AndroidManifest.xml" -S "$SRC/res" -A "$BUILD/assets" \
  -I "$AJAR" -F "$BUILD/app-unsigned.apk"

echo "[5/7] 注入 classes.dex + zipalign"
(cd "$BUILD/dex" && zip -9q "$BUILD/app-unsigned.apk" classes.dex)
"$ZIPALIGN" -f 4 "$BUILD/app-unsigned.apk" "$BUILD/app-aligned.apk"

echo "[6/7] apksigner 签名"
if [ ! -f "$KS" ]; then
  echo "  未找到密钥，生成调试签名: $KS"
  keytool -genkeypair -keystore "$KS" -alias "$KS_ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=Gomoku, OU=Dev, O=Gomoku, L=City, ST=State, C=CN" >/dev/null 2>&1
fi
java -jar "$APKSIGNER" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --out "$OUT" "$BUILD/app-aligned.apk"

echo "[7/7] 校验"
java -jar "$APKSIGNER" verify --print-certs "$OUT"
echo "完成: $OUT"
ls -l "$OUT"
