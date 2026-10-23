"""Timestamped frame strip for judging motion (a 2 fps contact sheet hides 1-frame jumps; Tom 2026-10-23).
usage: python3 tools/framestrip.py <video> <t0> <seconds> <out.jpg> [fps=30] [cols=6]
Draws the time on every frame and a red centre line, so jumps, blank frames and off-centre rows show."""
import glob, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont
vid, t0, dur, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
fps = float(sys.argv[5]) if len(sys.argv) > 5 else 30; cols = int(sys.argv[6]) if len(sys.argv) > 6 else 6
with tempfile.TemporaryDirectory() as td:
    subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", str(t0), "-i", vid, "-t", str(dur), "-vf", f"fps={fps},scale=384:-1", f"{td}/%04d.png"], check=True)
    fr = sorted(glob.glob(f"{td}/*.png")); f = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
    sheet = Image.new("RGB", (384 * cols, 216 * ((len(fr) + cols - 1) // cols)))
    for i, p in enumerate(fr):
        im = Image.open(p).convert("RGB"); d = ImageDraw.Draw(im)
        d.rectangle((0, 0, 64, 22), fill=(0, 0, 0)); d.text((4, 2), f"{t0 + i / fps:.2f}", font=f, fill=(255, 255, 0)); d.line((192, 0, 192, 216), fill=(255, 0, 0))
        sheet.paste(im, ((i % cols) * 384, (i // cols) * 216))
    sheet.save(out); print(out, len(fr), "frames")
