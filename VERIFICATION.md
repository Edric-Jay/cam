# Verification — 17 November 2026

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
