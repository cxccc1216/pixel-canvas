// GIF 导出：基于 gifenc（纯 JS 编码，无 worker 依赖）
import gifenc from 'gifenc'

const { GIFEncoder, quantize, applyPalette } = gifenc

/**
 * 把多帧像素数据导出为 GIF 字节
 * @param {Array<Uint32Array>} frames 每帧为模型格式像素数组
 * @param {number} width height 单帧像素尺寸
 * @param {number} delayMs 每帧延迟（毫秒）
 * @param {number} scale 放大倍数（最近邻）
 * @returns {Uint8Array}
 */
export function exportGIF(frames, width, height, delayMs = 120, scale = 1) {
  const w = width * scale
  const h = height * scale
  const gif = GIFEncoder()
  const rgbaBuf = new Uint8ClampedArray(w * h * 4)

  frames.forEach((frame, fi) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = frame[y * width + x]
        const r = c & 0xff
        const g = (c >>> 8) & 0xff
        const b = (c >>> 16) & 0xff
        const a = (c >>> 24) & 0xff
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const o = ((y * scale + dy) * w + (x * scale + dx)) * 4
            rgbaBuf[o] = r
            rgbaBuf[o + 1] = g
            rgbaBuf[o + 2] = b
            rgbaBuf[o + 3] = a
          }
        }
      }
    }
    const palette = quantize(rgbaBuf, 256)
    const index = applyPalette(rgbaBuf, palette)
    gif.writeFrame(index, w, h, {
      palette,
      delay: delayMs,
      transparent: true,
      first: fi === 0,
      repeat: 0, // 无限循环
    })
  })

  gif.finish()
  return gif.bytes()
}
