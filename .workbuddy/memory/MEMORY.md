# 项目长期记忆 — pixel-canvas（像素画布）

## 项目约定
- **git 提交约定（2026-08-14，用户指定）**：每次改动完成后直接 git add + commit，无需询问。提交信息用中文、简洁描述改动。
- git 身份：仓库级占位（Administrator / admin@localhost），仅本人维护。

## 项目要点
- React 19 + Vite 6 + gifenc，纯前端零后端像素画工具（自由绘制 + 图片转像素）。
- 核心模块：core/（canvasModel/renderer/tools/palette/quantize/dither/converter/gifExporter）+ components/。
- 特性：多帧动画 + 洋葱皮、对称绘制、去色块、GIF/PNG 导出、工程导入导出、自动草稿保存（localStorage 超 3.5MB 降级单帧）、深浅主题、原图对照。
- 已初始化 git（main 分支），首次提交 808a6fc（28 文件）。

## 待办 / 已知问题
- README「项目结构」一节未更新：缺 gifExporter.js / AnimationPanel.jsx / ReferencePanel.jsx。
