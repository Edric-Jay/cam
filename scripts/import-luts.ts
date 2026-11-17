import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { parseCube } from "../lib/cube";
const source = path.resolve(process.argv[2] || "../import-luts");
const output = path.resolve("public/luts");
const staging = path.resolve(".staging");
await fs.mkdir(output, { recursive: true });
await fs.mkdir(staging, { recursive: true });
const report: { file: string; status: string }[] = [];
const seen = new Map<string, Record<string, unknown>>();
async function ingest(file: string, bytes: Uint8Array) {
  if (!/\.cube$/i.test(file)) {
    if (/\.3dl$/i.test(file))
      report.push({ file, status: "Unsupported .3dl; use matching .cube" });
    return;
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (seen.has(hash)) {
    (seen.get(hash)!.sources as string[]).push(file);
    return;
  }
  try {
    const cube = parseCube(new TextDecoder().decode(bytes));
    const technical = /f-?log/i.test(file);
    const name = (
      cube.title || path.basename(file).replace(/\.cube$/i, "")
    ).replace(/^Presetpro\s*-\s*/i, "").replace(/\.(jpe?g|png)$/i, "");
    const id = hash.slice(0, 20);
    await fs.writeFile(path.join(output, `${id}.cube`), bytes);
    seen.set(hash, {
      id,
      name,
      url: `/luts/${id}.cube`,
      bytes: bytes.length,
      hash,
      gridSize: cube.size,
      category: technical ? "technical" : "creative",
      input: technical
        ? "Matching Fujifilm log/gamut required"
        : "Unspecified by vendor; display RGB assumption",
      output: "Vendor-defined; verify against reference",
      sources: [file],
      attribution: technical
        ? "Fujifilm"
        : "Original LUT creator; see source metadata",
      compatibility: technical ? "requires-log" : "unverified-display-rgb",
    });
  } catch (e) {
    report.push({ file, status: String(e) });
  }
}
function ignore(p: string) {
  return p
    .split(/[\\/]/)
    .some((s) => s === "__MACOSX" || s === ".DS_Store" || s.startsWith("._"));
}
async function walk(dir: string) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (ignore(full)) continue;
    if (entry.isDirectory()) {
      await walk(full);
      continue;
    }
    if (entry.isSymbolicLink()) continue;
    const rel = path.relative(source, full);
    if (/\.zip$/i.test(full)) {
      try {
        const bytes = await fs.readFile(full);
        const archive = unzipSync(bytes, {
          filter: (f) =>
            /\.(cube|3dl)$/i.test(f.name) &&
            !ignore(f.name) &&
            f.originalSize < 30_000_000,
        });
        for (const [name, data] of Object.entries(archive)) {
          const dest = path.resolve(
            staging,
            createHash("sha256").update(rel).digest("hex").slice(0, 12),
            name,
          );
          if (
            !dest.startsWith(staging + path.sep) ||
            /^[a-z]:|^[/\\]|(^|[/\\])\.\.([/\\]|$)/i.test(name)
          ) {
            report.push({
              file: `${rel}!${name}`,
              status: "Unsafe archive path rejected",
            });
            continue;
          }
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.writeFile(dest, data);
          await ingest(`${rel}!${name}`, data);
        }
      } catch (e) {
        report.push({ file: rel, status: `Archive failed: ${e}` });
      }
    } else if (/\.(cube|3dl)$/i.test(full))
      await ingest(rel, await fs.readFile(full));
  }
}
await walk(source);
const manifest = [...seen.values()].sort((a, b) =>
  String(a.name).localeCompare(String(b.name)),
);
await fs.writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
await fs.writeFile(
  "lut-import-report.json",
  JSON.stringify(
    {
      source,
      imported: manifest.length,
      creative: manifest.filter((x) => x.category === "creative").length,
      report,
    },
    null,
    2,
  ),
);
console.log(
  `Imported ${manifest.length} unique LUTs (${manifest.filter((x) => x.category === "creative").length} creative); ${report.length} report entries.`,
);
