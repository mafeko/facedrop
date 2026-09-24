<img src="public/logo.png" alt="facedrop" width="280" />

# facedrop

> **Note:** The UI is currently in German.

Automatically blur or pixelate faces in photos before they get published — built for
daycare centers, youth organizations, and similar institutions that share photos online
and want to protect the privacy of the people in them (especially children).

On a MacBook with an M1 chip, anonymizing a photo takes **under one second**.

## How it works

- **Everything runs locally in the browser.** No cloud, no server round-trip — images
  never leave the machine. Model weights are self-hosted under `public/models/face-api`;
  nothing is fetched from a CDN at runtime.
- **Ensemble detection pipeline** ([multiScaleDetect.ts](src/lib/multiScaleDetect.ts)):
  combines the native browser `FaceDetector` API (where available), SSD MobileNet V1
  (`@vladmandic/face-api`) on the full image, and SSD MobileNet on four overlapping,
  2×-zoomed image quadrants. All detections are merged via non-max suppression, which
  catches far more small or distant faces than a single pass would.
- **Simple to use:** drop images (or pick files), detection and blurring/pixelation run
  automatically, then download all anonymized images as a single ZIP.
- **Batch-first:** no manual per-face correction — that's planned for a later version.

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS 4
- `@vladmandic/face-api` (MIT) — SSD MobileNet V1 for face detection, running on
  TensorFlow.js (default backend, typically WebGL with a CPU fallback)
- `jszip` for the collected download

## Development

All commands run through [go-task](https://taskfile.dev) — run `task` (no arguments) to
list them. See [Taskfile.yml](Taskfile.yml) for the full list.

```bash
task install   # npm install
task dev       # start the Vite dev server
```

```bash
task build   # typecheck + production build into dist/
task lint    # run ESLint
task check   # lint + build + all tests — the full pre-push gate
```

The build is a static site (no server required) and can be deployed to Netlify, Vercel
(static), GitHub Pages, etc. The detection model (`@vladmandic/face-api` + weights, ~330 KB
gzipped) is lazy-loaded into its own chunk, not the initial bundle.

## Docker

```bash
task up     # build and run the production container — http://localhost:8080
task down   # stop it
```

or just build the image with `task docker`.

Multi-stage build (Node only for building; served via
[`nginxinc/nginx-unprivileged`](https://hub.docker.com/r/nginxinc/nginx-unprivileged) on
port 8080, running as non-root). [nginx.conf](nginx.conf) sets a strict Content-Security-Policy
(`default-src 'self'`, no external `connect-src`) — enforced technically, not just claimed.
The full detection pipeline (TensorFlow.js / SSD MobileNet) runs against this policy without
`unsafe-eval` or any other relaxation.

## Tests

```bash
task test   # unit/component tests (Vitest + React Testing Library)
task e2e    # end-to-end tests in a real browser (Playwright)
```

Unit tests cover pure logic (box-padding geometry, IoU/non-max suppression, filename and
ZIP name collisions) and the dropzone component.

E2E tests start the real app (`task dev`) in real Chromium and upload actual test
photos — the full pipeline (face detection, blurring/pixelation, ZIP download) runs
unchanged, just like in a user's browser. All test images under
`tests/fixtures/images/` are public domain (see
[NOTICE.md](tests/fixtures/images/NOTICE.md)). Tests run serially
(`workers: 1` in [playwright.config.ts](playwright.config.ts)) to avoid multiple
TensorFlow.js detectors contending for the same GPU.

## Feature scope (POC)

- Multiple images at once via drag-and-drop or file picker
- Automatic face detection (ensemble + multi-scale, see above), pixelation or blur
  (toggle applies globally)
- Per-image progress and error handling instead of a full-batch abort
- Batch download of all results as a ZIP
- Supported formats: JPEG, PNG, WebP, HEIC/HEIF (the default iPhone format — decoded
  client-side via a bundled, lazy-loaded WASM build of libheif,
  [heic2any](https://github.com/alexcorvi/heic2any); stays fully local, no upload, no
  CDN call)

## Out of scope for the POC

- Manual correction/addition of face boxes — planned for a later version
- Text/license-plate anonymization — outside the original "faces" scope
- Offline capability as an installable PWA (a natural next step, since everything
  already runs locally)

## Known limitations

- The native `FaceDetector` API is only available on a few platforms (mainly Android
  Chrome); everywhere else, detection relies solely on SSD MobileNet V1 — the ensemble
  pipeline still works, just with one fewer detection path.
- First-use model download is about 5.4 MB (one-time, then cached by the browser).

## License

[MIT](LICENSE)
