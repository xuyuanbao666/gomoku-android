# 五子棋 Gomoku · Android APK

HTML5 五子棋游戏本体 + WebView 壳工程，一条命令产出已签名 APK。

## 功能

- 15×15 棋盘，五子连珠胜负判定（横/竖/斜），胜负高亮与弹窗
- 人机对战三档难度（简单 / 普通 / 困难），或同屏双人对战
- 悔棋、重新开始、比分自动累计（换模式时清零）
- 音效 + 震动反馈，落子悬停提示
- 沉浸式全屏，横竖屏自适应：
  - 竖屏：标题/比分 → 棋盘 → 按钮
  - 横屏（≥600px，适合平板）：左侧信息栏 → 棋盘 → 右侧按钮栏
- 启动图标由 `tools/make_icon.py`（纯 Python 标准库）生成

## 直接安装

下载 [`releases/gomoku-game.apk`](releases/gomoku-game.apk) 到 Android 设备安装即可
（debug 签名，需允许"安装未知应用"）。相同签名可覆盖更新。

## 从源码构建

```bash
./build.sh
```

构建链路：`aapt 资源/R.java → javac → D8 → aapt 打包 → zipalign → apksigner 签名`。

依赖及环境变量（默认取 `SDK` 下的目录，按需覆盖）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `SDK` | 工具根目录 | `/root/androidbuild` |
| `DR` | Debian sysroot（aapt / zipalign / JDK / apksigner） | `$SDK/debroot` |
| `AJAR` | `android.jar` | `$SDK/platform/android.jar` |
| `R8` | R8/D8 工具 jar | `$SDK/r8.jar` |
| `JAVA_HOME` | JDK 9+ | `$DR/usr/lib/jvm/java-21-openjdk-arm64` |
| `APKSIGNER` | apksigner.jar | `$DR/usr/lib/android-sdk/build-tools/debian/apksigner.jar` |
| `OUT` | 输出 APK 路径 | `releases/gomoku-game.apk` |

说明：

- `android.jar` 用 `sdkmanager "platforms;android-34"` 或任意 SDK 安装获得；R8 见 [r8 release](https://github.com/Google/r8)。
- 签名密钥 `debug.keystore` 不存在时自动用 `keytool` 生成（已 gitignore，**不要提交**）。
- 需要系统有 `zip` 命令。

重新生成启动图标：

```bash
python3 tools/make_icon.py
```

## 回归测试

```bash
node tests/test_gomoku.js
```

覆盖：五连判定、悔棋与比分回滚、AI 必堵四连/抢先手、整局压力测试、三档难度强度对比。

## 目录结构

```
├── build.sh                # 一键构建脚本
├── web/gomoku.html         # 游戏本体（规则、AI、UI）
├── android/                # Android 工程
│   ├── AndroidManifest.xml
│   ├── src/com/gomoku/game/MainActivity.java
│   └── res/                # strings、启动图标
├── tests/test_gomoku.js    # 无头回归测试（Node）
├── tools/make_icon.py      # 图标生成（纯标准库）
└── releases/gomoku-game.apk# 已签名成品
```

## AI 实现简述

一层局面评估 `cellScore = 我方价值 + 防守权重 × 对方价值`，在候选点中取最优；普通档防守权重 1.0，困难档 1.15（更积极堵对方活四/冲四），简单档带随机扰动（8% 随机落子、55% 从次优池中选择）。经 120 局陪练基准测试，三档难度得分约为 29 / 103 / 108。
