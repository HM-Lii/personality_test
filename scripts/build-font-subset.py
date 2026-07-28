#!/usr/bin/env python3
"""构建展示衬线字体子集（Noto Serif SC 可变字体 → woff2）。

用途：全站的展示衬线（标题、人名、印章、雷达分值等）此前完全依赖系统字体，
Windows 用户会回退到中易宋体，大字号下横画过细。本脚本从仓库源码中收集所有
可能以衬线渲染的字符，生成自托管的子集 woff2，保证各平台标题表现一致。

用法：
    pip install fonttools brotli
    python scripts/build-font-subset.py

产物：fonts/NotoSerifSC-subset.woff2（styles.css 中的 @font-face 引用）。
源字体缓存于 fonts/.source/（已 gitignore），重复构建不重复下载。
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "fonts" / ".source"
SOURCE_FONT = SOURCE_DIR / "NotoSerifSC-VF.ttf"
FONT_URL = (
    "https://github.com/google/fonts/raw/main/"
    "ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"
)
OUTPUT = ROOT / "fonts" / "NotoSerifSC-subset.woff2"

# 衬线字体会渲染到的文本来源：页面模板 + 全部数据与 UI 文案。
HARVEST_GLOBS = ["index.html", "src/**/*.mjs"]

# 源码中未必出现、但动态内容里常用的字符（标点、数字、连字符等）。
EXTRA_CHARS = (
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    " —–…·《》〈〉「」『』【】、。，；：？！…—"
    "（）()[]{}<>\"'‘’“”|/\\-–—+*=×~～%‰°"
    "  　"  # 各种空格
)


def harvest_text() -> str:
    parts: list[str] = [EXTRA_CHARS]
    for pattern in HARVEST_GLOBS:
        for path in sorted(ROOT.glob(pattern)):
            parts.append(path.read_text(encoding="utf-8"))
    return "\n".join(parts)


def download_font() -> None:
    if SOURCE_FONT.exists():
        return
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"下载源字体：{FONT_URL}")
    with urllib.request.urlopen(FONT_URL, timeout=120) as response:
        SOURCE_FONT.write_bytes(response.read())
    print(f"已缓存到 {SOURCE_FONT}（{SOURCE_FONT.stat().st_size / 1e6:.1f} MB）")


def build_subset(text: str) -> None:
    try:
        from fontTools import subset
    except ImportError:
        sys.exit("缺少依赖，请先运行：pip install fonttools brotli")

    text_file = SOURCE_DIR / "charset.txt"
    text_file.write_text(text, encoding="utf-8")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    options = subset.Options()
    options.flavor = "woff2"
    options.with_zopfli = False
    options.hinting = False  # 展示字号下 hinting 收益小，换约两成体积
    options.desubroutinize = True
    font = subset.load_font(str(SOURCE_FONT), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.save(str(OUTPUT))

    glyphs = font.getGlyphOrder()
    size_kb = OUTPUT.stat().st_size / 1024
    print(f"子集字符数：{len(set(text))}，字形数：{len(glyphs)}")
    print(f"已生成 {OUTPUT}（{size_kb:.0f} KB）")


def main() -> None:
    download_font()
    build_subset(harvest_text())


if __name__ == "__main__":
    main()
