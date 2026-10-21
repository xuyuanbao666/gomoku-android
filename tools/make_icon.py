#!/usr/bin/env python3
"""生成五子棋启动图标 res/mipmap-mdpi/ic_launcher.png"""
import zlib, struct, os

S = 48
WOOD = (226, 180, 112)
WOOD_D = (200, 152, 82)
LINE = (91, 61, 30)
BORDER = (120, 84, 40)
BLACK = (20, 20, 20)
WHITE = (250, 250, 250)

px = [[(0, 0, 0, 0) for _ in range(S)] for _ in range(S)]


def put(x, y, c):
    if 0 <= x < S and 0 <= y < S:
        px[y][x] = c


def circle(cx, cy, r, color, edge=None):
    for y in range(int(cy - r) - 2, int(cy + r) + 3):
        for x in range(int(cx - r) - 2, int(cx + r) + 3):
            d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            if d <= r - 1:
                put(x, y, color)
            elif d <= r and edge:
                a = max(0.0, min(1.0, r - d))
                bg = px[y][x]
                put(x, y, tuple(int(edge[i] * a + bg[i] * (1 - a)) for i in range(3)) + (255,))


# 木质底
for y in range(S):
    for x in range(S):
        c = WOOD if (x + y) % 7 else WOOD_D
        px[y][x] = c + (255,)

# 外框
for i in range(S):
    for t in range(2):
        put(i, t, BORDER + (255,)); put(i, S - 1 - t, BORDER + (255,))
        put(t, i, BORDER + (255,)); put(S - 1 - t, i, BORDER + (255,))

# 网格（3 条横 + 3 条竖，位于 12/24/36）
for g in (12, 24, 36):
    for i in range(6, S - 5):
        put(i, g, LINE + (255,))
        put(g, i, LINE + (255,))

# 两枚棋子
circle(12, 12, 6.5, (15, 15, 15, 255), edge=(60, 60, 60, 255))
circle(36, 36, 6.5, (252, 252, 252, 255), edge=(160, 160, 160, 255))
# 高光
circle(10, 10, 2.0, (95, 95, 95, 180))
circle(34, 34, 2.0, (255, 255, 255, 220))


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)


raw = b''.join(b'\x00' + b''.join(struct.pack('4B', *px[y][x]) for x in range(S)) for y in range(S))
png = (b'\x89PNG\r\n\x1a\n'
       + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 6, 0, 0, 0))
       + chunk(b'IDAT', zlib.compress(raw, 9))
       + chunk(b'IEND', b''))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   '..', 'android', 'res', 'mipmap-mdpi', 'ic_launcher.png')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'wb') as f:
    f.write(png)
print('written', os.path.normpath(out), len(png), 'bytes')
