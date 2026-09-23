#!/usr/bin/env python3
"""Minify css/styles.css -> css/styles.min.css (checked in, no build step)."""
import re

src = open("css/styles.css").read()
out = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
out = re.sub(r"\s+", " ", out)
out = re.sub(r"\s*([{}:;,>~+])\s*", r"\1", out)
out = re.sub(r"\s*\(\s*", "(", out)
out = re.sub(r"\s*\)\s*", ")", out)
out = "/* generated from css/styles.css (source of truth) via scripts/minify-css.py */\n" + out.strip() + "\n"
open("css/styles.min.css", "w").write(out)
print(f"css/styles.min.css written ({len(out)} bytes)")