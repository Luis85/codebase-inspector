"""Static link the pinned official Three.js modules; no downloads or node tooling.
This is purpose-built for the included files, not a general JavaScript bundler.
"""
from pathlib import Path
import re, hashlib, json
ROOT=Path(__file__).resolve().parent
EXPECTED={'three.core.js':'ef6859448e18389b1e478db64be78293d53058e4','three.module.js':'b1a0fdda8a14f71dd62d21325f3eb59afc45f1d0'}
def read(name):return (ROOT/name).read_text()
def mapping(text):
    pairs=[]
    for item in text.split(','):
        bits=item.strip().split(' as ')
        if bits[0]:pairs.append((bits[-1].strip(),bits[0].strip()))
    return ','.join(key+':'+value for key,value in pairs)
for name,expected in EXPECTED.items():
    data=(ROOT/'vendor'/name).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==expected, 'Vendor integrity mismatch'
core=read('vendor/three.core.js')
core=re.sub(r'export\s*\{([^}]+)\}\s*;',lambda m:'return {'+mapping(m.group(1))+'};',core)
module=read('vendor/three.module.js')
module=re.sub(r"import\s*\{([^}]+)\}\s*from\s*'./three.core.js'\s*;",lambda m:'const {'+mapping(m.group(1))+'}=THREE;',module)
module=re.sub(r"export\s*\{([^}]+)\}\s*from\s*'./three.core.js'\s*;",'',module)
module=re.sub(r'export\s*\{([^}]+)\}\s*;',lambda m:'Object.assign(THREE,{'+mapping(m.group(1))+'});',module)
assert not re.search(r'^\s*(import|export)\s',core+'\n'+module,re.M)
license=read('vendor/LICENSE-three.txt')
bundle='/*\n'+license+'\n*/\nwindow.CodebaseInspector3D=(()=>{\nconst THREE=(()=>{\n'+core+'\n})();\n(()=>{\n'+module+'\n})();\n'+read('src/three-city.js')+'\nreturn {ThreeCity,THREE_REVISION:THREE.REVISION};\n})();'
(ROOT/'viewer.bundle.js').write_text(bundle)
html=read('src/page.html')
icons=json.loads(read('src/icons.json'))
html=re.sub(r'\{\{icon:([\w-]+)\}\}',lambda m:icons[m.group(1)],html)
for token,value in [('CSS',read('src/styles.css')),('ICONS','const CIIcons = '+json.dumps(icons)+';'),('RELATIONSHIPS',read('src/relationships.js')),('MODEL',read('src/interaction-state.js')),('FIXTURES',read('src/fixtures.js')),('RENDERER',bundle),('APP',read('src/app.js'))]:
    html=html.replace('/*__'+token+'__*/',value.replace('</script','<\\/script'))
(ROOT/'index.html').write_text(html)
print('Built',len(html.encode()),'bytes HTML;',len(bundle.encode()),'bytes viewer bundle')
