"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Aperture,
  ArrowDownToLine,
  Camera as CameraIcon,
  Check,
  ChevronDown,
  Circle,
  Download,
  Eye,
  EyeOff,
  Flashlight,
  FlipHorizontal2,
  Grid3X3,
  ImagePlus,
  Images,
  Info,
  Maximize,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Timer,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { parseCube, type Cube } from "@/lib/cube";
import { Renderer, renderPhoto } from "@/lib/renderer";
import { requestMaximumQuality } from "@/lib/camera-quality";
import { getPhotos, savePhoto, deletePhoto, type Photo } from "@/lib/storage";
type Look = {
  id: string;
  name: string;
  url: string;
  category: string;
  gridSize: number;
  input: string;
  bytes: number;
  compatibility: string;
};
type Range = { min: number; max: number; step?: number };
type Caps = Record<string, Range | string[] | boolean[] | undefined>;
type Settings = Record<string, string | number | boolean | undefined>;
type CaptureApi = {
  takePhoto: (options?: {fillLightMode?:string;imageWidth?:number;imageHeight?:number}) => Promise<Blob>;
  getPhotoCapabilities?: () => Promise<{ fillLightMode?: string[];imageWidth?:Range;imageHeight?:Range }>;
};
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const cubeCache = new Map<string, Cube>();
async function loadCube(look: Look, previewOnly=false) {
  if (previewOnly && cubeCache.has(look.id)) return cubeCache.get(look.id)!;
  const response = await fetch(look.url+(previewOnly?'?preview=1':'')).catch(()=>{throw new Error('This look is not downloaded. Connect to download it.');});
  if (!response.ok)
    throw new Error("This look is not downloaded. Connect to download it.");
  const sourceText = await response.text();
  const cube = parseCube(sourceText);
  if(!previewOnly&&'caches'in window){try{const cache=await caches.open('camlut-looks-v1');await cache.put(look.url,new Response(sourceText,{headers:{'Content-Type':'text/plain'}}));const keys=await cache.keys();if(keys.length>16)await cache.delete(keys[0]);}catch{/* Capture works even if offline storage is unavailable. */}}
  if (cubeCache.size >= 8) cubeCache.delete(cubeCache.keys().next().value!);
  cubeCache.set(look.id, cube);
  return cube;
}
function IconButton({
  label,
  children,
  onClick,
  active,
  disabled = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""} ${className}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
function PhotoTile({ photo, onClick }: { photo: Photo; onClick: () => void }) {
  const url = useBlobUrl(photo.blob);
  return (
    <button
      className="photo-tile"
      onClick={onClick}
      aria-label={`Open ${photo.look} photo`}
    >
      <img
        src={url || undefined}
        alt={`${photo.look}, ${new Date(photo.created).toLocaleDateString()}`}
      />
      <span>{photo.look}</span>
    </button>
  );
}
const ratioValues = [3 / 4, 1, 9 / 16];
const ratioLabels = ["4:3", "1:1", "16:9"];
export default function Camera() {
  const video = useRef<HTMLVideoElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    stream = useRef<MediaStream | null>(null),
    bitmap = useRef<ImageBitmap | null>(null),
    engine = useRef<Renderer | null>(null),
    cube = useRef<Cube | null>(null),
    generation = useRef(0),
    countdownCancel = useRef(false),
    constraintQueue = useRef(Promise.resolve());
  const [ready, setReady] = useState(false),
    [starting, setStarting] = useState(false),
    [gpu, setGpu] = useState(true),
    [imported, setImported] = useState(false),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [caps, setCaps] = useState<Caps>({}),
    [settings, setSettings] = useState<Settings>({}),
    [manifest, setManifest] = useState<Look[]>([]),
    [lookId, setLookId] = useState("default"),
    [strength, setStrength] = useState(80),
    [original, setOriginal] = useState(false),
    [grid, setGrid] = useState(false),
    [ratio, setRatio] = useState(0),
    [timer, setTimer] = useState(0),
    [countdown, setCountdown] = useState(0),
    [busy, setBusy] = useState(false),
    [loadingLook, setLoadingLook] = useState(false),
    [panel, setPanel] = useState<
      "looks" | "adjust" | "gallery" | "settings" | null
    >(null),
    [photos, setPhotos] = useState<Photo[]>([]),
    [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [favorites, setFavorites] = useState<string[]>([]),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [offline, setOffline] = useState(false),
    [downloaded, setDownloaded] = useState<string[]>([]),
    [install, setInstall] = useState<InstallEvent | null>(null),
    [update, setUpdate] = useState<ServiceWorker | null>(null),
    [mirror, setMirror] = useState(true),
    [prefsReady, setPrefsReady] = useState(false),
    [portrait, setPortrait] = useState(true),
    [fps, setFps] = useState<number | null>(null),
    [fillLightModes,setFillLightModes]=useState<string[]>([]),
    [fillLight,setFillLight]=useState('off');
  const selectedLook = manifest.find((x) => lookId==='default'?x.name==='Portra':x.id === lookId);
  const lookName = selectedLook?.name || "Original";
  const thumbnails: Record<string,string> = Object.fromEntries([["original","/look-previews/original.webp"], ...manifest.filter(l=>l.category==="creative").map(l=>[l.id,`/look-previews/${l.id}.webp`])]);
  const aspect = portrait ? ratioValues[ratio] : 1 / ratioValues[ratio];
  const isMirrored = !imported && settings.facingMode === "user" && mirror;
  const latest = useRef({
    ready,
    imported,
    aspect,
    strength,
    original,
    isMirrored,
  });
  latest.current = { ready, imported, aspect, strength, original, isMirrored };
  const latestUrl = useBlobUrl(photos[0]?.blob),
    photoUrl = useBlobUrl(selectedPhoto?.blob);
  useEffect(()=>{if(!panel&&!selectedPhoto)return;const prior=document.activeElement as HTMLElement|null;const dialogs=document.querySelectorAll<HTMLElement>('[role="dialog"]');const dialog=dialogs[dialogs.length-1];const targets=()=>Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary')).filter(el=>el.getClientRects().length>0);targets()[0]?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();if(selectedPhoto)setSelectedPhoto(null);else setPanel(null);}if(e.key==='Tab'){const items=targets(),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);prior?.focus();};},[panel,selectedPhoto]);
  const syncTrack = useCallback(() => {
    const track = stream.current?.getVideoTracks()[0];
    setCaps((track?.getCapabilities?.() || {}) as Caps);
    setSettings((track?.getSettings?.() || {}) as Settings);
  }, []);
  const stop = useCallback(() => {
    generation.current++;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setReady(false);
    setCaps({});
    setSettings({});
    setFillLightModes([]);setFillLight('off');
  }, []);
  const refreshDownloaded = useCallback(async () => {
    if (!("caches" in window)) return;
    try {
      const keys = await caches.keys();
      const urls = new Set<string>();
      for (const key of keys.filter((k) => k.startsWith("camlut-"))) {
        const cache = await caches.open(key);
        for (const req of await cache.keys())
          urls.add(new URL(req.url).pathname);
      }
      setDownloaded(manifest.filter((l) => urls.has(l.url)).map((l) => l.id));
    } catch {
      /* Cache access is optional. */
    }
  }, [manifest]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("camlut-preferences") || "{}",
      );
      if (typeof saved.lookId === "string") setLookId(saved.lookId);
      if (typeof saved.strength === "number")
        setStrength(Math.max(0, Math.min(100, saved.strength)));
      if (Array.isArray(saved.favorites))
        setFavorites(
          saved.favorites.filter((x: unknown) => typeof x === "string"),
        );
      setMirror(saved.mirror !== false);
    } catch {}
    setPrefsReady(true);
    getPhotos()
      .then((p) => setPhotos(p.sort((a, b) => b.created - a.created)))
      .catch(() =>
        setMessage(
          "Local gallery is unavailable. Captures can still be downloaded.",
        ),
      );
    fetch("/luts/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setManifest)
      .catch(() =>
        setError(
          "The look library could not load. Original capture is still available.",
        ),
      );
    const media = matchMedia("(orientation: portrait), (min-height: 601px)");
    const orient = () => setPortrait(media.matches);
    orient();
    media.addEventListener("change", orient);
    const connection = () => setOffline(!navigator.onLine);
    connection();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    const before = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", before);
    return () => {
      media.removeEventListener("change", orient);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("beforeinstallprompt", before);
      stream.current?.getTracks().forEach((t) => t.stop());
      bitmap.current?.close();
    };
  }, []);
  useEffect(() => {
    if (prefsReady)
      try {
        localStorage.setItem(
          "camlut-preferences",
          JSON.stringify({ lookId, strength, favorites, mirror }),
        );
      } catch {}
  }, [prefsReady, lookId, strength, favorites, mirror]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.waiting) setUpdate(reg.waiting);
          reg.addEventListener("updatefound", () => {
            reg.installing?.addEventListener("statechange", () => {
              if (reg.waiting && navigator.serviceWorker.controller)
                setUpdate(reg.waiting);
            });
          });
        })
        .catch(() =>
          setMessage("Offline installation unavailable in this browser."),
        );
    }
  }, []);
  useEffect(() => {
    void refreshDownloaded();
  }, [refreshDownloaded, offline, loadingLook]);
  useEffect(() => {
    let canceled = false;
    if (!selectedLook) {
      cube.current = null;
      engine.current?.setCube(null);
      setLoadingLook(false);
      return;
    }
    setLoadingLook(true);
    loadCube(selectedLook)
      .then((c) => {
        if (canceled) return;
        cube.current = c;
        engine.current?.setCube(c);
        setLoadingLook(false);
      })
      .catch((e) => {
        if (canceled) return;
        setError(e.message);
        setLookId("");
        setLoadingLook(false);
      });
    return () => {
      canceled = true;
    };
  }, [selectedLook]);
  useEffect(() => {
    let dead = false,
      raf = 0,
      vfc = 0,
      last = performance.now(),
      frames = 0;
    let frameDirty = true, previousRecipe = '', previousCube: Cube | null = null;
    const c = canvas.current!,
      v = video.current!;
    try {
      engine.current = new Renderer(c);
      engine.current.setCube(cube.current);
    } catch (e) {
      setGpu(false);
      setError((e as Error).message);
      setLookId("");
    }
    const onFrame = () => { if (dead) return; frameDirty = true; vfc = v.requestVideoFrameCallback(onFrame); };
    if ('requestVideoFrameCallback' in v) vfc = v.requestVideoFrameCallback(onFrame);
    const render = () => {
      if (dead) return;
      const s = latest.current;
      const src = s.imported ? bitmap.current : v;
      const width = s.imported ? bitmap.current?.width : v.videoWidth,
        height = s.imported ? bitmap.current?.height : v.videoHeight;
      const recipe = `${s.ready}:${s.imported}:${s.aspect}:${s.original}:${s.strength}:${s.isMirrored}`;
      const changed = recipe !== previousRecipe || previousCube !== cube.current;
      if (s.ready && src && width && height && engine.current && (s.imported || frameDirty || changed || !('requestVideoFrameCallback' in v))) {
        try {
          engine.current.draw(
            src,
            width,
            height,
            s.aspect,
            s.original ? 0 : s.strength / 100,
            s.isMirrored,
            Infinity,
          );
          previousRecipe = recipe; previousCube = cube.current;
          if (frameDirty) frames++;
          frameDirty = false;
          const now = performance.now();
          if (now - last > 2500) {
            const measured = Math.round((frames * 1000) / (now - last));
            if (!s.imported) {
              setFps(measured);
            }
            frames = 0;
            last = now;
          }
        } catch {
          setError(
            "The color renderer stopped. Reload to recover, or capture an original.",
          );
          engine.current = null;
          setGpu(false);
          setLookId("");
        }
      }
      raf = requestAnimationFrame(render);
    };
    render();
    const lost = (e: Event) => {
      e.preventDefault();
      setError(
        "Graphics context lost. Reload the app to restore LUT rendering.",
      );
      setGpu(false);
      setLookId("");
    };
    c.addEventListener("webglcontextlost", lost);
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      if (vfc) v.cancelVideoFrameCallback(vfc);
      c.removeEventListener("webglcontextlost", lost);
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && stream.current) {
        countdownCancel.current = true;
        stop();
        setMessage("Camera paused. Tap the camera icon to resume.");
      }
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [stop]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 6500);
    return () => clearTimeout(id);
  }, [message]);
  const start = async (deviceId?: string) => {
    if (starting || busy) return;
    setStarting(true);
    setError("");
    stop();
    const token = generation.current;
    try {
      if (!window.isSecureContext)
        throw new Error(
          "Camera access requires HTTPS or localhost. Open a secure URL, or import a photo.",
        );
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "This browser does not expose camera access. Try Safari or Chrome, or import a photo.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: "environment" } }),
          width: { ideal: 7680 },
          height: { ideal: 4320 },
        },
      });
      if (token !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      await requestMaximumQuality(media.getVideoTracks()[0]);
      if (token !== generation.current) { media.getTracks().forEach(t=>t.stop()); return; }
      stream.current = media;
      bitmap.current?.close();
      bitmap.current = null;
      setImported(false);
      video.current!.srcObject = media;
      await video.current!.play();
      if (token !== generation.current) return;
      syncTrack();
      const track=media.getVideoTracks()[0];
      track.addEventListener('ended',()=>{if(stream.current?.getVideoTracks()[0]===track){stop();setError('The camera disconnected. Reconnect it or import a photo.');}});
      const PhotoCapture=(window as unknown as {ImageCapture?:new(t:MediaStreamTrack)=>CaptureApi}).ImageCapture;
      if(PhotoCapture){try{const photoCaps=await new PhotoCapture(track).getPhotoCapabilities?.();if(token===generation.current){const modes=photoCaps?.fillLightMode||[];setFillLightModes(modes);setFillLight(modes.includes('off')?'off':modes[0]||'off');}}catch{}}
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === "videoinput",
        ),
      );
      setReady(true);
      setFps(null);
    } catch (e) {
      const err = e as Error;
      const messages: Record<string, string> = {
        NotAllowedError:
          "Camera permission was denied. Allow access in browser settings, then try again.",
        NotFoundError:
          "No camera was found. Connect a camera or import a photo.",
        NotReadableError:
          "Your camera may be in use by another app. Close it and retry.",
        OverconstrainedError:
          "This camera could not use the requested settings. Choose another camera.",
      };
      setError(messages[err.name] || err.message);
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    } finally {
      setStarting(false);
    }
  };
  const importImage = async (file?: File) => {
    if(busy)return;
    if (!file) return;
    setError("");
    try {
      const image = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      if (!image.width || !image.height) {
        image.close();
        throw new Error("Unsupported image");
      }
      stop();
      bitmap.current?.close();
      bitmap.current = image;
      setImported(true);
      setReady(true);
      setMessage("Photo imported. Choose a look, then capture to save.");
    } catch {
      setError("Could not open that photo. Try a JPEG, PNG, or WebP image.");
    }
    if (fileInput.current) fileInput.current.value = "";
  };
  const adjust = (key: string, value: string | number | boolean) => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    constraintQueue.current = constraintQueue.current.then(async () => {
      if (stream.current?.getVideoTracks()[0] !== track) return;
      try {
        let v = value;
        const range = caps[key];
        if (typeof value === "number" && range && !Array.isArray(range)) {
          v = Math.min(range.max, Math.max(range.min, value));
        }
        await track.applyConstraints({
          advanced: [{ [key]: v } as MediaTrackConstraintSet],
        });
        syncTrack();
      } catch {
        setError(
          "The camera could not apply that adjustment. Your preview is still active.",
        );
        syncTrack();
      }
    });
  };
  const setResolution=(width:number)=>{const track=stream.current?.getVideoTracks()[0];if(!track)return;constraintQueue.current=constraintQueue.current.then(async()=>{if(stream.current?.getVideoTracks()[0]!==track)return;try{await track.applyConstraints({width:{ideal:width},height:{ideal:Math.round(width*3/4)}});syncTrack();}catch{setError('This resolution is unavailable. The current stream is unchanged.');}});};
  const capture = async () => {
    if (!ready || busy || loadingLook) return;
    setBusy(true);
    countdownCancel.current = false;
    const recipe = {
      cube: cube.current,
      strength: strength / 100,
      aspect,
      mirror: isMirrored,
      name: lookName,
      fillLight,
    };
    try {
      for (let n = timer; n > 0; n--) {
        setCountdown(n);
        await new Promise((r) => setTimeout(r, 1000));
        if (countdownCancel.current) return;
      }
      setCountdown(0);
      let source: ImageBitmap;
      const track = stream.current?.getVideoTracks()[0];
      const constructor = (
        window as unknown as {
          ImageCapture?: new (t: MediaStreamTrack) => CaptureApi;
        }
      ).ImageCapture;
      if (!imported && track && constructor) {
        try {
          const photoCamera = new constructor(track);
          const photoCaps = await photoCamera.getPhotoCapabilities?.().catch(()=>undefined);
          const light = fillLightModes.length ? {fillLightMode:recipe.fillLight} : {};
          const raw = await photoCamera.takePhoto({...light,...(photoCaps?.imageWidth?.max?{imageWidth:photoCaps.imageWidth.max}:{}),...(photoCaps?.imageHeight?.max?{imageHeight:photoCaps.imageHeight.max}:{})}).catch(()=>photoCamera.takePhoto(light));
          source = await createImageBitmap(raw, {
            imageOrientation: "from-image",
          });
        } catch {
          source = await createImageBitmap(video.current!);
        }
      } else
        source = await createImageBitmap(
          imported ? bitmap.current! : video.current!,
        );
      let blob: Blob;
      try {
        blob = await renderPhoto(
          source,
          source.width,
          source.height,
          recipe.cube,
          recipe.strength,
          recipe.aspect,
          recipe.mirror,
        );
      } finally {
        source.close();
      }
      const encoded=await createImageBitmap(blob);const dims={width:encoded.width,height:encoded.height};encoded.close();
      const photo: Photo = {
        id: crypto.randomUUID(),
        created: Date.now(),
        blob,
        look: recipe.name,
        width: dims.width,
        height: dims.height,
      };
      setPhotos((p) => [photo, ...p]);
      try {
        await savePhoto(photo);
        setMessage("Saved to your local gallery.");
      } catch {
        setSelectedPhoto(photo);
        setError(
          "Device storage is full or unavailable. Download this photo now; it is only in memory.",
        );
      }
    } catch (e) {
      setError(`Capture failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setCountdown(0);
    }
  };
  const download = (photo: Photo) => {
    const a = document.createElement("a");
    const url = URL.createObjectURL(photo.blob);
    a.href = url;
    a.download = `camlut-${photo.id}.jpg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  const share = async (photo: Photo) => {
    const file = new File([photo.blob], `camlut-${photo.id}.jpg`, {
      type: "image/jpeg",
    });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setMessage("Sharing unavailable. Downloading instead.");
          download(photo);
        }
      }
    } else download(photo);
  };
  const removePhoto = async (photo: Photo) => {
    try {
      await deletePhoto(photo.id);
      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      setSelectedPhoto(null);
      setMessage("Photo deleted from this device.");
    } catch {
      setError("Could not delete this photo. Try again.");
    }
  };
  const favorite = (id: string) =>
    setFavorites((f) =>
      f.includes(id) ? f.filter((x) => x !== id) : [...f, id],
    );
  const visibleLooks = manifest.filter(
    (l) =>
      l.category === "creative" &&
      l.name.toLowerCase().includes(search.toLowerCase()) &&
      (!onlyFavorites || favorites.includes(l.id)),
  );
  const rangeControl = (
    key: string,
    label: string,
    unit = "",
    mode?: string,
  ) => {
    const r = caps[key];
    if (
      !r ||
      Array.isArray(r) ||
      r.min === r.max ||
      (mode && settings[mode] !== "manual")
    )
      return null;
    return (
      <label className="range-field" key={key}>
        <span>
          {label}
          <output>
            {String(settings[key] ?? r.min)}
            {unit}
          </output>
        </span>
        <input
          aria-label={label}
          type="range"
          min={r.min}
          max={r.max}
          step={r.step || (r.max - r.min) / 100}
          value={Number(settings[key] ?? r.min)}
          onChange={(e) => adjust(key, Number(e.target.value))}
        />
      </label>
    );
  };
  const modeControl = (key: string, label: string) => {
    const modes = caps[key];
    return Array.isArray(modes) && modes.length > 1 ? (
      <label className="select-field" key={key}>
        {label}
        <select
          value={String(settings[key] || modes[0])}
          onChange={(e) => adjust(key, e.target.value)}
        >
          {modes.map((m) => (
            <option key={String(m)} value={String(m)}>
              {String(m)}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  };
  return (
    <main className="studio">
      <header className="desktop-header">
        <div className="wordmark">
          <Aperture size={22} />
          camlut<span>COLOR STUDIO</span>
        </div>
        <span className="private-note">
          <span className="status-dot" />
          On your device. In your moment.
        </span>
      </header>
      <div className="camera-shell">
        <header className="camera-top">
          <div className="mobile-wordmark">
            <Aperture size={19} />
            <span>camlut</span>
          </div>
          <div className="top-controls">
            {Array.isArray(caps.torch) && caps.torch.some(value => value === true) && (
              <IconButton
                label="Toggle torch"
                active={settings.torch === true}
                onClick={() => adjust("torch", !settings.torch)}
              >
                <Flashlight />
              </IconButton>
            )}
            <IconButton
              label={`Timer: ${timer ? `${timer} seconds` : "off"}`}
              active={timer > 0}
              onClick={() => setTimer((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))}
            >
              <Timer />
              {timer > 0 && <small>{timer}</small>}
            </IconButton>
            <IconButton
              label="Toggle thirds grid"
              active={grid}
              onClick={() => setGrid(!grid)}
            >
              <Grid3X3 />
            </IconButton>
            <IconButton
              label={`Aspect ratio ${ratioLabels[ratio]}`}
              onClick={() => setRatio((ratio + 1) % 3)}
            >
              <Maximize />
              <small>{ratioLabels[ratio]}</small>
            </IconButton>
            <IconButton
              label="Settings"
              active={panel === "settings"}
              onClick={() => setPanel("settings")}
            >
              <Settings2 />
            </IconButton>
          </div>
        </header>
        <section
          className={`viewfinder ${ready ? "is-live" : ""}`}
          style={{ aspectRatio: aspect, ['--frame-aspect' as string]: aspect }}
          aria-label="Camera viewfinder"
        >
          <video
            ref={video}
            muted
            playsInline
            className={gpu ? "source-video" : "fallback-video"}
            style={{ transform: isMirrored ? "scaleX(-1)" : undefined }}
          />
          <canvas
            ref={canvas}
            aria-label="Live color-graded preview"
            className={ready && gpu ? "" : "hidden-canvas"}
          />
          {!gpu && imported && <ImportedPreview bitmap={bitmap.current} />}
          {grid && (
            <div className="thirds" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {ready && (
            <div className="view-status">
              <span className="live-pill">
                <span />
                {imported ? "PHOTO" : "LIVE"}
              </span>
              <span>
                {offline ? <WifiOff size={15} /> : <Circle size={10} />}{" "}
                {loadingLook
                  ? "Loading look"
                  : original
                    ? "Original"
                    : lookName}
              </span>
            </div>
          )}
          {!ready && (
            <div className="camera-empty">
              <div className="lens-mark">
                <Aperture size={56} strokeWidth={1} />
                <span />
              </div>
              <span className="eyebrow">
                A LITTLE COLOR. A DIFFERENT FEELING.
              </span>
              <h1>See it your way.</h1>
              <p>
                Your camera, with the colors you love.
                <br />
                Live looks. Real moments. All yours.
              </p>
              <button
                className="start-camera"
                onClick={() => void start()}
                disabled={starting}
                aria-label="Start camera"
                title="Start camera"
              >
                {starting ? (
                  <span className="spinner" />
                ) : (
                  <CameraIcon size={27} />
                )}
              </button>
              <span className="start-hint">
                {starting ? "Opening camera…" : "Tap to open your camera"}
              </span>
              <button
                className="import-link"
                onClick={() => fileInput.current?.click()}
                aria-label="Import a photo"
                title="Import a photo"
              >
                <ImagePlus size={19} />
              </button>
            </div>
          )}
          {ready && (
            <div className="view-bottom">
              <span className="ratio-label">
                {ratioLabels[ratio]} <span>•</span>{" "}
                {imported
                  ? "IMPORTED"
                  : settings.width
                    ? `${settings.width} × ${settings.height}`
                    : "CAMERA"}
              </span>
              <IconButton
                className="compare"
                label={
                  original ? "Return to selected look" : "Preview original"
                }
                active={original}
                onClick={() => setOriginal(!original)}
              >
                {original ? <EyeOff /> : <Eye />}
              </IconButton>
            </div>
          )}
          {countdown > 0 && (
            <button
              className="countdown"
              aria-label="Cancel countdown"
              onClick={() => {
                countdownCancel.current = true;
                setCountdown(0);
              }}
            >
              {countdown}
              <span>Tap to cancel</span>
            </button>
          )}
          {original && ready && (
            <div className="original-banner">
              Original preview · capture uses selected look
            </div>
          )}
        </section>
        <section className="capture-deck">
          <div className="look-line">
            <button
              className="current-look"
              onClick={() => setPanel("looks")}
              aria-label={`Choose look. Current: ${lookName}`}
            >
              <span className="look-symbol">
                <Sparkles size={18} />
              </span>
              <span>
                <small>YOUR LOOK</small>
                <strong>{lookName}</strong>
              </span>
              <ChevronDown size={16} />
            </button>
            <IconButton
              label="Camera adjustments"
              active={panel === "adjust"}
              onClick={() => setPanel("adjust")}
            >
              <SlidersHorizontal />
            </IconButton>
          </div>
          <label className="strength-control">
            <span>
              Intensity<output>{strength}%</output>
            </span>
            <input
              type="range"
              aria-label="LUT intensity"
              min="0"
              max="100"
              value={strength}
              disabled={!lookId || !gpu}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </label>
          <div className="capture-row">
            <IconButton
              label="Open local gallery"
              className="gallery-button"
              onClick={() => setPanel("gallery")}
            >
              {latestUrl ? (
                <img src={latestUrl} alt="Latest capture" />
              ) : (
                <Images size={24} />
              )}
            </IconButton>
            <button
              className={`shutter ${busy ? "busy" : ""}`}
              aria-label={imported ? "Save graded photo" : "Capture photo"}
              title={imported ? "Save graded photo" : "Capture photo"}
              disabled={!ready || busy || loadingLook}
              onClick={() => void capture()}
            >
              <span>{busy ? <span className="spinner" /> : null}</span>
            </button>
            {devices.length > 1 && !imported ? (
              <IconButton
                label="Switch camera"
                disabled={starting || busy}
                onClick={() => {
                  const index = devices.findIndex(
                    (d) => d.deviceId === settings.deviceId,
                  );
                  void start(devices[(index + 1) % devices.length].deviceId);
                }}
              >
                <FlipHorizontal2 size={25} />
              </IconButton>
            ) : (
              <IconButton
                label={imported ? "Return to camera" : "Import photo"}
                disabled={busy}
                onClick={() =>
                  imported ? void start() : fileInput.current?.click()
                }
              >
                {imported ? <CameraIcon size={24} /> : <ImagePlus size={24} />}
              </IconButton>
            )}
          </div>
          <div className="deck-footer">
            <span className="photo-mode">
              <span />
              PHOTO
            </span>
            <span>Made for the moment</span>
          </div>
        </section>
      </div>
      <footer className="desktop-footer">
        <span>REAL COLOR. NO COMPROMISE.</span>
        <span>
          Private by design <span>↗</span>
        </span>
      </footer>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="file-input"
        aria-label="Import photo file"
        onChange={(e) => void importImage(e.target.files?.[0])}
      />
      {(error || message) && (
        <div
          className={`toast ${error ? "error" : ""} ${selectedPhoto ? "photo-toast" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>{error || message}</span>
          <IconButton
            label="Dismiss notification"
            onClick={() => {
              setError("");
              setMessage("");
            }}
          >
            <X size={17} />
          </IconButton>
        </div>
      )}
      {panel && (
        <div className="sheet-backdrop" onClick={() => setPanel(null)}>
          <section
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "looks"
                ? "Look library"
                : panel === "adjust"
                  ? "Camera adjustments"
                  : panel === "gallery"
                    ? "Local gallery"
                    : "Settings"
            }
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPanel(null);
            }}
          >
            <div className="sheet-handle" />
            <header className="sheet-header">
              <div>
                <span className="eyebrow">COLOR STUDIO</span>
                <h2>
                  {panel === "looks"
                    ? "Find your feeling."
                    : panel === "adjust"
                      ? "Make it yours."
                      : panel === "gallery"
                        ? "Your moments."
                        : "A little fine-tuning."}
                </h2>
              </div>
              <IconButton label="Close panel" onClick={() => setPanel(null)}>
                <X />
              </IconButton>
            </header>
            {panel === "looks" && (
              <>
                <div className="search-row">
                  <label className="search">
                    <Search size={18} />
                    <input
                      placeholder="Find a look"
                      aria-label="Search LUT library"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <IconButton
                    label="Show favorites only"
                    active={onlyFavorites}
                    onClick={() => setOnlyFavorites(!onlyFavorites)}
                  >
                    <Star />
                  </IconButton>
                </div>
                <div className="library-note">
                  <span>{visibleLooks.length} creative looks</span>
                  <span>
                    {offline ? "Offline" : "Select a look to download"}
                  </span>
                </div>
                <div className="looks-grid">
                  {!onlyFavorites && !search && (
                    <button
                      className={`look-card ${!lookId ? "selected" : ""}`}
                      onClick={() => {
                        setLookId("");
                        setOriginal(false);
                      }}
                    >
                      <div className="look-art">
                        {thumbnails.original ? (
                          <img
                            src={thumbnails.original}
                            alt="Original preview"
                          />
                        ) : (
                          <Aperture size={28} />
                        )}
                        <span className="look-check">
                          {!lookId && <Check size={16} />}
                        </span>
                      </div>
                      <strong>Original</strong>
                      <small>No color grade</small>
                    </button>
                  )}
                  {visibleLooks.map((l) => (
                    <div
                      className={`look-card-wrap ${selectedLook?.id === l.id ? "selected" : ""}`}
                      key={l.id}
                    >
                      <button
                        className="look-card"
                        disabled={!gpu}
                        onClick={() => {
                          setLookId(l.id);
                          setOriginal(false);
                        }}
                      >
                        <div className="look-art">
                          {thumbnails[l.id] ? (
                            <img
                              src={thumbnails[l.id]}
                              alt={`${l.name} preview at full intensity`}
                            />
                          ) : (
                            <Aperture size={28} />
                          )}
                          <span className="look-check">
                            {selectedLook?.id === l.id ? (
                              <Check size={16} />
                            ) : downloaded.includes(l.id) ? (
                              <ArrowDownToLine size={14} />
                            ) : null}
                          </span>
                        </div>
                        <strong>{l.name}</strong>
                        <small>
                          {downloaded.includes(l.id)
                            ? "Downloaded"
                            : offline
                              ? "Needs connection"
                              : `${Math.round(l.bytes / 1024)} KB`}
                        </small>
                      </button>
                      <IconButton
                        label={`${favorites.includes(l.id) ? "Unfavorite" : "Favorite"} ${l.name}`}
                        active={favorites.includes(l.id)}
                        className="favorite"
                        onClick={() => favorite(l.id)}
                      >
                        <Star size={16} />
                      </IconButton>
                    </div>
                  ))}
                </div>
                {!visibleLooks.length && (
                  <p className="muted">
                    No matching looks. Try another search.
                  </p>
                )}
                <p className="sheet-note">
                  Creative LUTs use a display-RGB assumption; vendor input
                  spaces are unspecified. Every preview uses the same reference photograph at 100% intensity.
                </p>
                <details className="technical">
                  <summary>
                    {manifest.filter((l) => l.category === "technical").length}{" "}
                    technical camera transforms
                  </summary>
                  <p>
                    Fujifilm log transforms require matching log footage. They
                    are excluded from the live camera.
                  </p>
                  {manifest
                    .filter((l) => l.category === "technical")
                    .map((l) => (
                      <div key={l.id}>
                        {l.name}
                        <small>
                          {l.gridSize}³ · Requires matching log input
                        </small>
                      </div>
                    ))}
                </details>
              </>
            )}
            {panel === "adjust" && (
              <>
                <label className="range-field">
                  <span>
                    Look intensity<output>{strength}%</output>
                  </span>
                  <input
                    aria-label="Look intensity"
                    type="range"
                    min="0"
                    max="100"
                    value={strength}
                    disabled={!lookId}
                    onChange={(e) => setStrength(Number(e.target.value))}
                  />
                </label>
                {rangeControl("zoom", "Zoom")}
                {fillLightModes.length>1&&<label className="select-field">Photo fill light<select value={fillLight} onChange={e=>setFillLight(e.target.value)}>{fillLightModes.map(mode=><option key={mode} value={mode}>{mode}</option>)}</select></label>}
                {rangeControl(
                  "exposureCompensation",
                  "Exposure compensation",
                  " EV",
                )}
                {modeControl("exposureMode", "Exposure mode")}
                {rangeControl("iso", "ISO", "", "exposureMode")}
                {rangeControl(
                  "exposureTime",
                  "Exposure time",
                  " × 100µs",
                  "exposureMode",
                )}
                {modeControl("focusMode", "Focus mode")}
                {rangeControl(
                  "focusDistance",
                  "Focus distance",
                  " m",
                  "focusMode",
                )}
                {modeControl("whiteBalanceMode", "White balance")}
                {rangeControl(
                  "colorTemperature",
                  "Color temperature",
                  " K",
                  "whiteBalanceMode",
                )}
                <div className="info-block">
                  <Info size={19} />
                  <p>
                    Only controls supported by your active camera appear here.{" "}
                    {imported
                      ? "Hardware controls are unavailable for imported photos."
                      : !ready
                        ? "Open the camera to discover its controls."
                        : "Some browsers expose only basic camera controls."}
                  </p>
                </div>
                {ready && !imported && (
                  <div className="device-readout">
                    <span>Actual stream</span>
                    <strong>
                      {settings.width} × {settings.height}
                    </strong>
                    <span>Measured preview</span>
                    <strong>
                      {fps === null ? "Measuring…" : `${fps} fps`}
                    </strong>
                  </div>
                )}
              </>
            )}
            {panel === "gallery" && (
              <>
                <p className="sheet-note">
                  Stored in this browser. Download your favorites to keep them
                  safe; clearing site data removes this gallery.
                </p>
                {photos.length ? (
                  <div className="photos-grid">
                    {photos.map((p) => (
                      <PhotoTile
                        key={p.id}
                        photo={p}
                        onClick={() => setSelectedPhoto(p)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="gallery-empty">
                    <Images size={40} />
                    <h3>Your first moment is waiting.</h3>
                    <p>Photos you capture will appear here.</p>
                  </div>
                )}
              </>
            )}
            {panel === "settings" && (
              <>
                {caps.width&&!Array.isArray(caps.width)&&ready&&!imported&&<label className="select-field">Stream quality<select aria-label="Stream quality" value="" disabled={busy} onChange={e=>void setResolution(Number(e.target.value))}><option value="">Actual: {settings.width} × {settings.height}</option>{[640,1280,1920,2560].filter(w=>{const r=caps.width as Range;return w>=r.min&&w<=r.max;}).map(w=><option key={w} value={w}>Request {w}px wide</option>)}</select></label>}
                <label className="toggle-row">
                  <span>
                    Mirror front camera
                    <small>Preview and saved photo match.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={mirror}
                    onChange={(e) => setMirror(e.target.checked)}
                  />
                </label>
                {devices.length > 1 && (
                  <label className="select-field">
                    Camera
                    <select
                      value={String(settings.deviceId || "")}
                      disabled={busy || starting}
                      onChange={(e) => void start(e.target.value)}
                    >
                      {devices.map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="settings-action">
                  <span>
                    Import a photo<small>JPEG, PNG, WebP</small>
                  </span>
                  <IconButton
                    label="Import a photo"
                    onClick={() => {
                      setPanel(null);
                      fileInput.current?.click();
                    }}
                  >
                    <ImagePlus />
                  </IconButton>
                </div>
                <div className="settings-action">
                  <span>
                    Install Camlut
                    <small>
                      {install
                        ? "Add a dedicated camera to your home screen."
                        : "Use your browser menu → Add to Home Screen."}
                    </small>
                  </span>
                  {install && (
                    <IconButton
                      label="Install Camlut"
                      onClick={() =>
                        void install
                          .prompt()
                          .then(() => install.userChoice)
                          .then(() => setInstall(null))
                      }
                    >
                      <Download />
                    </IconButton>
                  )}
                </div>
                {update && (
                  <div className="settings-action">
                    <span>
                      Update available
                      <small>Reload when you finish capturing.</small>
                    </span>
                    <IconButton
                      label="Apply update and reload"
                      disabled={busy}
                      onClick={() => {
                        update.postMessage("SKIP_WAITING");
                        navigator.serviceWorker.addEventListener(
                          "controllerchange",
                          () => location.reload(),
                          { once: true },
                        );
                      }}
                    >
                      <Download />
                    </IconButton>
                  </div>
                )}
                <div className="info-block">
                  <Info size={19} />
                  <p>
                    Your images never leave this device unless you share them.
                    Offline mode keeps the app and downloaded looks available
                    after installation. Storage may be cleared by your browser.
                  </p>
                </div>
                <p className="sheet-note">
                  Camlut 1.0 · Still photography
                  <br />
                  LUTs retain their original creators’ attribution. Technical
                  transforms are not phone-camera filters.
                </p>
              </>
            )}
          </section>
        </div>
      )}
      {selectedPhoto && (
        <div
          className="photo-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Captured photo"
        >
          <header>
            <span>
              {selectedPhoto.look}
              <small>
                {selectedPhoto.width} × {selectedPhoto.height}
              </small>
            </span>
            <IconButton
              label="Close photo"
              onClick={() => setSelectedPhoto(null)}
            >
              <X />
            </IconButton>
          </header>
          <img
            src={photoUrl || undefined}
            alt={`Captured with ${selectedPhoto.look}`}
          />
          <footer>
            <IconButton
              label="Delete photo"
              onClick={() => {
                if (confirm("Delete this photo from the local gallery?"))
                  void removePhoto(selectedPhoto);
              }}
            >
              <Trash2 />
            </IconButton>
            <IconButton
              label="Download photo"
              onClick={() => download(selectedPhoto)}
            >
              <Download />
            </IconButton>
            <IconButton
              label="Share photo"
              onClick={() => void share(selectedPhoto)}
            >
              <Share2 />
            </IconButton>
          </footer>
        </div>
      )}
    </main>
  );
}
function ImportedPreview({ bitmap }: { bitmap: ImageBitmap | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (bitmap && ref.current) {
      ref.current.width = bitmap.width;
      ref.current.height = bitmap.height;
      ref.current.getContext("2d")?.drawImage(bitmap, 0, 0);
    }
  }, [bitmap]);
  return (
    <canvas
      ref={ref}
      className="fallback-image"
      aria-label="Original imported photo"
    />
  );
}
