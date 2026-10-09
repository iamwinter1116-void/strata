#!/usr/bin/env python3
"""STRATA icon generator — layered-earth 'S' mark, zero external deps."""
import struct, zlib, math, os

def make_png(width, height, pixel_fn):
    """Minimal PNG encoder: RGBA, no interlace."""
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter: none
        for x in range(width):
            r, g, b, a = pixel_fn(x, y, width, height)
            raw += bytes([r, g, b, a])
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(raw, 9))
            + chunk(b'IEND', b''))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))

def icon_pixel(x, y, W, H):
    """Layered strata background + amber monolith 'S' carved in the center."""
    # background: horizontal earth strata, darkening with depth
    bands = [
        ((47, 33, 15, 255), (31, 22, 10, 255)),   # topsoil
        ((31, 22, 10, 255), (24, 17, 8, 255)),
        ((24, 17, 8, 255), (17, 12, 6, 255)),    # deep
    ]
    t = y / H
    band_t = t * len(bands)
    idx = min(len(bands) - 1, int(band_t))
    ft = band_t - idx
    base = lerp(bands[idx][0], bands[idx][1], ft)

    # subtle sediment noise via hash
    h = ((x * 374761393 + y * 668265263) ^ (x * y * 2246822519)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    n = (h & 0xff) / 255.0
    base = tuple(max(0, min(255, int(c * (0.88 + 0.24 * n)))) for c in base)

    # carved 'S' glyph: distance to a stylized S path
    cx, cy = W / 2, H / 2
    s = W * 0.62  # glyph scale
    # S as two stacked arcs (drawn analytically)
    dx = (x - cx) / (s * 0.5)
    dy = (y - cy) / (s * 0.5)
    # top arc (opens down-left), bottom arc (opens up-right)
    in_top = False
    in_bot = False
    try:
        # top half S curve
        if 0.2 < dx <= 0.62 and -0.95 <= dy < -0.08:
            circle_cx, circle_cy, rr = 0.0, -0.52, 0.46
            d = math.hypot(dx - circle_cx, dy - circle_cy)
            in_top = d < rr and dy < -0.1
        # bottom half S curve
        if -0.62 <= dx < -0.2 and 0.08 <= dy <= 0.95:
            circle_cx, circle_cy, rr = 0.0, 0.52, 0.46
            d = math.hypot(dx - circle_cx, dy - circle_cy)
            in_bot = d < rr and dy > 0.1
    except Exception:
        pass
    if in_top or in_bot:
        # amber glyph with soft edge glow
        return (217, 164, 65, 255)
    # faint amber edge glow
    return base

def make_icon(size):
    return make_png(size, size, icon_pixel)

os.makedirs('icons', exist_ok=True)
for sz in (192, 512):
    with open(f'icons/icon-{sz}.png', 'wb') as f:
        f.write(make_icon(sz))
    print(f'icons/icon-{sz}.png written')
print('done')
