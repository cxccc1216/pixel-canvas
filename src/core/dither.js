// Floyd–Steinberg 误差扩散抖动 + 最近色查找

/**
 * 查找调色板中与给定颜色最近的色
 */
export function nearestColor(r, g, b, palette) {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const dr = r - c.r
    const dg = g - c.g
    const db = b - c.b
    const dist = dr * dr + dg * dg + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best
}

/**
 * 误差扩散抖动：把 RGBA 像素映射到调色板，并把量化误差按 Floyd–Steinberg
 * 系数扩散到右、左下、下、右下四个相邻像素。
 * @param {Uint8ClampedArray} pixels RGBA 字节序 (w*h*4)
 * @param {Array<{r,g,b}>} palette
 * @param {number} width
 * @param {number} height
 * @returns {Uint8ClampedArray} 映射后的 RGBA 数据
 */
export function floydSteinberg(pixels, palette, width, height) {
  const n = width * height
  const rgb = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    rgb[i * 3] = pixels[i * 4]
    rgb[i * 3 + 1] = pixels[i * 4 + 1]
    rgb[i * 3 + 2] = pixels[i * 4 + 2]
  }

  const result = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const pr = rgb[idx * 3]
      const pg = rgb[idx * 3 + 1]
      const pb = rgb[idx * 3 + 2]
      const pal = nearestColor(pr, pg, pb, palette)
      const o = idx * 4
      result[o] = pal.r
      result[o + 1] = pal.g
      result[o + 2] = pal.b
      result[o + 3] = pixels[o + 3] // 保留 alpha

      const er = pr - pal.r
      const eg = pg - pal.g
      const eb = pb - pal.b

      const distribute = (nx, ny, factor) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
        const ni = (ny * width + nx) * 3
        rgb[ni] += er * factor
        rgb[ni + 1] += eg * factor
        rgb[ni + 2] += eb * factor
      }
      distribute(x + 1, y, 7 / 16)
      distribute(x - 1, y + 1, 3 / 16)
      distribute(x, y + 1, 5 / 16)
      distribute(x + 1, y + 1, 1 / 16)
    }
  }
  return result
}
