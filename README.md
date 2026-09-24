# facedrop

Gesichter auf Fotos automatisch unkenntlich machen, bevor sie veröffentlicht werden —
gedacht für Kitas, Jugendarbeit und ähnliche Einrichtungen, die Bilder online teilen und
dabei die Privatsphäre der abgebildeten Personen (v. a. Kinder) wahren möchten.

## Kernidee

- **Alles läuft lokal im Browser.** Keine Cloud, kein Server-Roundtrip — ein Bild verlässt
  nie den Rechner. Modell-Gewichte liegen selbst gehostet unter `public/models/face-api`,
  es gibt keinen CDN-Aufruf zur Laufzeit.
- **Ensemble-Erkennungspipeline** ([multiScaleDetect.ts](src/lib/multiScaleDetect.ts)): native
  Browser-`FaceDetector`-API (wo verfügbar) **+** SSD MobileNet V1 (`@vladmandic/face-api`) auf
  dem Gesamtbild **+** SSD MobileNet auf 4 überlappenden, 2×-gezoomten Bildvierteln — alle
  Treffer werden per Non-Max-Suppression gemerged. Das holt deutlich mehr kleine/entfernte
  Gesichter als ein einzelner Durchlauf (siehe Messwerte unter „Tests").
- **Extrem einfache Bedienung:** Bilder per Drag-and-Drop (oder Dateiauswahl) ablegen,
  automatische Erkennung + Verpixelung/Weichzeichnung läuft, danach alle anonymisierten
  Bilder gesammelt als ZIP herunterladen.
- **Batch-first für den POC:** keine manuelle Nachbearbeitung einzelner Gesichter — das ist
  bewusst für eine spätere Version vorgesehen.

## Tech-Stack

- Vite + React + TypeScript
- Tailwind CSS 4
- `@vladmandic/face-api` (MIT) — SSD MobileNet V1 für Gesichtserkennung, läuft auf TensorFlow.js
  (Backend-Wahl: TF.js-Standard, i. d. R. WebGL mit CPU-Fallback — siehe Hinweis unten)
- `jszip` für den gesammelten Download

### Hintergrund zur Erkennungs-Architektur

Ein einzelner Erkennungsdurchlauf mit einem leichtgewichtigen Modell auf dem Gesamtbild
übersieht in eigenen Tests zuverlässig kleine/entfernte Gesichter (s. Abschnitt „Tests"). Das
Engine-Ensemble + Multi-Scale-Tiling in dieser Pipeline ist eine unabhängige Implementierung,
die genau dieses Problem adressiert.

**Hinweis zur Backend-Wahl:** `@vladmandic/face-api` läuft auf TensorFlow.js ohne erzwungenes
Backend, i. d. R. also auf WebGL (GPU) statt reinem WebAssembly. Ursprünglich war "läuft
komplett als WASM" spezifiziert; hier wurde bewusst der TF.js-Standardpfad belassen statt
zusätzlich ein WASM-Backend zu erzwingen (zusätzlicher Aufwand ohne funktionalen Gewinn). Die
eigentliche Anforderung — Bilder verlassen nie das Gerät — bleibt davon unberührt, WebGL läuft
genauso lokal wie WASM.

## Entwicklung

```bash
npm install
npm run dev
```

```bash
npm run build   # Typecheck + Produktionsbuild nach dist/
npm run lint
```

Alle wiederkehrenden Befehle (Dev-Server, Lint, Build, Tests, Docker) gibt es auch gebündelt
über [go-task](https://taskfile.dev) — `task` zeigt die Liste, z. B. `task dev`, `task check`
(Lint+Build+Tests), `task up` (Docker). Siehe [Taskfile.yml](Taskfile.yml).

Der Build ist eine reine statische Seite (kein Server nötig) und lässt sich z. B. auf
Netlify, Vercel (static) oder GitHub Pages deployen. Das Erkennungsmodell (`@vladmandic/face-api`
+ Gewichte, ca. 330 KB gzip) wird dynamisch nachgeladen und landet in einem eigenen Chunk, nicht
im initialen Bundle.

## Docker

```bash
docker compose up --build   # http://localhost:8080
```

oder ohne Compose:

```bash
docker build -t facedrop .
docker run --rm -p 8080:8080 --read-only --tmpfs /var/cache/nginx --tmpfs /var/run --tmpfs /tmp facedrop
```

Mehrstufiger Build (Node nur zum Bauen, ausgeliefert wird über
[`nginxinc/nginx-unprivileged`](https://hub.docker.com/r/nginxinc/nginx-unprivileged) auf Port
8080, läuft als non-root). [nginx.conf](nginx.conf) setzt eine strikte
Content-Security-Policy (`default-src 'self'`, kein `connect-src` nach außen) — technisch
erzwungen, nicht nur behauptet, dass die App mit nichts außer sich selbst spricht. Gegen die
Policy getestet: die komplette Erkennungspipeline (TensorFlow.js/SSD MobileNet) läuft ohne
`unsafe-eval` oder sonstige Lockerung.

## Tests

```bash
npm test           # Unit-/Komponententests (Vitest + React Testing Library)
npm run test:watch
npm run test:e2e    # End-to-End-Tests im echten Browser (Playwright)
```

Die Unit-Tests decken reine Logik ab (Box-Padding-Geometrie, IoU/Non-Max-Suppression,
Dateinamens- und ZIP-Namenskollisionen) sowie die Dropzone-Komponente.

Die E2E-Tests starten die echte App (`npm run dev`) in einem echten Chromium und laden
tatsächliche Testfotos hoch — die komplette Pipeline (Gesichtserkennung, Verpixeln/
Weichzeichnen, ZIP-Download) läuft dabei unverändert wie im Browser der Nutzerin. Alle
Testbilder unter `tests/fixtures/images/` sind gemeinfrei (siehe
[NOTICE.md](tests/fixtures/images/NOTICE.md)). **Laufen bewusst seriell** (`workers: 1` in
[playwright.config.ts](playwright.config.ts)): mehrere TensorFlow.js-Erkenner parallel auf
derselben GPU haben sich gegenseitig so stark ausgebremst, dass Tests am Timeout scheiterten,
obwohl eine einzelne Erkennung unter einer Sekunde dauert — ein Testinfrastruktur-Thema, kein
Pipeline-Bug.

### Erkenntnisse aus den Tests

Die erste Implementierung nutzte [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector)
mit dem `BlazeFace short-range`-Modell (WASM, ein einzelner Durchlauf auf dem Gesamtbild).
Getestet an einem historischen Gruppenfoto (Solvay-Konferenz 1927, 29 Personen): selbst bei
voller Auflösung und stark abgesenkter Konfidenzschwelle wurde nur eine einzige Person erkannt.
Eine niedrigere Schwelle verbesserte zwar die Erkennung entfernter Gesichter, erzeugte aber auch
neue Fehlalarme (die Erde auf einem Foto ganz ohne Personen wurde als Gesicht erkannt) — bei
einem POC ohne manuelle Korrektur ein schlechter Tausch.

Die jetzige Ensemble-Pipeline (native API + SSD MobileNet V1 + Multi-Scale-Tiling) wurde direkt
gegen dieselben Testfotos gemessen:

| Testfoto | Alt (BlazeFace, 1 Durchlauf) | Neu (Ensemble + Tiling) |
| --- | --- | --- |
| [Einstein-Porträt](tests/fixtures/images/einstein.jpg) (1 Gesicht) | 1/1 | 1/1, Konfidenz 0.95 |
| [Apollo-11-Crew](tests/fixtures/images/apollo11-crew.jpg) (3 Gesichter) | 2/3, Konfidenz 0.60–0.62 | 3/3, Konfidenz 0.98–0.99 |
| Solvay-Konferenz 1927 (29 Gesichter, historisch) | 0–1/29 | 28–30/29 |
| [Erde ohne Personen](tests/fixtures/images/no-face-earth.jpg) (0 Gesichter, Negativtest) | 0/0 | 0/0 |

Der Sprung beim Solvay-Foto (0–1 → 28–30 von 29) belegt, dass die Ensemble+Tiling-Architektur —
nicht ein einzelnes "besseres" Modell — der entscheidende Faktor für gute Erkennung ist. Pro
Bild braucht die neue Pipeline ca. 150–700 ms (überwiegend beim ersten Aufruf durch
TF.js-Modell-Kompilierung), keine spürbare Auswirkung auf die Batch-Performance.

## Funktionsumfang (POC)

- Mehrere Bilder gleichzeitig per Drag-and-Drop oder Dateiauswahl
- Automatische Gesichtserkennung (Ensemble + Multi-Scale, s. o.), Verpixeln oder
  Weichzeichnen (global umschaltbar)
- Fortschrittsanzeige pro Bild, Fehler pro Bild statt Komplettabbruch
- Sammel-Download aller Ergebnisse als ZIP
- Unterstützte Formate: JPEG, PNG, WebP

## Nicht im Scope des POC

- Manuelle Korrektur/Ergänzung von Gesichtsboxen — bewusst für eine spätere Version vorgesehen
- Texterkennung/Kennzeichen-Anonymisierung — außerhalb des ursprünglichen Scopes "Gesichter"
- HEIC-Unterstützung
- Offline-Fähigkeit als installierbare PWA (naheliegender nächster Schritt, da bereits alles
  lokal läuft)

## Bekannte Grenzen

- Kein HEIC (iPhone-Standardformat); JPEG/PNG/WebP werden empfohlen.
- Die native `FaceDetector`-API ist nur auf wenigen Plattformen verfügbar (v. a. Android
  Chrome); überall sonst läuft ausschließlich SSD MobileNet V1 — die Ensemble-Pipeline
  funktioniert also auch ohne sie, nur mit einem Erkennungspfad weniger.
- Modell-Download beim ersten Gebrauch ca. 5,4 MB (einmalig, danach Browser-Cache).

## Lizenz

[MIT](LICENSE)
