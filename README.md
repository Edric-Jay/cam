# Camlut · Color Studio

A mobile-first Next.js 16 / React 19 camera PWA. All photo processing and storage happen in the browser. No account, microphone, upload endpoint, or analytics is required by the app. Private hosting may require the hosting account to sign in.

## Run

```powershell
cd C:\Users\edric\Documents\camlut\camlut-app
npm ci
npm run dev
```

Open http://localhost:3000. For the production/offline version:

```powershell
npm run build
npm start
```

`next build` exports into `out/`; the post-build script generates a versioned service worker. `npm start` serves the static export. Phone camera access requires HTTPS; an HTTP LAN IP does not qualify. Use the private HTTPS deployment on a phone. If a private hosting sign-in screen prevents an offline cold launch, use a locally installed/cached session or an HTTPS host without a network-dependent access gateway.

## Use

Tap the camera icon to grant camera access. Portra at 80% is the initial look. The sparkle control opens the real LUT library. The eye toggles an ungraded *moving* preview without changing the capture recipe. Select Original or intensity 0% to save without grading. The shutter captures a JPEG; the gallery offers download, share, and deletion. Download important photos because browser storage can be evicted.

The top icons control timer, thirds grid, crop, settings, and torch when supported. Camera switching appears only when multiple video devices are exposed. The adjustment drawer shows supported zoom, exposure, focus, white-balance and still-photo fill-light controls. Settings includes supported stream-resolution requests and the accepted dimensions. Front-camera mirroring applies consistently to preview and output. Tap-to-focus is deliberately absent because no reliable points-of-interest workflow has been verified across the supported browser APIs.

Imported JPEG/PNG/WebP files use the same GPU pipeline. Unsupported cameras, denied permissions, and missing WebGL2 have explicit fallbacks. In the no-WebGL2 fallback only original capture is supported.

## LUT assets

```powershell
npm run import:luts -- "C:/Users/edric/Downloads/LUTs"
```

The importer reads extracted files and safe ZIP entries, validates 3D cube data, hashes/deduplicates content, preserves originals, and emits `public/luts/manifest.json` plus `lut-import-report.json`. The current library contains **212 unique cube files: 138 creative looks and 74 technical variants**. Four distinct `.3dl` files and their ZIP copies are reported as unsupported, with `.cube` alternatives imported.

Fujifilm log transforms are listed separately and cannot be selected for ordinary camera frames. Creative LUT input spaces are not specified by their metadata; the app explicitly uses display-referred browser RGB as an assumption. This is not a calibrated native camera or Fujifilm color emulation guarantee. Source comments and attribution remain in the cube assets. No blanket public redistribution license was found; the supplied deployment stays owner-private. Review the vendors' terms before making the library public or repackaging it commercially.

LUTs are fetched lazily. Only selected looks are stored in the bounded offline LUT cache (16 entries). The library uses bundled thumbnails of one fixed landscape photograph, graded at 100% with each real LUT. They appear before camera permission, never use camera/imported images, and are cached with the app shell. Run `npm run previews:luts` to regenerate them; importing LUTs also runs this step. Attribution is in `public/REFERENCE.md`. New Freepresets LUTs are bundled in `public/lutsv2`; existing LUTs remain in `public/luts`. Selecting a look loads it directly from the app, with no manual file download or import. Offline use still requires a previously cached look.

The Freepresets import added 120 distinct looks from 166 downloaded archives and skipped 46 duplicate transforms (including an extensionless Dusk LUT). See `freepresets-import-report.json` for the audit. Duplicate detection compares parsed grid size, domain and numerical samples, so renamed files are also skipped. To merge another archive folder without replacing the library, run `npx tsx scripts/merge-luts.ts <archive-directory>` followed by `npm run previews:luts`. The original `import:luts` command replaces the catalog. Vendor thumbnails could not be retrieved (HTTP 403), so these looks use the user-supplied mountain reference.

## Architecture

- `components/Camera.tsx`: camera lifecycle, capability-driven controls, comparison state, gallery, install/update UI.
- `lib/cube.ts`: strict cube parser, CPU reference sampler, crop geometry.
- `lib/renderer.ts`: WebGL2 3D texture with trilinear interpolation and shared photo rendering. RGB-red-fastest cube ordering, domain mapping and half-float texture storage preserve out-of-range intermediate LUT values until final output clamping.
- `lib/storage.ts`: IndexedDB photos with transaction completion/error handling.
- `scripts/import-luts.ts`: asset ingest, ZIP path validation, provenance and manifest.
- `scripts/offline.mjs`: app-shell precache and bounded selected-LUT cache. Updates wait for the user to apply them.

The renderer follows video frame callbacks with an animation-frame scheduling fallback and preserves the full source crop resolution without a 1440px cap or frame-rate-driven reductions. The camera requests its advertised maximum stream dimensions and native resize mode where supported; settings shows the actual accepted dimensions. Captures request maximum `ImageCapture` still dimensions, retry default still settings if needed, then fall back to a video frame. Preview/export dimensions are bounded only by the device's WebGL renderbuffer limit. Different browser still/video processing can cause differences in exposure, color, field of view or resolution; the app uses identical grading, center crop and mirroring but cannot override a device's ISP. Browser camera quality is not guaranteed to equal a native camera app. No video recording, RAW, fabricated optical lens controls, or backend photo synchronization is included.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
# In a second terminal:
npm run test:browser
```

Browser tests use installed Microsoft Edge in headless mode with a **synthetic camera and software GPU**. They cover actual GPU channel order/orientation, LUT intensity endpoints, preview/export equivalence, live stream advancement, comparison restore, graded capture during original preview, cancelable timer, IndexedDB persistence, photo import, offline shell, unavailable controls, keyboard focus, mobile widths, and error recovery. They do not establish physical-device compatibility or mobile performance.

Real iOS Safari/Android Chrome hardware, physical camera switching, torch/flash/exposure/focus/white-balance controls, standalone install behavior, device thermal limits, and platform share sheets **have not been verified on physical devices**. Use the measured preview FPS in the adjustments drawer on each device; the 30fps goal is not a universal guarantee.
# cam
