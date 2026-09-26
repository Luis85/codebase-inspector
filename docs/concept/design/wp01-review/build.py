"""Build the offline review HTML. Python standard library only."""
from pathlib import Path
ROOT = Path(__file__).resolve().parent
page = (ROOT / 'src/page.html').read_text()
for marker, name in [('CSS', 'styles.css'), ('MODEL', 'interaction-state.js'),
                     ('FIXTURES', 'fixtures.js'), ('RENDERER', 'review-renderer.js'), ('APP', 'app.js')]:
    content = (ROOT / 'src' / name).read_text()
    if name.endswith('.js'):
        content = content.replace('</script', '<\\/script')
    page = page.replace('/*__' + marker + '__*/', content)
(ROOT / 'index.html').write_text(page)
print('Built index.html:', len(page.encode()), 'bytes')
