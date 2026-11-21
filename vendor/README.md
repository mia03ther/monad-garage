# Three.js runtime

The two unmodified ES modules come from the official npm package
[`three@0.180.0`](https://www.npmjs.com/package/three/v/0.180.0), `build/`.
Source: [mrdoob/three.js, r180](https://github.com/mrdoob/three.js/tree/r180).
They were copied from the already-installed package, not from the reference
Obsidian plugin. See [THREE-LICENSE.txt](THREE-LICENSE.txt) (MIT).

Pinned local files avoid a runtime CDN or an installation/build step for
judges. No external models, photographs, textures, fonts, or plugins are
loaded by the observatory. The GENESIS code is in `frontend/studio/`.

SHA-256 of the distributed files:

```text
three.module.js  c8211c69345d2e9949dc7a8ac969380497aa0600a5a8ac6a459c8cd02dd9cb8a
three.core.js    eb077d2417f61d3e6d9264c317cabc4ea35769ed6b0ab533067292a550784c20
```

Total runtime JavaScript size is about 2 MB before compression. WebGL 2 is
required. This dependency does not change the Python runtime requirements.
The scoped Git attributes preserve upstream line endings and its existing
space-before-tab indentation rather than editing the distributed library.

## Invitation QR codes

`qrcode.mjs` is the unmodified `dist/qrcode.mjs` from the official npm
package `qrcode-generator@2.0.4` (Kazuhiko Arase). Its upstream copyright
and MIT license link are retained; the MIT text is included in
`QRCODE-LICENSE.txt`. It creates QR codes locally in the browser. No invite
URL is sent to a third-party QR service. Upstream:
https://github.com/kazuhikoarase/qrcode-generator
