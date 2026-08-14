// 核心算法快速验证脚本（Node 运行）
import { rgba, toRGBA, toHex, hexToRgba } from '../src/core/canvasModel.js'
import { medianCut } from '../src/core/quantize.js'
import { floydSteinberg, nearestColor } from '../src/core/dither.js'
import { isInkPixel, ensureBlackInPalette, applyInkPreserve, mergeSimilarColors } from '../src/core/converter.js'

let failed = 0
const assert = (cond, msg) => {
  if (!cond) {
    console.error('✗ FAIL:', msg)
    failed++
  } else {
    console.log('✓', msg)
  }
}

// 1. rgba 打包往返
const c = rgba(255, 0, 128, 200)
const [r, g, b, a] = toRGBA(c)
assert(r === 255 && g === 0 && b === 128 && a === 200, `rgba 往返 (${r},${g},${b},${a})`)

// 2. hex 往返
assert(toHex(rgba(18, 52, 86)) === '#123456', 'toHex #123456')
assert(toRGBA(hexToRgba('#123456')).join(',') === '18,52,86,255', 'hexToRgba 往返')

// 3. medianCut 生成指定数量颜色
const pixels = []
for (let i = 0; i < 2000; i++) {
  pixels.push([(Math.random() * 255) | 0, (Math.random() * 255) | 0, (Math.random() * 255) | 0])
}
const pal8 = medianCut(pixels, 8)
assert(pal8.length === 8, `medianCut 生成 ${pal8.length} 色`)
const pal64 = medianCut(pixels, 64)
assert(pal64.length === 64, `medianCut 生成 ${pal64.length} 色`)
let inRange = pal64.every((p) => p.r >= 0 && p.r <= 255 && p.g >= 0 && p.g <= 255 && p.b >= 0 && p.b <= 255)
assert(inRange, '调色板颜色均在 0-255 范围')

// 4. 极端情况：单色输入
const single = []
for (let i = 0; i < 100; i++) single.push([100, 100, 100])
const pal1 = medianCut(single, 8)
assert(pal1.length === 1 && pal1[0].r === 100, '单色输入收敛为 1 色')

// 5. floydSteinberg：输出长度正确、颜色全部落在调色板内、alpha 保留
const w = 16
const h = 16
const data = new Uint8ClampedArray(w * h * 4)
for (let i = 0; i < w * h; i++) {
  data[i * 4] = (i * 7) % 256
  data[i * 4 + 1] = (i * 13) % 256
  data[i * 4 + 2] = (i * 29) % 256
  data[i * 4 + 3] = i % 3 === 0 ? 0 : 255 // 部分透明像素
}
const out = floydSteinberg(data, pal8, w, h)
assert(out.length === data.length, '抖动输出长度正确')
const set = new Set(pal8.map((p) => `${p.r},${p.g},${p.b}`))
let allIn = true
let alphaOk = true
for (let i = 0; i < w * h; i++) {
  if (!set.has(`${out[i * 4]},${out[i * 4 + 1]},${out[i * 4 + 2]}`)) allIn = false
  if (data[i * 4 + 3] === 0 && out[i * 4 + 3] !== 0) alphaOk = false
}
assert(allIn, '抖动后所有颜色均在调色板内')
assert(alphaOk, '抖动保留透明像素 alpha')

// 6. nearestColor
const nc = nearestColor(10, 10, 10, [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }])
assert(nc.r === 0 && nc.g === 0 && nc.b === 0, 'nearestColor 选择最近色')

// 7. 转换结果可转回 Uint32Array 模型格式（模拟 converter 的字节序）
const outU32 = new Uint32Array(out.buffer)
// 验证：把 outU32 写回 ImageData 再读出，应与 out 一致
const back = new Uint8ClampedArray(outU32.length * 4)
back.set(new Uint8ClampedArray(outU32.buffer))
let byteEqual = true
for (let i = 0; i < out.length; i++) {
  if (back[i] !== out[i]) {
    byteEqual = false
    break
  }
}
assert(byteEqual, 'Uint32Array 复用缓冲区字节序一致（模型 ↔ ImageData 互通）')

