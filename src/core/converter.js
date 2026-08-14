// 图片 → 像素 流程编排：降采样 → 颜色量化（中位切分）→ 抖动（Floyd–Steinberg）
import { medianCut, colorDist } from './quantize.js'
import { floydSteinberg, nearestColor } from './dither.js'

// 描边优化：近黑判定阈值（单通道最大值 ≤ 该值视为描边/线稿黑）
export const INK_THRESHOLD = 24

export function isInkPixel(r, g, b) {
  return r <= INK_THRESHOLD && g <= INK_THRESHOLD && b <= INK_THRESHOLD
}

/**
 * 合并相近颜色：把色差 ≤ 阈值的颜色归并为一种（消除 JPEG 压缩/抗锯齿产生的"伪白色"等重复色）
 * 按亮度排序后贪心合并，每组保留**亮度最高**的颜色为代表色（如最纯的白）；
 * 只在自动量化色板上使用。
 * @param {Array<{r,g,b}>} palette
 * @param {number} threshold 色差阈值（欧氏距离，默认 24：近白噪声 ~5，白 vs 浅灰 ~35 不误并）
 * @returns {Array<{r,g,b}>}
 */
export function mergeSimilarColors(palette, threshold = 24) {
  if (!palette || palette.length <= 1) return palette
  const lum = (c) => c.r + c.g + c.b
  const sorted = [...palette].sort((a, b) => lum(a) - lum(b))
  const result = []
  for (const c of sorted) {
    let mergedIdx = -1
    for (let i = 0; i < result.length; i++) {
      if (colorDist(c, result[i]) <= threshold) {
        mergedIdx = i
        break
      }
    }
    if (mergedIdx === -1) {
      result.push(c)
    } else if (lum(c) > lum(result[mergedIdx])) {
      result[mergedIdx] = c // 用更亮的颜色作代表（如最纯白）
    }
  }
  return result
}

/**
 * 确保调色板包含纯黑（用于描边优化）：若 palette 无近黑色，把与纯黑最接近的颜色替换为纯黑
 * @param {Array<{r,g,b}>} palette
 * @returns {boolean} 是否注入了纯黑
 */
export function ensureBlackInPalette(palette) {
  if (!palette || !palette.length) return false
  const hasBlack = palette.some((p) => p.r <= 4 && p.g <= 4 && p.b <= 4)
  if (hasBlack) return false
  let idx = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const d = palette[i].r * palette[i].r + palette[i].g * palette[i].g + palette[i].b * palette[i].b
    if (d < bestDist) {
      bestDist = d
      idx = i
    }
  }
  palette[idx] = { r: 0, g: 0, b: 0 }
  return true
}

/**
 * 描边优化输出阶段：把原图中"近黑像素"的输出强制拉回纯黑（保留 alpha）
 * 避免抖动误差扩散把黑色描边污染成彩色杂色
 * @param {Uint8ClampedArray} out RGBA 输出缓冲（将被就地修改）
 * @param {Uint8ClampedArray} src RGBA 原始输入（降采样后，未抖动）
 * @param {number} n 像素数
 */
export function applyInkPreserve(out, src, n) {
  for (let i = 0; i < n; i++) {
    const o = i * 4
    if (src[o + 3] === 0) continue
    if (isInkPixel(src[o], src[o + 1], src[o + 2])) {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 0
    }
  }
}

/**
 * 加载本地图片文件为 HTMLImageElement
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败，请检查文件格式'))
    }
    img.src = url
  })
}

/**
 * 降采样：把图片以 cover 方式绘制到 w×h（最近邻插值，保持硬边）
 * @returns {ImageData} {data: Uint8ClampedArray(RGBA), width, height}
 */
export function downsample(img, w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  const ir = img.width / img.height
  const tr = w / h
  let sx = 0
  let sy = 0
  let sw = img.width
  let sh = img.height
  if (ir > tr) {
    sw = img.height * tr
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / tr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/**
 * 完整转换流程：图片 → 像素数据（Uint32Array 模型格式，可直接 loadPixels 到画布）
 * @param {HTMLImageElement} img
 * @param {object} opts
 * @param {number} opts.width 目标像素宽
 * @param {number} opts.height 目标像素高
 * @param {number} opts.numColors 颜色数（仅 palette 为空时生效）
 * @param {boolean} opts.dither 是否抖动
 * @param {boolean} opts.inkPreserve 描边优化：保持纯黑线条，减少杂色
 * @param {boolean} opts.mergeColors 合并相近颜色：消除伪白色等重复色
 * @param {Array<{r,g,b}>|null} opts.presetPalette 预设色板（null 则自动量化生成）
 * @returns {{pixels: Uint32Array, palette: Array<{r,g,b}>, width: number, height: number}}
 */
export function convertToPixelArt(
  img,
  { width, height, numColors, dither, inkPreserve, mergeColors, presetPalette }
) {
  const { data, width: w, height: h } = downsample(img, width, height)
  const n = w * h

  // 检测原图是否含近黑像素（描边优化依据）
  let hasInk = false
  if (inkPreserve) {
    for (let i = 0; i < n; i++) {
      const o = i * 4
      if (data[o + 3] > 0 && isInkPixel(data[o], data[o + 1], data[o + 2])) {
        hasInk = true
        break
      }
    }
  }

  // 收集不透明像素用于量化
  let palette = null
  if (presetPalette && presetPalette.length) {
    palette = presetPalette
  } else {
    const opaque = []
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] > 0) {
        opaque.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]])
      }
    }
    palette = medianCut(opaque, numColors)
    if (!palette.length) palette = [{ r: 0, g: 0, b: 0 }]
  }

  // 描边优化：确保调色板含纯黑（自动量化色板时）
  if (inkPreserve && hasInk && !(presetPalette && presetPalette.length)) {
    ensureBlackInPalette(palette)
  }

  // 合并相近颜色（消除伪白色等重复色；仅自动量化色板时）
  if (mergeColors && !(presetPalette && presetPalette.length)) {
    palette = mergeSimilarColors(palette)
  }

  // 映射（可带抖动）
  let out
  if (dither) {
    out = floydSteinberg(data, palette, w, h)
  } else {
    out = new Uint8ClampedArray(data)
    for (let i = 0; i < n; i++) {
      const o = i * 4
      if (data[o + 3] === 0) continue
      const c = nearestColor(data[o], data[o + 1], data[o + 2], palette)
      out[o] = c.r
      out[o + 1] = c.g
      out[o + 2] = c.b
    }
  }

  // 描边优化：近黑像素输出强制纯黑（误差扩散无法污染描边）
  if (inkPreserve && hasInk) {
    applyInkPreserve(out, data, n)
  }

  // RGBA 字节序 → Uint32Array（little-endian 下直接复用缓冲区，即模型格式）
  const pixels = new Uint32Array(out.buffer)
  return { pixels, palette, width: w, height: h }
}
