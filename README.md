# 像素画布 Pixel Canvas

> 开源免费的像素画工具：**自由绘制** + **图片一键转像素**，面向零基础像素游戏创作者。

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
  <img src="https://img.shields.io/badge/React-19-blue" alt="React 19" />
  <img src="https://img.shields.io/badge/纯前端-零后端-orange" alt="纯前端" />
</p>

## ✨ 核心功能

### 🎨 自由绘制
- 预设画布尺寸（16×16 / 32×32 / 64×64 / 128×128）+ 自定义（1~256）
- 铅笔 / 橡皮 / 油漆桶 / 取色器，撤销重做（Ctrl+Z / Ctrl+Shift+Z）
- 经典调色板预设（Pico-8 32 色、Game Boy 4 色、Windows 16 色）+ 自定义颜色 + 最近使用
- 滚轮缩放、空格拖拽平移、网格显示

### 🖼️ 图片转像素（核心差异化功能）
- 上传 / 拖拽图片（JPG / PNG / WebP / GIF），**全本地处理，图片不出浏览器**
- 纯算法转换：降采样（最近邻）+ 颜色量化（**中位切分法**）+ 抖动（**Floyd–Steinberg** 误差扩散）
- 参数实时预览：目标尺寸、颜色数量（2~64）、抖动开关、预设调色板
- **转换结果无缝载入画布，继续自由编辑精修** —— 这是与"只能转、不能改"的转换工具最大的区别

### 💾 导出与工程
- PNG 导出（1× / 4× / 8× / 16× 放大，保持硬边）
- 工程文件导出/导入（.json，保留像素数据继续编辑）
- 页面自动保存草稿，刷新不丢失

## 🚀 快速开始

```bash
npm install
npm run dev      # 开发模式 http://localhost:5173
npm run build    # 生产构建 → dist/
npm run preview  # 预览构建产物
```

## 🧪 核心算法测试

```bash
node scripts/test-core.mjs
```

覆盖：像素模型字节序、中位切分量化、Floyd–Steinberg 抖动、调色板约束、透明像素保留。

## 🏗️ 项目结构

```
src/
├── core/                 # 核心逻辑（无 UI 依赖，可独立测试）
│   ├── canvasModel.js    # 像素数据模型 + undo/redo
│   ├── renderer.js       # canvas 渲染 + 网格 + 缩放
│   ├── tools.js          # 铅笔/橡皮/油漆桶/取色器
│   ├── palette.js        # 预设色板（Pico-8 / Game Boy 等）
│   ├── quantize.js       # 中位切分法颜色量化
│   ├── dither.js         # Floyd–Steinberg 抖动
│   └── converter.js      # 图片 → 像素 流程编排
└── components/           # React UI 组件
    ├── Toolbar.jsx / ColorPanel.jsx / CanvasArea.jsx
    ├── NewCanvasDialog.jsx / ConvertDialog.jsx / ExportDialog.jsx
```

## 🎯 适合转换的图片

游戏角色、图标、UI 素材、场景元素效果最佳。照片类图片转换后细节较多，可调低颜色数量并使用抖动获得更复古的观感。

## 📜 License

[MIT](./LICENSE) © 2026

## 🙏 致谢

- [Pico-8 官方调色板](https://pico-8.fandom.com/wiki/Palette)
- Game Boy 经典四色调色板
- 中位切分算法与 Floyd–Steinberg 抖动：计算机图形学经典算法
