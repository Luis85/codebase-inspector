# Spike: does headless Chromium draw WebGL? (Task 0a)

**Question:** can a headless Chromium instance, launched via Playwright, render a WebGL2 context and read back pixels — the precondition for any browser harness that wants to photograph the codebase-city canvas.

**Command run:**

```
node scripts/probe-webgl.mjs
```

The probe (`scripts/probe-webgl.mjs`, deleted in step 5 per the task brief) loaded a `data:` URL containing a 64x64 canvas, requested a `webgl2` context, cleared it to `rgb(51, 153, 230)`, read back the pixel at (32, 32), and compared it against the expected colour — across three launch-arg variants, in a fresh browser instance each. `ok: true` requires an exact pixel match.

## Environment

- OS: Windows 11 Pro, build 10.0.26200 (x64)
- `playwright-core` version: `1.56.1` (exact, devDependency, installed via `npm install --save-dev --save-exact playwright-core@1.56.1`)
- Chromium resolved by Playwright: version `141.0.7390.37`, Playwright build `v1194`
  - Executable path: `C:\Users\LuisMendez\AppData\Local\ms-playwright\chromium-1194\chrome-win\chrome.exe`
  - Installed via `npx --yes playwright@1.56.1 install chromium`

## Results — full JSON output, all three variants

### Variant: `default` (no launch args)

```json
{
  "variant": "default",
  "args": [],
  "ok": true,
  "renderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
  "pixel": [51, 153, 230, 255],
  "reason": null,
  "consoleErrors": []
}
```

### Variant: `swiftshader` (`--enable-unsafe-swiftshader`)

```json
{
  "variant": "swiftshader",
  "args": ["--enable-unsafe-swiftshader"],
  "ok": true,
  "renderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
  "pixel": [51, 153, 230, 255],
  "reason": null,
  "consoleErrors": []
}
```

### Variant: `angle-swiftshader` (`--use-angle=swiftshader --enable-unsafe-swiftshader`)

```json
{
  "variant": "angle-swiftshader",
  "args": ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  "ok": true,
  "renderer": "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
  "pixel": [51, 153, 230, 255],
  "reason": null,
  "consoleErrors": []
}
```

## Analysis

All three variants report `ok: true` with an identical `renderer` string naming `SwiftShader` — the software rasterizer. That is a **pass**: it draws, which is all the harness needs. No console errors were emitted in any variant. The read-back pixel matched the cleared colour exactly (`[51, 153, 230, 255]`) in every case.

Notably, the `default` variant (no launch args at all) already succeeds on this machine, because this Chromium build's default GPU policy falls back to Vulkan SwiftShader in a headless/no-GPU context without needing explicit flags. However, that fallback is an implementation detail of Chromium's auto-detection (it depends on what it discovers about available GPU/ICD support at launch), not a guarantee. The two SwiftShader-forcing variants produce the exact same renderer and pixel result while removing that ambiguity — they say directly "use the software path" instead of relying on Chromium to arrive there on its own. For a harness that has to work unattended on machines whose GPU/driver state we don't control, the explicit variant is the safer contract to depend on.

## Conclusion

Headless Chromium **can** render WebGL2 on this machine via the SwiftShader software rasterizer, and Task 0c should launch Chromium with the following explicit args to guarantee the software path deterministically rather than relying on Chromium's default GPU-detection fallback:

```js
const LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
```
