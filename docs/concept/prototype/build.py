"""Build a fully self-contained HTML review artifact. No package installation required."""
from pathlib import Path
root = Path(__file__).resolve().parent
css = (root / 'src/styles.css').read_text(encoding='utf-8')
scripts = '\n;\n'.join((root / f'src/{name}.js').read_text(encoding='utf-8') for name in ['data', 'ui', 'city', 'app'])
# Escape any script-end sequence if a future source edit introduces one inside a string.
scripts = scripts.replace('</script', '<\\/script')
html = f'''<!DOCTYPE html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark light"><meta name="description" content="Codebase Inspector — a complete offline interactive UI prototype. All codebase measurements are synthetic."><title>Code city · Codebase Inspector</title><style>{css}</style></head><body><a class="skip-link" href="#main" onclick="document.getElementById('main').focus();return false">Skip to main content</a><div id="app"></div><div id="modal-root"></div><div id="toast-stack" class="toast-stack" aria-live="polite" aria-atomic="false"></div><noscript>This interactive prototype requires JavaScript. No network connection or server is needed.</noscript><script>{scripts}</script></body></html>'''
(root / 'index.html').write_text(html, encoding='utf-8')
(root.parent / 'codebase-inspector-full-ui.html').write_text(html, encoding='utf-8')
print(f'Built {len(html):,} characters into index.html and codebase-inspector-full-ui.html')