// ===== 8. 描边优化 =====
// 近黑判定
assert(isInkPixel(0, 0, 0) && isInkPixel(20, 18, 22), '近黑像素判定（阈值内）')
assert(!isInkPixel(255, 105, 180) && !isInkPixel(40, 40, 40), '非黑像素（粉色/中灰）不判定为近黑')

// ensureBlackInPalette：无纯黑时注入纯黑（替换最近色）
const palNoBlack = [
  { r: 255, g: 105, b: 180 },
  { r: 200, g: 10, b: 30 },
  { r: 60, g: 200, b: 120 },
]
const injected = ensureBlackInPalette(palNoBlack)
assert(injected === true && palNoBlack.some((p) => p.r === 0 && p.g === 0 && p.b === 0), '无黑调色板注入纯黑')
assert(palNoBlack.length === 3, '注入纯黑后调色板数量不变（替换而非追加）')
const injected2 = ensureBlackInPalette(palNoBlack)
assert(injected2 === false, '已含纯黑时不再重复注入')

// applyInkPreserve：近黑像素输出强制纯黑，非近黑像素不动
const src = new Uint8ClampedArray(4 * 4)
src[0] = 0; src[1] = 0; src[2] = 0; src[3] = 255 // 像素0：纯黑
src[4] = 255; src[5] = 105; src[6] = 180; src[7] = 255 // 像素1：粉色
src[8] = 5; src[9] = 12; src[10] = 20; src[11] = 255 // 像素2：近黑（被污染前的原始值，三通道均在阈值内）
src[12] = 0; src[13] = 0; src[14] = 0; src[15] = 0 // 像素3：全透明
const out2 = new Uint8ClampedArray([9, 8, 90, 255, 10, 5, 3, 255, 40, 60, 200, 255, 0, 0, 0, 0])
applyInkPreserve(out2, src, 4)
assert(out2[0] === 0 && out2[1] === 0 && out2[2] === 0, '近黑像素输出强制纯黑')
assert(out2[4] === 10 && out2[5] === 5 && out2[6] === 3, '粉色像素输出不被改动')
assert(out2[8] === 0 && out2[9] === 0 && out2[10] === 0, '受污染的近黑像素也被拉回纯黑')
assert(out2[12] === 0 && out2[15] === 0, '透明像素保持透明')

// ===== 9. 合并相近颜色（消除伪白色） =====
const nearWhites = [
  { r: 255, g: 255, b: 255 },
  { r: 252, g: 254, b: 253 },
  { r: 254, g: 252, b: 251 },
  { r: 255, g: 105, b: 180 }, // 粉色
  { r: 60, g: 200, b: 120 }, // 绿色
]
const merged = mergeSimilarColors(nearWhites)
assert(merged.length === 3, `3 个近白合并为 1 个（实际 ${merged.length}）`)
assert(merged.some((c) => c.r === 255 && c.g === 255 && c.b === 255), '保留最亮的白色为代表色')
assert(merged.some((c) => c.r === 255 && c.g === 105 && c.b === 180), '粉色保留')
assert(merged.some((c) => c.r === 60 && c.g === 200 && c.b === 120), '绿色保留')
// 明显不同色不误合并：白 vs 浅灰（距离 ~34 > 24）
const whiteGray = [
  { r: 255, g: 255, b: 255 },
  { r: 235, g: 235, b: 235 },
]
assert(mergeSimilarColors(whiteGray).length === 2, '白与浅灰不误合并')
// 幂等性
assert(mergeSimilarColors(merged).length === merged.length, '合并结果再合并不变（幂等）')

console.log(failed === 0 ? '\n✅ 全部测试通过' : `\n❌ ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
