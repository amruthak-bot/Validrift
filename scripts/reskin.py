#!/usr/bin/env python3
"""Reskin VALIDRIFT frontend: replace hardcoded blue Tailwind tokens with
CSS-variable references (rgb(var(--token) / <alpha-value>)), and inject
theme.css + pre-paint snippet + theme.js into every page head.

Idempotent: files already containing css/theme.css are skipped entirely.
Handles both multi-line and single-line tailwind-config blocks.
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FE = ROOT / "frontend"

TOKENS = [
    "surface-container", "on-background", "outline-variant", "error-container",
    "on-error-container", "on-tertiary-container", "surface-container-highest",
    "tertiary-fixed", "inverse-primary", "primary-fixed-dim", "tertiary-fixed-dim",
    "background", "surface-tint", "on-primary-container", "on-primary-fixed-variant",
    "on-secondary-container", "surface-variant", "primary", "secondary",
    "surface-bright", "on-secondary-fixed-variant", "primary-container", "outline",
    "surface-container-low", "on-error", "surface", "surface-container-high",
    "tertiary", "on-primary-fixed", "secondary-fixed-dim", "on-tertiary-fixed",
    "tertiary-container", "on-surface-variant", "surface-container-lowest",
    "on-primary", "secondary-fixed", "on-secondary", "inverse-on-surface",
    "on-secondary-fixed", "error", "on-tertiary-fixed-variant", "surface-dim",
    "secondary-container", "primary-fixed", "on-surface", "inverse-surface",
    "on-tertiary",
]

INJECT = (
    '</script>\n'
    '<link rel="stylesheet" href="css/theme.css"/>\n'
    '<script>/* theme pre-paint: set data-theme before first paint */\n'
    '(function(){try{var t=localStorage.getItem("vr_theme")||"forge";'
    'document.documentElement.setAttribute("data-theme",t);}catch(e){'
    'document.documentElement.setAttribute("data-theme","forge");}})();\n'
    '</script>\n'
    '<script src="js/theme.js"></script>'
)

def brace_end(html, open_idx):
    depth = 0
    for j in range(open_idx, len(html)):
        c = html[j]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return j + 1
    raise ValueError("unbalanced braces")

def reskin(path: pathlib.Path):
    html = path.read_text(encoding="utf-8")
    if "css/theme.css" in html:
        print(f"SKIP (already done): {path.name}")
        return False
    m = re.search(r'<script id="tailwind-config">', html)
    if not m:
        print(f"SKIP (no tailwind-config): {path.name}")
        return False
    mk = re.search(r'("colors"|colors)\s*:\s*\{', html[m.end():])
    if not mk:
        print(f"SKIP (no colors block): {path.name}")
        return False
    keyname = mk.group(1)
    open_idx = m.end() + mk.end() - 1  # the "{" character
    end = brace_end(html, open_idx)
    old_block = html[m.end() + mk.start():end]

    if "\n" in old_block:
        # multi-line: keep pretty layout, safe indent = trailing spaces/tabs only
        nl = html.rfind("\n", 0, m.end() + mk.start())
        indent = re.search(r"[ \t]*$", html[nl + 1:m.end() + mk.start()]).group(0)
        lines = [indent + "colors: {"]
        for t in TOKENS:
            lines.append(f'{indent}  "{t}": "rgb(var(--{t}) / <alpha-value>)",')
        lines.append(indent + "}")
        replacement = "\n".join(lines)
    else:
        # single-line: keep single-line
        entries = ", ".join(f'"{t}": "rgb(var(--{t}) / <alpha-value>)"' for t in TOKENS)
        replacement = f"{keyname}: {{ {entries} }}"

    html = html[:m.end() + mk.start()] + replacement + html[end:]

    m2 = re.search(r'<script id="tailwind-config">.*?</script>', html, re.DOTALL)
    if not m2:
        print(f"WARN (no closing script tag): {path.name}")
        return False
    html = html[:m2.end()] + "\n" + INJECT + html[m2.end():]
    path.write_text(html, encoding="utf-8")
    print(f"OK: {path.name}")
    return True

def main():
    for p in sorted(FE.glob("*.html")):
        reskin(p)

if __name__ == "__main__":
    main()
