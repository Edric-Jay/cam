# Verification — 17 November 2026

## User-supplied reference photo update

- Replaced the reference with the user's `images.jpg`; generated 19 versioned WebP thumbnails (Original plus 18 graded looks).
- Production builds now regenerate previews automatically. Offline-cache revisions include asset bytes, and the app exposes an update notice outside Settings.
- Production build, TypeScript and lint passed. Targeted browser tests passed for thumbnail loading before camera access, unchanged thumbnails after image import, offline thumbnail loading, and the existing capture/offline workflow.
- GitHub still points to the initial app commit `1243521`; the earlier fixed-thumbnail commit was not uploaded because the available Git account lacks write access. This is separate from the verified local build.

## Fixed-reference thumbnails and camera-quality update

- TypeScript, ESLint and production build passed.
- 7 unit tests passed; maximum-quality capability requests and unsupported-constraint recovery are covered.
- 11 browser tests passed in 21.8 seconds. New tests verify all 19 fixed reference thumbnails load before camera permission, remain unchanged after photo import, and that live preview canvas dimensions equal the full source crop and remain constant beyond the former automatic-downscaling interval.
- All creative thumbnails are generated from one bundled landscape photograph. They are included in the offline shell.
- Removed adaptive 1440-to-640px preview degradation and the fixed 8192px export cap. Browser/device and GPU limits still apply. Maximum still-photo dimensions are requested separately from video-stream dimensions.
- This update does not change the physical-device testing limitations below. The prior deployment archive predates this update; use `npm run build` for the current output.

## Initial build record

- TypeScript: passed.
- ESLint: passed with no warnings.
- Production Next.js static export and generated offline worker: passed.
- Dependency audit: zero reported vulnerabilities at installation.
- Unit tests: 5 passed (cube parsing, channel ordering/interpolation, strength endpoints, domain validation, crop geometry).
- Browser tests: 9 passed in 14.1 seconds on headless Microsoft Edge, synthetic camera, software WebGL2.
- Mobile layout widths: 320, 390, 430px; landscape 844 × 390px.
- Browser coverage: moving video, LUT/original switching, actual GPU pixels, JPEG grading, gallery persistence, timer cancellation, import and camera resumption, offline reload, permission denial, storage failure/download recovery, unavailable LUT fallback, rejected hardware constraints, accessible dialog focus, and share/download fallback.
- Local deployment archive created: `../camlut-deploy.tar.gz` (68,165,643 bytes).
- Publication: not performed. Automatic approval review blocked the external private-repository push pending explicit user authorization. A private, unpublished Sites record has been created; no successful code push or app deployment occurred.

Physical iOS/Android hardware, native camera controls, mobile FPS/thermal behavior, installed-PWA lifecycle, physical lens switching, and platform share sheets have not been tested. The app exposes only capabilities reported by the current camera; automated synthetic-camera tests do not validate every vendor's implementation.

Source files are in this folder. Build output is in `out/`. Run `npm start` from this folder to serve the completed build at http://localhost:3000, or `npm run dev` for development. Mobile camera access requires an HTTPS origin.
