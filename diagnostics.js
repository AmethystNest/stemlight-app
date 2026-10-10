// src/lab-access.js
function labAccess() {
  if (typeof location === "undefined") return { allowed: false, token: "" };
  if (["localhost", "127.0.0.1"].includes(location.hostname)) return { allowed: true, token: "" };
  const parts = location.hostname.split(".").map(Number), privateIP = parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) && (parts[0] === 10 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
  if (!privateIP || location.protocol !== "https:") return { allowed: false, token: "" };
  let token = new URL(location.href).searchParams.get("lab") || "";
  try {
    token ||= localStorage.getItem("stemlight-private-lab") || "";
    if (/^[a-f0-9]{64}$/.test(token)) localStorage.setItem("stemlight-private-lab", token);
  } catch {
  }
  return { allowed: /^[a-f0-9]{64}$/.test(token), token };
}
function labURL(path) {
  const a = labAccess();
  return a.allowed && a.token ? `${path}?lab=${a.token}` : path;
}

// src/catalog.js
var kuielab = {
  vocals: { hash: "daba83c2ee1afee9139766ad64c9b6808d6b6f092fff04bed3338be50baac721", fft: 6144, output: "Vocals", residual: "Instrumental" },
  drums: { hash: "40f586b7091934dd6f5563f0cba8f14bad57ce88440da1098bf388ea716c2901", fft: 4096, output: "Drums" },
  bass: { hash: "0c3e77b9963185b1ea6bb46a4b8924137d9370fc1ccdefec7b1b416ef550dcaa", fft: 16384, output: "Bass" },
  other: { hash: "7b67a1dcb5f232153528c59960b4c7bf8dc736b8114de360af0e719633f53358", fft: 8192, output: "Other" }
};
var WEIGHTS = Object.fromEntries(Object.entries(kuielab).map(([id, a]) => [id, { ...a, id, name: `MDX ${a.output}`, bytes: 29703204, url: `https://media.githubusercontent.com/media/kuielab/mdx-net-submission/68b969d7b9a99ed4557ba372035b4eb2ac67547d/onnx_A/${id}.onnx`, license: "MIT", bins: 2048, compensate: 1 }]));
WEIGHTS["scnet-base"] = { id: "scnet-base", name: "SCNet Base 128", architecture: "scnet", bytes: 42849113, hash: "46a9313dc9220d3c8ecc011569c5e465dd0f1ad29c61e47a87c9775bafdddbde", url: "models/scnet-base-128.onnx", license: "MIT", frames: 128, fft: 4096, bins: 2049 };
WEIGHTS["scnet-base-64"] = { ...WEIGHTS["scnet-base"], id: "scnet-base-64", name: "SCNet Base 64", bytes: 42749771, hash: "3654b2a9c33ae82427147f7ae0e3c75cf266a0072b9134e580817ee97dadb436", url: "models/scnet-base-64.onnx", frames: 64 };
var local = labAccess().allowed;
var imported = (path) => local ? labURL(path) : null;
WEIGHTS["htdemucs-4s"] = { id: "htdemucs-4s", name: "HTDemucs", architecture: "htdemucs", file: "htdemucs-4s.slpk", bytes: 90433598, hash: "1d0b735e851caa8af45cd51a48962e9642c5f4e26b49818ec255f483f9dc7dd4", url: imported("/local-models/htdemucs-4s.slpk"), import: true, license: "\u7814\u7A76\u76EE\u7684\uFF08\u4F5C\u8005\u898B\u89E3\uFF09" };
WEIGHTS["htdemucs-6s"] = { id: "htdemucs-6s", name: "HTDemucs 6", architecture: "htdemucs", file: "htdemucs-6s.slpk", bytes: 59867070, hash: "d92c068deb1962f658662ec14e62f9151439ec7e4982c6d38b5f73742d8d4cc2", url: imported("/local-models/htdemucs-6s.slpk"), import: true, license: "\u7814\u7A76\u76EE\u7684\uFF08\u4F5C\u8005\u898B\u89E3\uFF09" };
WEIGHTS["inst-hq5"] = { id: "inst-hq5", name: "UVR Inst HQ 5", file: "UVR-MDX-NET-Inst_HQ_5.onnx", bytes: 59074342, hash: "811cb24095d865763752310848b7ec86aeede0626cb05749ab35350e46897000", url: imported("/local-models/inst-hq5.onnx"), import: true, license: "UVR", fft: 5120, bins: 2560, compensate: 1.01, output: "Instrumental", residual: "Vocals" };
WEIGHTS["karaoke2"] = { id: "karaoke2", name: "UVR Karaoke 2", file: "UVR_MDXNET_KARA_2.onnx", bytes: 52786726, hash: "bf32e15105a09c0f7dddd2b67346146334d6f3ecb399ed7638eba2ab07cbf5f4", url: imported("/local-models/karaoke2.onnx"), import: true, license: "UVR", fft: 5120, bins: 2048, compensate: 1.065, output: "BackingVocal", residual: "LeadVocal" };
WEIGHTS["bs-sw-core"] = { id: "bs-sw-core", name: "BS-RoFormer SW (graph)", architecture: "bs-roformer", file: "bs-short.onnx", bytes: 2651463, hash: "0f14e2e8ee983314237b67f25294578aaa33594f3497c6329449636ba4038541", url: imported("/local-models/bs-short.onnx"), import: true, license: "\u672A\u78BA\u8A8D" };
WEIGHTS["bs-sw-data"] = { ...WEIGHTS["bs-sw-core"], id: "bs-sw-data", name: "BS-RoFormer SW (weights)", file: "bs-weights.bin", bytes: 350213328, hash: "9cdb4ef1b6723cb2a4ebc74ac6ad8a3734593e709b4ae8e63cae086cc681555d", url: imported("/local-models/bs-weights.bin") };
var MODELS = [
  { id: "mdx-vocals", name: "MDX Vocal", by: "KUIELab", stems: ["Vocals", "Instrumental"], weights: ["vocals"], types: ["two"], tier: "light", speed: 3, quality: 1 },
  { id: "inst-hq5", name: "Inst HQ 5", by: "UVR", stems: ["Vocals", "Instrumental"], weights: ["inst-hq5"], types: ["two"], tier: "standard", speed: 1, quality: 3 },
  { id: "htdemucs-4s", name: "HTDemucs", by: "Meta", architecture: "htdemucs", stems: ["Vocals", "Drums", "Bass", "Other", "Instrumental"], weights: ["htdemucs-4s"], types: ["four", "two"], tier: "standard", speed: 2, quality: 3 },
  { id: "scnet-base", name: "SCNet", by: "starrytong", architecture: "scnet", stems: ["Vocals", "Drums", "Bass", "Other"], weights: ["scnet-base-64"], types: ["four"], tier: "light", speed: 2, quality: 2 },
  { id: "mdx-four", name: "MDX Quartet", by: "KUIELab", stems: ["Vocals", "Drums", "Bass", "Other", "Instrumental"], weights: ["vocals", "drums", "bass", "other"], types: ["four"], tier: "light", speed: 1, quality: 1 },
  { id: "htdemucs-6s", name: "HTDemucs 6", by: "Meta", architecture: "htdemucs", stems: ["Vocals", "Drums", "Bass", "Guitar", "Piano", "Other", "Instrumental"], weights: ["htdemucs-6s"], types: ["six"], tier: "standard", speed: 2, quality: 2 },
  { id: "bs-sw", name: "BS-RoFormer SW", by: "jarredou", architecture: "bs-roformer", stems: ["Vocals", "Drums", "Bass", "Guitar", "Piano", "Other"], weights: ["bs-sw-core", "bs-sw-data"], types: ["six"], tier: "heavy", speed: 1, quality: 3 },
  { id: "lead-backing", name: "Karaoke 2", by: "UVR", architecture: "lead-backing", stems: ["LeadVocal", "BackingVocal"], weights: ["scnet-base-64", "karaoke2"], types: ["karaoke"], tier: "light", speed: 1, quality: 2 }
].map((m) => ({ ...m, stemCount: m.stems.filter((s) => s !== "Instrumental" || m.stems.length === 2).length, bytes: m.weights.reduce((s, w) => s + WEIGHTS[w].bytes, 0), imported: m.weights.some((w) => WEIGHTS[w].import) }));
function scnetFrames(mode, caps = {}) {
  return mode === "fast" || !caps.memoryGB || caps.memoryGB < 8 ? 64 : 128;
}
function modelFor(model, mode, caps, framesOverride) {
  if (model.architecture === "lead-backing") {
    const weights2 = model.inputKind === "vocals" ? ["karaoke2"] : ["scnet-base-64", "karaoke2"];
    return { ...model, weights: weights2, bytes: weights2.reduce((n, w) => n + WEIGHTS[w].bytes, 0) };
  }
  if (model.architecture === "bs-roformer") return { ...model, frames: 64 };
  if (model.architecture !== "scnet") return model;
  const frames = framesOverride || scnetFrames(mode, caps), weights = [frames === 128 ? "scnet-base" : "scnet-base-64"];
  return { ...model, frames, weights, bytes: WEIGHTS[weights[0]].bytes };
}
var MODES = { fast: { label: "\u9AD8\u901F", english: "Fast", frames: 32, overlap: 0.08, denoise: false }, standard: { label: "\u6A19\u6E96", english: "Standard", frames: 64, overlap: 0.25, denoise: false }, best: { label: "\u9AD8\u54C1\u8CEA", english: "Best", frames: 128, overlap: 0.5, denoise: true } };
function framesFor(mode, caps) {
  return mode === "best" && (!caps.memoryGB || caps.memoryGB < 8) ? 64 : MODES[mode].frames;
}

// src/capabilities.js
async function capabilities() {
  const wasm = typeof WebAssembly === "object", webgpuAPI = !!navigator.gpu;
  let gpu = false, shaderF16 = false, gpuLimits = null, gpuError = null;
  try {
    const a = await navigator.gpu?.requestAdapter();
    gpu = !!a;
    if (a) {
      shaderF16 = a.features.has("shader-f16");
      gpuLimits = { buffer: a.limits.maxStorageBufferBindingSize, storage: a.limits.maxStorageBuffersPerShaderStage };
    } else gpuError = webgpuAPI ? "requestAdapter returned null" : "API unavailable";
  } catch (e) {
    gpuError = String(e.message);
  }
  const simd = wasm && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  const sharedArrayBuffer = typeof SharedArrayBuffer !== "undefined", isolated = globalThis.crossOriginIsolated === true;
  let threads = false;
  try {
    threads = wasm && sharedArrayBuffer && isolated && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11])) && new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }).buffer instanceof SharedArrayBuffer;
  } catch {
  }
  let storage = {}, storageError = null;
  try {
    storage = await navigator.storage?.estimate() || {};
  } catch (e) {
    storageError = String(e.message);
  }
  return { webgpu: gpu, webgpuAPI, gpuError, shaderF16, gpuLimits, wasm, simd, threads, shared: threads, sharedArrayBuffer, crossOriginIsolated: isolated, worker: typeof Worker !== "undefined", audioWorklet: typeof AudioWorkletNode !== "undefined", audio: !!(globalThis.AudioContext || globalThis.webkitAudioContext), memoryGB: navigator.deviceMemory ?? null, cores: navigator.hardwareConcurrency ?? null, opfs: !!navigator.storage?.getDirectory, indexedDB: typeof indexedDB !== "undefined", storage, storageError, secure: globalThis.isSecureContext === true, backend: gpu ? "webgpu" : "wasm" };
}
var WORKING = { htdemucs: { "htdemucs-4s": 700, "htdemucs-6s": 660 }, scnet: { 64: 330, 128: 470 }, "bs-roformer": 1450 };
function budgetMB(caps, tier) {
  const gb = caps.memoryGB;
  if (tier === "heavy") return gb >= 8 ? 2048 : 0;
  if (!gb) return 1024;
  return gb >= 8 ? 2048 : gb >= 6 ? 1200 : gb >= 4 ? 900 : gb >= 2 ? 520 : 400;
}
function estimate(model, mode, audio, caps, selected = model.stems) {
  const arch = model.architecture, frames = arch === "bs-roformer" ? 64 : arch === "scnet" ? model.frames || scnetFrames(mode, caps) : framesFor(mode, caps), sourceBytes = audio?.size || 0, seconds = audio?.duration || 0, outputs = selected.length;
  const tensor = 4 * (model.bins || 2560) * frames * 4, working = (arch === "bs-roformer" ? WORKING["bs-roformer"] : arch === "htdemucs" ? WORKING.htdemucs[model.weights[0]] : arch === "scnet" ? WORKING.scnet[frames] : arch === "lead-backing" ? 330 : 240 + tensor * 18 / 1024 ** 2) * 1024 ** 2, decode = audio?.streaming ? 16 * 1024 ** 2 : sourceBytes * 2 + seconds * 44100 * 2 * 4 * 3;
  const peak = Math.max(working, decode) + 30 * 1024 ** 2, budget = budgetMB(caps, model.tier) * 1024 ** 2;
  const disk = sourceBytes + seconds * 44100 * (4 * outputs + (arch === "lead-backing" && model.inputKind !== "vocals" ? 8 : 0)) + 8 * 1024 ** 2 + model.bytes;
  const available = (caps.storage.quota || 0) - (caps.storage.usage || 0);
  return { peak, budget, disk, tensor, frames, safe: peak <= budget && (!available || disk < available * 0.85), memorySafe: peak <= budget, storageSafe: !available || disk < available * 0.85, unknownMemory: !caps.memoryGB, seconds: seconds * (mode === "best" ? 6 : mode === "standard" ? 2.5 : 2) * model.weights.length, estimated: true };
}

// src/performance.js
var active = null;
function addTime(name, ms) {
  if (!active) return;
  const t = active.timings[name] ||= { ms: 0, calls: 0 };
  t.ms += ms;
  t.calls++;
}
async function measureAsync(name, fn) {
  const t = performance.now();
  try {
    return await fn();
  } finally {
    addTime(name, performance.now() - t);
  }
}
function performanceSnapshot() {
  if (!active) return null;
  const p = structuredClone(active);
  p.neuralRealtimeFactor = p.audioDuration > 0 ? (p.timings.neuralNetwork?.ms ?? 0) / 1e3 / p.audioDuration : null;
  return p;
}

// src/storage.js
var dbPromise;
function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open("stemlight-v1", 1);
    r.onupgradeneeded = () => {
      for (const name of ["models", "files", "blocks", "jobs", "settings"]) r.result.createObjectStore(name);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}
async function get(store, key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store), r = t.objectStore(store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function put(store, key, value) {
  if (store === "jobs") {
    const p = performanceSnapshot();
    if (p) {
      value.metrics ||= {};
      value.metrics.performance = p;
    }
  }
  const tick = performance.now(), d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    t.objectStore(store).put(value, key);
    t.oncomplete = () => {
      addTime(store === "jobs" ? "checkpointWrite" : store === "settings" ? "diagnosticWrite" : "storageWrite", performance.now() - tick);
      resolve();
    };
    t.onerror = () => reject(t.error || Error(`IndexedDB ${store} write failed`));
    t.onabort = () => reject(t.error || Error(`IndexedDB ${store} transaction aborted`));
  });
}
async function del(store, key) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, "readwrite");
    t.objectStore(store).delete(key);
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
async function root() {
  if (globalThis.__STEMLIGHT_NO_OPFS__) return null;
  try {
    return await navigator.storage?.getDirectory();
  } catch {
    return null;
  }
}
async function fileSize(key) {
  const meta = await get("files", key);
  if (!meta) throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  if (meta.opfs) {
    const dir = await root();
    if (!dir) throw Error("\u4FDD\u5B58\u9818\u57DF\u3092\u958B\u3051\u307E\u305B\u3093");
    return (await (await dir.getFileHandle(key)).getFile()).size;
  }
  if (meta.blob) return meta.blob.size;
  if (meta.blocks) {
    const d = await db();
    const keys = await new Promise((resolve, reject) => {
      const r = d.transaction("blocks").objectStore("blocks").getAllKeys(IDBKeyRange.bound(`${key}:`, `${key}:\uFFFF`));
      r.onsuccess = () => resolve(new Set(r.result));
      r.onerror = () => reject(r.error);
    });
    for (let i = 0; i < meta.blocks; i++) if (!keys.has(`${key}:${i}`)) throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u306E\u30D6\u30ED\u30C3\u30AF\u304C\u3042\u308A\u307E\u305B\u3093");
    return meta.size;
  }
  throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u4E0D\u5B8C\u5168\u3067\u3059");
}
async function writeFile(key, blob) {
  const dir = await root();
  if (dir) {
    try {
      const h = await dir.getFileHandle(key, { create: true }), w = await h.createWritable();
      try {
        await blob.stream().pipeTo(w);
      } catch (e) {
        await dir.removeEntry(key).catch(() => {
        });
        throw e;
      }
      await put("files", key, { opfs: true, size: blob.size });
      return;
    } catch (e) {
      if (e?.name === "QuotaExceededError") throw e;
    }
  }
  let count = 0;
  try {
    for (let start = 0; start < blob.size; start += 4 * 1024 ** 2) {
      await put("blocks", `${key}:${count}`, await blob.slice(start, start + 4 * 1024 ** 2).arrayBuffer());
      count++;
    }
    await put("files", key, { blocks: count, size: blob.size, type: blob.type, binary: true });
  } catch (e) {
    for (let j = 0; j < count; j++) await del("blocks", `${key}:${j}`);
    throw e;
  }
}
async function readBytes(key, onAllocate = async (fn) => fn()) {
  const meta = await get("files", key);
  if (!meta) throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
  if (meta.opfs) {
    const dir = await root();
    if (!dir) throw Error("\u4FDD\u5B58\u9818\u57DF\u3092\u958B\u3051\u307E\u305B\u3093");
    const f = await (await dir.getFileHandle(key)).getFile();
    return onAllocate(async () => new Uint8Array(await f.arrayBuffer()));
  }
  if (meta.blob) return onAllocate(async () => new Uint8Array(await meta.blob.arrayBuffer()));
  if (!meta.blocks || !Number.isSafeInteger(meta.size)) throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u4E0D\u5B8C\u5168\u3067\u3059");
  const bytes = await onAllocate(async () => new Uint8Array(meta.size));
  let offset = 0;
  for (let i = 0; i < meta.blocks; i++) {
    const b = await get("blocks", `${key}:${i}`);
    if (!b || offset + b.byteLength > bytes.byteLength) throw Error("\u4FDD\u5B58\u30E2\u30C7\u30EB\u306E\u30D6\u30ED\u30C3\u30AF\u304C\u4E0D\u6B63\u3067\u3059");
    bytes.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  if (offset !== bytes.byteLength) throw Error("\u4FDD\u5B58\u30E2\u30C7\u30EB\u306E\u5BB9\u91CF\u304C\u4E0D\u6B63\u3067\u3059");
  return bytes;
}
async function jobSummaries() {
  const rows = await entriesProjected("jobs", (j) => {
    const { current, ...summary } = j;
    return summary;
  });
  return rows.filter(([, j]) => !j.benchmark);
}
async function entriesProjected(store, project) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(store).objectStore(store).openCursor(), a = [];
    r.onsuccess = () => {
      const c = r.result;
      if (c) {
        a.push([c.key, project(c.value)]);
        c.continue();
      } else resolve(a);
    };
    r.onerror = () => reject(r.error);
  });
}
async function removeFile(key) {
  const meta = await get("files", key);
  if (meta?.opfs) await (await root())?.removeEntry(key).catch(() => {
  });
  if (meta?.blocks) for (let i = 0; i < meta.blocks; i++) await del("blocks", `${key}:${i}`);
  await del("files", key);
}
var Sink = class _Sink {
  static async open(key, offset = 0, blocks = 0) {
    const s = new _Sink();
    s.key = key;
    s.offset = offset;
    const dir = await root();
    if (dir) {
      try {
        s.handle = await (await dir.getFileHandle(key, { create: true })).createSyncAccessHandle();
        s.handle.truncate(offset);
        await put("files", key, { opfs: true });
        return s;
      } catch {
      }
    }
    let m = await get("files", key);
    for (let j = blocks; j < (m?.blocks || 0); j++) await del("blocks", `${key}:${j}`);
    s.blocks = blocks;
    s.sizes = (m?.sizes || []).slice(0, blocks);
    if (offset === 0) {
      await removeFile(key);
      s.blocks = 0;
      s.sizes = [];
    }
    await put("files", key, { blocks: s.blocks, sizes: s.sizes, size: offset });
    return s;
  }
  async write(bytes) {
    return measureAsync("outputWrite", () => this.writeBytes(bytes));
  }
  async writeBytes(bytes) {
    if (this.handle) {
      const written = this.handle.write(bytes, { at: this.offset });
      if (written !== bytes.byteLength) throw Error("\u4FDD\u5B58\u9818\u57DF\u3078\u306E\u66F8\u304D\u8FBC\u307F\u304C\u4E0D\u5B8C\u5168\u3067\u3059");
      this.offset += written;
      this.handle.flush();
    } else {
      await put("blocks", `${this.key}:${this.blocks}`, bytes.slice().buffer);
      this.blocks++;
      this.sizes.push(bytes.byteLength);
      this.offset += bytes.byteLength;
      await put("files", this.key, { blocks: this.blocks, sizes: this.sizes, size: this.offset });
    }
  }
  close() {
    if (this.handle) {
      this.handle.flush();
      this.handle.close();
      this.handle = null;
    }
  }
};

// src/load-trace.js
var LOAD_STAGES = ["model URL resolution", "fetch start", "download", "cache read", "ArrayBuffer allocation", "Worker start", "ORT module initialization", "WASM initialization", "InferenceSession.create", "tensor allocation", "session ready"];
var trace = null;
var queue = Promise.resolve();
var notify = () => {
};
async function beginTrace(selectedModel) {
  trace = { selectedModel, loadedModel: null, activeSessions: 0, activeWorkers: 0, modelLoadStage: null, lastSuccessfulStage: null, modelBytes: 0, arrayBufferBytes: 0, audioBufferBytes: null, currentChunk: null, backend: null, exception: null, cleanup: [], stages: Object.fromEntries(LOAD_STAGES.map((s) => [s, { status: "NOT REACHED" }])), events: [], measurement: "Application-owned references/counts, not measured OS RAM or guaranteed memory reclamation" };
  await flush();
}
function snapshot() {
  return trace ? structuredClone(trace) : null;
}
function updateTrace(values) {
  if (!trace) return;
  Object.assign(trace, values);
  return flush();
}
function flush() {
  if (!trace) return Promise.resolve();
  const copy = snapshot();
  notify(copy);
  queue = queue.catch(() => {
  }).then(() => put("settings", "load-trace", copy));
  return queue;
}
async function stage(name, fn, details = {}) {
  if (!trace) return fn();
  trace.modelLoadStage = name;
  trace.stages[name] = { status: "RUNNING", ...details };
  trace.events.push({ stage: name, status: "RUNNING", at: Date.now() });
  trace.events = trace.events.slice(-48);
  await flush();
  const tick = performance.now();
  try {
    const categories = { "inference": "neuralNetwork", "tensor allocation": "tensorConstruction", "InferenceSession.create": "sessionCreate", "ORT module initialization": "runtimeInitialization", "cache read": "modelCacheRead", "SHA-256 verification": "modelHashVerification" };
    let v;
    if (name === "inference") globalThis.__benchmarkInference = true;
    try {
      v = await measureAsync(categories[name] || "stage:" + name, fn);
    } finally {
      if (name === "inference") globalThis.__benchmarkInference = false;
    }
    trace.stages[name] = { status: "PASS", ms: performance.now() - tick, ...details };
    trace.lastSuccessfulStage = name;
    await flush();
    return v;
  } catch (e) {
    try {
      e._stemlightStage ||= name;
    } catch {
    }
    trace.stages[name] = { status: "FAIL", ms: performance.now() - tick, ...details };
    trace.exception = { stage: e._stemlightStage || name, message: String(e.message || e), stack: String(e.stack || "") };
    await flush();
    throw e;
  }
}

// src/audio.js
async function wavInfo(file) {
  const b = await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer(), v = new DataView(b);
  function text(p, n) {
    return String.fromCharCode(...new Uint8Array(b, p, n));
  }
  if (b.byteLength < 12 || text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE") return null;
  let fmt;
  for (let p = 12; p + 8 <= b.byteLength; ) {
    const id = text(p, 4), n = v.getUint32(p + 4, true);
    if (id === "fmt " && p + 8 + n <= b.byteLength) {
      let format = v.getUint16(p + 8, true);
      if (format === 65534 && n >= 40) format = v.getUint16(p + 32, true);
      fmt = { format, channels: v.getUint16(p + 10, true), rate: v.getUint32(p + 12, true), align: v.getUint16(p + 20, true), bits: v.getUint16(p + 22, true) };
    }
    if (id === "data" && fmt) {
      if (![1, 3].includes(fmt.format) || ![1, 2].includes(fmt.channels) || ![16, 24, 32].includes(fmt.bits)) throw Error("WAV\u306FPCM 16/24/32bit\u307E\u305F\u306Ffloat32\u3001mono/stereo\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059");
      if (fmt.format === 3 && fmt.bits !== 32) throw Error("float WAV\u306F32bit\u306E\u307F\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u3059");
      if (fmt.align !== fmt.channels * fmt.bits / 8 || fmt.rate < 8e3 || fmt.rate > 192e3) throw Error("WAV\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
      const bytes = Math.min(n, file.size - (p + 8)), frames = Math.floor(bytes / fmt.align);
      return { ...fmt, dataOffset: p + 8, frames, duration: frames / fmt.rate, size: file.size, streaming: true };
    }
    p += 8 + n + n % 2;
  }
  throw Error("WAV\u30D8\u30C3\u30C0\u30FC\u3092\u8AAD\u307F\u53D6\u308C\u307E\u305B\u3093");
}
async function inspectAudio(file) {
  if (file.size === 0) throw Error("\u7A7A\u306E\u30D5\u30A1\u30A4\u30EB\u3067\u3059");
  if (file.size > 2 * 1024 ** 3) throw Error("2GB\u3092\u8D85\u3048\u308B\u30D5\u30A1\u30A4\u30EB\u306F\u5206\u5272\u3057\u3066\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
  const wav = await wavInfo(file);
  if (wav) {
    if (!wav.frames) throw Error("\u97F3\u58F0\u30B5\u30F3\u30D7\u30EB\u306E\u306A\u3044WAV\u3067\u3059");
    return { ...wav, name: file.name };
  }
  const url = URL.createObjectURL(file);
  try {
    const a = new Audio();
    a.preload = "metadata";
    const duration = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("\u97F3\u6E90\u60C5\u5831\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002WAV\u3078\u5909\u63DB\u3057\u3066\u304A\u8A66\u3057\u304F\u3060\u3055\u3044")), 12e3);
      a.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(a.duration);
      };
      a.onerror = () => {
        clearTimeout(timer);
        reject(Error("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u304C\u8AAD\u307F\u8FBC\u3081\u306A\u3044\u97F3\u6E90\u5F62\u5F0F\u3067\u3059"));
      };
      a.src = url;
    });
    if (!Number.isFinite(duration) || duration <= 0) throw Error("\u97F3\u6E90\u306E\u9577\u3055\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093");
    return { name: file.name, size: file.size, duration, streaming: false, rate: 44100, channels: 2 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
var inputTiming;
async function inputTime(name, fn) {
  const t = performance.now();
  try {
    return await fn();
  } finally {
    inputTiming[name] = (inputTiming[name] || 0) + performance.now() - t;
  }
}
async function saveInput(file, info, key) {
  inputTiming = { fileRead: 0, decode: 0, resample: 0, inputStorage: 0 };
  const t = performance.now(), r = await prepareInput(file, info, key);
  return { ...r, inputPerformance: { ...inputTiming, total: performance.now() - t, decodeApplicable: !info.streaming, scope: "Main-thread input preparation elapsed; decode includes file read" } };
}
async function prepareInput(file, info, key) {
  if (info.streaming) {
    await inputTime("inputStorage", () => writeFile(key, file));
    return info;
  }
  const Audio2 = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio2) throw Error("\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u3067\u306F\u5727\u7E2E\u97F3\u6E90\u3092\u30C7\u30B3\u30FC\u30C9\u3067\u304D\u307E\u305B\u3093\u3002WAV\u3092\u3054\u5229\u7528\u304F\u3060\u3055\u3044");
  const ctx = new Audio2({ sampleRate: 44100 });
  try {
    let decoded = await inputTime("decode", async () => ctx.decodeAudioData(await inputTime("fileRead", () => file.arrayBuffer())));
    if (decoded.numberOfChannels > 2) throw Error("mono/stereo\u97F3\u6E90\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
    let buffer = decoded;
    if (decoded.sampleRate !== 44100) {
      const offline = new OfflineAudioContext(decoded.numberOfChannels, Math.ceil(decoded.duration * 44100), 44100);
      const s = offline.createBufferSource();
      s.buffer = decoded;
      s.connect(offline.destination);
      s.start();
      buffer = await inputTime("resample", () => offline.startRendering());
    }
    decoded = null;
    await updateTrace({ audioBufferBytes: buffer.length * buffer.numberOfChannels * 4, audioBufferMeasurement: "Decoded float sample bytes, not observed process RAM" });
    const l = buffer.getChannelData(0), r = buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1)), sink = await Sink.open(key);
    try {
      for (let start = 0; start < buffer.length; start += 65536) {
        const count = Math.min(65536, buffer.length - start), raw = new Float32Array(count * 2);
        for (let j = 0; j < count; j++) {
          raw[j * 2] = l[start + j];
          raw[j * 2 + 1] = r[start + j];
        }
        await inputTime("inputStorage", () => sink.write(new Uint8Array(raw.buffer)));
      }
    } finally {
      sink.close();
    }
    return { name: info.name, size: buffer.length * 8, streaming: true, raw: true, frames: buffer.length, rate: 44100, channels: 2, align: 8, bits: 32, format: 3, dataOffset: 0, duration: buffer.length / 44100 };
  } finally {
    await ctx.close();
    await updateTrace({ audioBufferBytes: 0, audioContextClosed: true });
  }
}

// src/models.js
var digest = async (b) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), (x) => x.toString(16).padStart(2, "0")).join("");
async function modelStatus(id) {
  const m = await get("models", id);
  if (m?.hash !== WEIGHTS[id].hash) return false;
  try {
    return await fileSize(`model-${id}`) === WEIGHTS[id].bytes;
  } catch {
    return false;
  }
}
async function downloadModel(id, onProgress = () => {
}, signal) {
  const m = WEIGHTS[id];
  if (await modelStatus(id)) return;
  const u = await stage("model URL resolution", async () => {
    const url = globalThis.__MODEL_URLS__?.[id] || m.url;
    if (!url) throw Error(`${m.file}\u3092\u30E2\u30C7\u30EB\u753B\u9762\u304B\u3089\u8FFD\u52A0\u3057\u3066\u304F\u3060\u3055\u3044`);
    const u2 = new URL(url, location.href);
    if (u2.origin !== location.origin && u2.origin !== "https://media.githubusercontent.com" && u2.origin !== "https://huggingface.co") throw Error("\u8A31\u53EF\u3055\u308C\u3066\u3044\u306A\u3044\u30E2\u30C7\u30EB\u914D\u4FE1\u5143\u3067\u3059");
    const access = labAccess();
    if (u2.origin === location.origin && access.token) u2.searchParams.set("lab", access.token);
    return u2;
  }, { weight: id });
  const response = await stage("fetch start", async () => {
    const r = await fetch(u, { method: "GET", credentials: "omit", signal, referrerPolicy: "no-referrer" });
    if (!r.ok) throw Error(`\u30E2\u30C7\u30EB\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F (${r.status})`);
    return r;
  });
  const key = `model-${id}`, reader = response.body.getReader();
  let writer, sink, dir, size = 0;
  try {
    await stage("download", async () => {
      dir = await root();
      if (dir) {
        try {
          writer = await (await dir.getFileHandle(key, { create: true })).createWritable();
        } catch {
        }
      }
      if (!writer) sink = await Sink.open(key);
      let block = new Uint8Array(4 * 1024 ** 2), used = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > m.bytes) throw Error("\u30E2\u30C7\u30EB\u5BB9\u91CF\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
        if (writer) await writer.write(value);
        else {
          let p = 0;
          while (p < value.length) {
            const count = Math.min(block.length - used, value.length - p);
            block.set(value.subarray(p, p + count), used);
            p += count;
            used += count;
            if (used === block.length) {
              await sink.write(block);
              used = 0;
            }
          }
        }
        onProgress(size / m.bytes);
      }
      if (size !== m.bytes) throw Error("\u30E2\u30C7\u30EB\u5BB9\u91CF\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
      if (writer) {
        await writer.close();
        writer = null;
        await put("files", key, { opfs: true, size });
      } else {
        if (used) await sink.write(block.subarray(0, used));
        sink.close();
        sink = null;
      }
      block = null;
    }, { expectedBytes: m.bytes });
    let bytes;
    try {
      bytes = await loadModel(id);
      await put("models", id, { hash: m.hash, bytes: bytes.byteLength, downloadedAt: (/* @__PURE__ */ new Date()).toISOString(), version: m.hash.slice(0, 8) });
    } finally {
      bytes = null;
      await updateTrace({ arrayBufferBytes: 0 });
    }
    onProgress(1);
  } catch (e) {
    await reader.cancel().catch(() => {
    });
    await writer?.abort().catch(() => {
    });
    sink?.close();
    await removeFile(key).catch(() => {
    });
    if (dir) await dir.removeEntry(key).catch(() => {
    });
    await del("models", id).catch(() => {
    });
    throw e;
  }
}
async function loadModel(id) {
  await updateTrace({ modelBytes: WEIGHTS[id].bytes });
  const bytes = await stage("cache read", () => readBytes(`model-${id}`, (fn) => stage("ArrayBuffer allocation", fn, { expectedBytes: WEIGHTS[id].bytes })), { weight: id });
  await updateTrace({ arrayBufferBytes: bytes.byteLength });
  await stage("SHA-256 verification", async () => {
    const sum = await digest(bytes);
    if (bytes.byteLength !== WEIGHTS[id].bytes || sum !== WEIGHTS[id].hash) {
      await deleteModel(id);
      throw Error("\u4FDD\u5B58\u30E2\u30C7\u30EB\u304C\u7834\u640D\u3057\u3066\u3044\u307E\u3059\u3002\u518D\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  });
  return bytes;
}
async function deleteModel(id) {
  await removeFile(`model-${id}`);
  await del("models", id);
}

// src/inference-lease.js
async function acquireModelLease() {
  if (!navigator.locks) return () => {
  };
  return new Promise((resolve, reject) => {
    navigator.locks.request("stemlight-single-model", { ifAvailable: true }, async (lock) => {
      if (!lock) {
        reject(Error("\u5225\u306E\u30BF\u30D6\u3067\u30E2\u30C7\u30EB\u3092\u5B9F\u884C\u4E2D\u3067\u3059"));
        return;
      }
      await new Promise((release2) => resolve(release2));
    }).catch(reject);
  });
}

// src/benchmark-policy.js
function benchmarkSkip(caps, backend, threads) {
  if (!caps.secure || !caps.worker || !caps.wasm || !caps.simd) return "Secure Context / Worker / WASM SIMD\u304C\u5FC5\u8981\u3067\u3059";
  if (backend === "webgpu" && !caps.webgpu) return "WebGPU adapter unavailable";
  if (backend === "wasm" && threads > 1 && !caps.shared) return "WASM threads / isolation unavailable";
  return null;
}
function riskyFailure(message) {
  return /out.of.memory|oom|allocation|allocat|memory|device.lost|worker.*(stop|error)|interrupt|停止|中断|メモリ/i.test(message);
}
function blockedCondition(rows, model, backend, threads) {
  return rows.some((r) => r.risky && r.model === model && r.backendRequested === backend && (backend !== "wasm" || threads >= r.threadsRequested));
}

// src/benchmark.js
var $ = (s) => document.querySelector(s);
var worker = null;
var release = null;
var unlock = null;
var input = null;
var busy = false;
var cooldownUntil = 0;
var controller = null;
var stopRun = null;
var STORE = "performance-benchmark";
var schema = "stemlight-performance-benchmark-1";
async function removeBenchFile(key) {
  if (!/^(benchmark-input-[a-f0-9-]{36}|out-benchmark-[a-f0-9-]{36}-(vocals|drums|bass|other|leadvocal|backingvocal))$/.test(key)) throw Error("\u30D9\u30F3\u30C1\u5C02\u7528\u30D5\u30A1\u30A4\u30EB\u4EE5\u5916\u306F\u524A\u9664\u3067\u304D\u307E\u305B\u3093");
  return removeFile(key);
}
var data = await get("settings", STORE) || { schema, runs: [], references: {}, source: null };
for (const r of data.runs) if (r.status === "RUNNING") {
  r.status = "INTERRUPTED";
  r.risky = true;
  r.error = "Interrupted/reload/OS kill: cause unknown";
  r.lastPersistedTrace = await get("settings", "load-trace");
  r.cleanup = { sessionRelease: "UNVERIFIED", sessionsAfter: null, workersAfter: null };
  const id = `benchmark-${r.id}`, j = await get("jobs", id);
  if (j?.benchmark) {
    for (const stem of j.selected) await removeBenchFile(`out-${id}-${stem.toLowerCase()}`).catch(() => {
    });
    await del("jobs", id).catch(() => {
    });
  }
}
await persist();
async function persist() {
  await put("settings", STORE, data);
  window.__STEMLIGHT_BENCHMARK__ = data;
}
function show() {
  const lines = data.runs.map((r) => `${r.model} \xB7 ${r.backendRequested}${r.backendRequested === "wasm" ? ` ${r.threadsRequested} threads` : ""} \xB7 ${r.audioDuration ?? "?"}s \xB7 ${r.status} \xB7 NN ${r.inferenceMs == null ? "\u2014" : (r.inferenceMs / 1e3).toFixed(2) + "s"} \xB7 RTF ${r.realtimeFactor == null ? "\u2014" : r.realtimeFactor.toFixed(2)} \xB7 \u6700\u5927\u6CE2\u5F62\u5DEE ${r.quality?.filter((q) => q.referenceAvailable).length ? Math.max(...r.quality.filter((q) => q.referenceAvailable).map((q) => q.maxAbsoluteDifference)).toExponential(2) : "\u57FA\u6E96\u306A\u3057"}`);
  $("#bench-results").textContent = lines.join("\n") || "\u672A\u6E2C\u5B9A";
  $("#bench-run").disabled = busy;
  $("#bench-file").disabled = busy;
  $("#bench-model").disabled = busy;
  $("#bench-condition").disabled = busy;
  $("#bench-duration").disabled = busy;
  $("#bench-cancel").disabled = !busy;
}
function condition() {
  const value = $("#bench-condition").value;
  return value === "webgpu" ? { backend: "webgpu", threads: 1 } : { backend: "wasm", threads: Number(value) };
}
async function run() {
  if (busy) return;
  busy = true;
  show();
  let row, job, ownedJob = false, started = performance.now(), wake;
  try {
    if (Date.now() < cooldownUntil) throw Error("\u76F4\u524D\u306E\u8A66\u9A13\u304B\u308930\u79D2\u4EE5\u4E0A\u7A7A\u3051\u3001\u7AEF\u672B\u304C\u71B1\u3051\u308C\u3070\u3055\u3089\u306B\u5F85\u3063\u3066\u304F\u3060\u3055\u3044");
    const model = $("#bench-model").value, { backend, threads } = condition(), caps = await capabilities(), seconds = $("#bench-duration").value === "short" ? 8 : Infinity;
    row = { id: crypto.randomUUID(), model, backendRequested: backend, threadsRequested: threads, status: "RUNNING", startedAt: (/* @__PURE__ */ new Date()).toISOString(), timeSincePreviousStartMs: data.runs.length ? Date.now() - Date.parse(data.runs.at(-1).startedAt) : null, userAgent: navigator.userAgent, launchMode: matchMedia("(display-mode:standalone)").matches ? "PWA" : "browser", physicalDeviceDeclared: $("#physical").checked, capabilities: caps, audioDuration: input ? Math.min(seconds, input.audio.duration) : null, threadsActuallyUsed: null, modelLoadMs: null, preprocessingMs: null, STFTms: null, inferenceMs: null, ISTFTms: null, postprocessingMs: null, totalExcludingExportMs: null, observedWASMBytes: null, backendActuallyUsed: null, partialCPUFallback: "unknown; full graph node placement not available", error: null, fallback: null, quality: null };
    data.runs.push(row);
    if (data.runs.length > 40) data.runs.splice(0, data.runs.length - 40);
    await persist();
    if (data.nextAllowedAt && Date.now() < data.nextAllowedAt) throw Error("\u524D\u56DE\u8A66\u9A13\u306Ecooldown\u4E2D\u3067\u3059\u3002\u7AEF\u672B\u3092\u51B7\u307E\u3057\u3066\u304B\u3089\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044");
    const skip = benchmarkSkip(caps, backend, threads) || (!navigator.locks ? "Web Locks unavailable: independent execution cannot be assured" : null);
    if (skip) {
      row.status = "SKIP";
      row.error = skip;
      return;
    }
    if (blockedCondition(data.runs.filter((r) => r !== row), model, backend, threads)) {
      row.status = "SKIP";
      row.error = "\u4EE5\u524D\u306E\u5371\u967A/\u4E2D\u65AD\u6761\u4EF6\u3068\u540C\u3058\u304B\u3001\u3088\u308A\u9AD8\u3044threads\u306E\u305F\u3081\u505C\u6B62";
      return;
    }
    if (model === "lead-backing" && !$("#bench-vocals").checked) throw Error("Karaoke\u306B\u306FVocals\u97F3\u6E90\u3092\u4F7F\u7528\u3057\u3001\u78BA\u8A8D\u6B04\u306B\u30C1\u30A7\u30C3\u30AF\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!input) throw Error("\u540C\u3058\u30C6\u30B9\u30C8\u97F3\u6E90\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002Karaoke\u306FVocals\u97F3\u6E90\u3092\u4F7F\u7528\u3057\u307E\u3059\u3002");
    if (model === "lead-backing" && !WEIGHTS.karaoke2) {
      row.status = "SKIP";
      row.error = "Karaoke\u306F\u65E2\u5B58\u306E\u975E\u516C\u958B\u78BA\u8A8DURL\u3067\u306E\u307F\u5229\u7528\u3067\u304D\u307E\u3059";
      return;
    }
    row.modelWeight = { id: model === "scnet-base" ? "scnet-base-64" : "karaoke2", hash: WEIGHTS[model === "scnet-base" ? "scnet-base-64" : "karaoke2"].hash };
    row.listening = "UNVERIFIED";
    row.inputDeclaredVocals = $("#bench-vocals").checked;
    row.sourceId = input.id;
    row.audioDuration = Math.min(seconds, input.audio.duration);
    row.frames = model === "scnet-base" ? 64 : 32;
    row.overlap = 0.08;
    row.qualityMode = "fast";
    if (seconds === Infinity) {
      if (!$("#bench-full-confirm").checked) throw Error("\u77ED\u5C3A\u7D50\u679C\u306E\u54C1\u8CEA\u5DEE\u3068\u5B89\u5B9A\u6027\u3092\u78BA\u8A8D\u3057\u3001\u30D5\u30EB\u5C3A\u306E\u78BA\u8A8D\u6B04\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044");
      const short = data.runs.filter((r) => r !== row && r.status === "PASS" && r.model === model && r.sourceId === input.id && r.audioDuration <= 8.01);
      const candidates = [...new Map(short.map((r) => [`${r.backendRequested}:${r.threadsRequested}`, r])).values()].sort((a, b) => a.inferenceMs - b.inferenceMs).slice(0, 2);
      if (!candidates.some((r) => r.backendRequested === backend && r.threadsRequested === threads)) throw Error("\u307E\u305A\u540C\u3058\u97F3\u6E90\u306E8\u79D2\u8A66\u9A13\u3092\u5B9F\u65BD\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u30D5\u30EB\u5C3A\u306F\u5B9F\u6E2C\u4E0A\u4F4D2\u6761\u4EF6\u306E\u307F\u5B9F\u884C\u3067\u304D\u307E\u3059\u3002");
      if (input.audio.duration > 200) throw Error("\u30D5\u30EB\u5C3A\u30D9\u30F3\u30C1\u306F200\u79D2\u4EE5\u5185\u306EWAV\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    const trace2 = await get("settings", "load-trace");
    if (trace2?.activeWorkers > 0) throw Error("\u901A\u5E38\u5206\u96E2\u304C\u5B9F\u884C\u4E2D\u3001\u307E\u305F\u306F\u524D\u56DE\u306E\u89E3\u653E\u304C\u672A\u78BA\u8A8D\u3067\u3059\u3002\u901A\u5E38\u30A2\u30D7\u30EA\u3092\u5148\u306B\u7D42\u4E86\u3057\u3066\u304F\u3060\u3055\u3044");
    release = await acquireModelLease();
    await new Promise((resolve, reject) => {
      navigator.locks.request("stemlight-performance-benchmark", { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(Error("\u30D9\u30F3\u30C1\u306F\u5225\u30BF\u30D6\u3067\u5B9F\u884C\u4E2D\u3067\u3059"));
          return;
        }
        await new Promise((r) => {
          unlock = r;
          resolve();
        });
      }).catch(reject);
    });
    const audio = { ...input.audio, duration: row.audioDuration, frames: Math.min(input.audio.frames, Math.round(row.audioDuration * input.audio.rate)) };
    const m = modelFor({ ...MODELS.find((m2) => m2.id === model), inputKind: "vocals" }, "fast", caps, row.frames), budget = estimate(m, "fast", audio, caps, m.stems);
    row.memoryEstimate = budget;
    if (!budget.safe) throw Error("\u30E1\u30E2\u30EA\u307E\u305F\u306F\u4FDD\u5B58\u9818\u57DF\u306E\u5B89\u5168\u4E88\u7B97\u3092\u8D85\u3048\u3066\u3044\u307E\u3059");
    controller = new AbortController();
    $("#bench-status").textContent = "\u9078\u629E\u30E2\u30C7\u30EB\u3060\u3051\u3092\u53D6\u5F97/\u30AD\u30E3\u30C3\u30B7\u30E5\u78BA\u8A8D\u4E2D";
    const downloadTick = performance.now();
    await downloadModel(model === "scnet-base" ? "scnet-base-64" : "karaoke2", (f) => $("#bench-status").textContent = `\u30E2\u30C7\u30EB\u53D6\u5F97 ${Math.round(f * 100)}%`, controller.signal);
    row.downloadAndCacheCheckMs = performance.now() - downloadTick;
    controller = null;
    await beginTrace(model);
    const refKey = `${input.id}:${model}:${row.audioDuration}:${row.frames}:${row.modelWeight.hash}`;
    job = { id: `benchmark-${row.id}`, input: input.key, audio, model, mode: "fast", frames: row.frames, selected: m.stems, backend, pipeline: model === "lead-backing" ? { phase: "karaoke", inputKind: "vocals", transitions: [] } : null, caps, status: "paused", createdAt: Date.now(), startedAt: Date.now(), benchmark: { threads, references: data.references[refKey]?.outputs || [] } };
    await put("jobs", job.id, job);
    ownedJob = true;
    try {
      wake = await navigator.wakeLock?.request("screen");
    } catch {
    }
    const terminal = await new Promise((resolve, reject) => {
      worker = new Worker(labURL("engine-worker.js"), { type: "module" });
      let timeout;
      stopRun = () => {
        worker?.postMessage({ type: "pause" });
        $("#bench-status").textContent = "\u73FE\u5728\u306E\u30C1\u30E3\u30F3\u30AF\u3092\u4FDD\u5B58\u3057\u3066\u505C\u6B62\u3057\u307E\u3059";
        timeout = setTimeout(() => reject(Error("Worker stopped after interruption timeout")), 15e3);
      };
      worker.onerror = (e) => {
        clearTimeout(timeout);
        reject(Error(`Worker error/stopped: ${e.message || "cause unknown"}`));
      };
      worker.onmessage = ({ data: d }) => {
        if (d.loadTrace) {
          row.liveTrace = d.loadTrace;
          return;
        }
        if (d.notice) {
          row.fallback = d.notice;
          return;
        }
        if (d.complete || d.paused || d.error) {
          clearTimeout(timeout);
          resolve(d);
          return;
        }
        $("#bench-status").textContent = `${d.stage || "\u51E6\u7406\u4E2D"} ${Math.round(d.percent || 0)}%`;
      };
      worker.postMessage({ type: "start", id: job.id, postedAt: performance.timeOrigin + performance.now() });
    });
    worker.terminate();
    worker = null;
    const current = await get("jobs", job.id), t = terminal.benchmark?.sessionCleanup || row.liveTrace, p = current.metrics?.performance;
    row.metrics = current.metrics;
    row.loadedAtRuntime = p?.runtime ?? null;
    row.backendActuallyUsed = current.metrics?.backend ?? null;
    row.threadsActuallyUsed = p?.runtime?.threads ?? null;
    row.helperWorkersCreated = terminal.benchmark?.helperWorkersCreated ?? null;
    row.threadsEvidence = "ORT effective numThreads after initialization plus observed helper Worker creation; not OS scheduling measurement";
    row.modelLoadMs = current.metrics?.modelLoadMs ?? null;
    row.preprocessingMs = p?.timings.preprocessing?.ms ?? p?.timings.audioReadDecodeResample?.ms ?? null;
    row.STFTms = p?.timings.stft?.ms ?? null;
    row.inferenceMs = p?.timings.neuralNetwork?.ms ?? null;
    row.ISTFTms = p?.timings.istft?.ms ?? null;
    row.postprocessingMs = p?.timings.postprocessing?.ms ?? null;
    row.separationWallMs = current.metrics?.wallMs ?? null;
    row.totalExcludingExportMs = row.separationWallMs == null ? null : Math.max(0, row.separationWallMs - (p?.timings.wavEncode?.ms || 0) - (p?.timings.outputWrite?.ms || 0));
    row.totalScope = "separation wall minus measured PCM16 encode/output write; complete total also includes download/validation/cleanup";
    row.realtimeFactor = row.inferenceMs == null ? null : row.inferenceMs / 1e3 / row.audioDuration;
    row.observedWASMBytes = t?.WASMLinearMemoryBytes ?? null;
    row.memoryScope = t?.WASMMemoryScope ?? "unavailable";
    row.runtimeWarnings = terminal.benchmark?.warnings || [];
    row.partialCPUFallback = backend === "webgpu" && row.runtimeWarnings.some((w) => /fallback|not assigned|CPUExecutionProvider|unsupported|not supported/i.test(w.message)) ? "runtime warning observed; exact CPU node share unknown" : "unknown; no graph partition measurement";
    row.gpuInferenceDispatches = terminal.benchmark?.gpuInferenceDispatches ?? null;
    row.quality = terminal.benchmark?.quality ?? null;
    row.qualityError = terminal.benchmark?.qualityError ?? null;
    row.qualityMs = terminal.benchmark?.qualityMs ?? null;
    row.cleanup = { operations: t?.cleanup ?? [], sessionRelease: t?.cleanupComplete ? "PASS" : "UNVERIFIED", sessionsAfter: t?.activeSessions ?? null, workersAfter: 0, workerTerminated: true, OSMemoryReclaimed: "unavailable", scope: "application-owned counts; not OS process/GPU memory or internal ORT helper counts" };
    row.status = terminal.error ? "FAIL" : terminal.paused ? "ABORTED" : terminal.benchmark?.qualityError ? "FAIL" : t?.activeSessions !== 0 ? "FAIL" : backend === "webgpu" && !(row.backendActuallyUsed === "webgpu" && row.gpuInferenceDispatches > 0) ? "UNVERIFIED" : backend === "wasm" && row.threadsActuallyUsed !== threads ? "UNVERIFIED" : "PASS";
    row.error = terminal.error || row.qualityError || null;
    row.stack = terminal.detail || t?.exception?.stack || null;
    row.errorStage = t?.exception?.stage || null;
    row.fallback = { policy: "no application-level provider fallback during benchmark", notice: row.fallback, partialGraphCPU: "unknown" };
    if (row.status === "ABORTED") {
      row.error = "Interrupted by user/background";
      row.manualInterruption = true;
      row.risky = false;
    }
    if (row.status === "PASS" && !data.references[refKey]) {
      data.references[refKey] = { runId: row.id, outputs: current.outputs.map((o) => ({ ...o, runId: row.id })) };
      row.referenceEstablished = true;
      row.representativeOutputKeys = current.outputs.map((o) => o.key);
    } else {
      for (const o of current.outputs || []) await removeBenchFile(o.key);
    }
    row.referenceScope = "first successful run with same source/model/duration/frames; PCM16 saved outputs compared, not isolated float tensor";
  } catch (e) {
    if (row) {
      row.status = "FAIL";
      row.error = String(e.message);
      row.stack = String(e.stack || "");
      row.risky = riskyFailure(row.error);
      row.cleanup ||= { sessionRelease: "UNVERIFIED", sessionsAfter: null, workersAfter: 0, workerTerminated: !!worker, OSMemoryReclaimed: "unavailable", scope: "application-owned counts; not OS process/GPU memory or internal ORT helper counts" };
    } else $("#bench-status").textContent = e.message;
  } finally {
    controller?.abort();
    controller = null;
    worker?.terminate();
    worker = null;
    stopRun = null;
    await wake?.release().catch(() => {
    });
    try {
      if (job && ownedJob) {
        if (!row?.referenceEstablished) {
          for (const stem of job.selected) await removeBenchFile(`out-${job.id}-${stem.toLowerCase()}`);
        }
        await del("jobs", job.id);
        const t = await get("settings", "load-trace");
        await put("settings", "load-trace", { ...t, activeWorkers: 0, workerTerminated: true });
      }
    } catch (e) {
      if (row) {
        row.status = "FAIL";
        row.cleanupStorageError = String(e.message);
      }
    }
    release?.();
    release = null;
    unlock?.();
    unlock = null;
    if (row) {
      row.cleanup ||= { sessionRelease: ownedJob ? "UNVERIFIED" : "NOT STARTED", sessionsAfter: ownedJob ? null : 0, workersAfter: 0, scope: "benchmark-owned references only" };
      row.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      row.completeTotalMs = performance.now() - started;
      row.completeTotalScope = "click through model download, processing, quality scan and cleanup; excludes cooldown and JSON save";
      if (!row.manualInterruption) row.risky ||= riskyFailure((row.error || "") + " " + (row.errorStage || ""));
      delete row.liveTrace;
      cooldownUntil = ownedJob ? Date.now() + 3e4 : 0;
      data.nextAllowedAt = cooldownUntil;
      $("#bench-status").textContent = `${row.status} ${row.error || "\u7D42\u4E86\u300230\u79D2\u4EE5\u4E0A\u4F11\u61A9\u3057\u3001\u71B1\u3044\u5834\u5408\u306F\u3055\u3089\u306B\u51B7\u307E\u3057\u3066\u304F\u3060\u3055\u3044\u3002"}`;
    }
    busy = false;
    await persist();
    show();
    window.dispatchEvent(new Event("benchmark-updated"));
  }
}
$("#bench-file").onchange = async (e) => {
  if (busy) return;
  try {
    const file = e.target.files[0];
    if (!file) return;
    const info = await inspectAudio(file);
    if (!info.streaming && info.duration > 10) throw Error("\u9577\u3044\u5727\u7E2E\u97F3\u6E90\u306F\u4F7F\u7528\u305B\u305A\u3001\u77ED\u5C3A\u307E\u305F\u306F186.95\u79D2\u306EPCM WAV\u3092\u3054\u7528\u610F\u304F\u3060\u3055\u3044");
    if (info.duration > 200) throw Error("200\u79D2\u4EE5\u5185\u306E\u97F3\u6E90\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044");
    if (input || data.source) throw Error("\u5225\u306E\u97F3\u6E90\u306B\u5909\u66F4\u3059\u308B\u306B\u306F\u300C\u30D9\u30F3\u30C1\u30C7\u30FC\u30BF\u3092\u6D88\u53BB\u300D\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044\uFF08\u30D9\u30F3\u30C1\u5C02\u7528\u30C7\u30FC\u30BF\u306E\u307F\uFF09");
    const id = crypto.randomUUID(), key = `benchmark-input-${id}`, prepared = await saveInput(file, info, key), { name, ...audio } = prepared;
    input = { id, key, audio };
    data.source = input;
    await persist();
    $("#bench-status").textContent = `\u6E96\u5099\u6E08\u307F ${audio.duration.toFixed(2)}\u79D2\u3002\u77ED\u5C3A\u3067\u306F\u5148\u982D8\u79D2\u3092\u4F7F\u7528\u3002Karaoke\u306B\u306FVocals\u97F3\u6E90\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002`;
  } catch (e2) {
    $("#bench-status").textContent = e2.message;
  }
};
input = data.source;
if (input) $("#bench-status").textContent = `\u4FDD\u5B58\u6E08\u307F\u97F3\u6E90 ${input.audio.duration.toFixed(2)}\u79D2\u3067\u6BD4\u8F03\u3092\u7D9A\u3051\u3089\u308C\u307E\u3059\u3002\u30D5\u30A1\u30A4\u30EB\u306E\u518D\u9078\u629E\u306F\u4E0D\u8981\u3067\u3059\u3002`;
setInterval(() => {
  const left = Math.max(0, Math.ceil((Math.max(cooldownUntil, data.nextAllowedAt || 0) - Date.now()) / 1e3));
  $("#bench-run").disabled = busy || left > 0;
  $("#bench-run").textContent = left ? `\u51B7\u5374\u5F85\u3061 ${left}\u79D2` : "\u3053\u306E1\u6761\u4EF6\u3092\u6E2C\u5B9A";
}, 1e3);
$("#bench-run").onclick = run;
$("#bench-cancel").onclick = () => {
  controller?.abort();
  stopRun?.();
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && busy) {
    controller?.abort();
    stopRun?.();
  }
});
$("#bench-save").onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...data, userAgent: navigator.userAgent, capturedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)], { type: "application/json" })), a = document.createElement("a");
  a.href = url;
  a.download = "stemlight-benchmark.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
};
$("#bench-clear").onclick = async () => {
  if (busy) return;
  if (!confirm("\u30D9\u30F3\u30C1\u5C02\u7528\u306E\u5165\u529B\u30FB\u6BD4\u8F03\u7528\u51FA\u529B\u30FB\u8A08\u6E2C\u7D50\u679C\u3060\u3051\u3092\u6D88\u53BB\u3057\u307E\u3059\u304B\uFF1F\u901A\u5E38\u306E\u30E2\u30C7\u30EB\u30AD\u30E3\u30C3\u30B7\u30E5\u3068\u97F3\u6E90\u5C65\u6B74\u306F\u4FDD\u6301\u3057\u307E\u3059\u3002")) return;
  for (const ref of Object.values(data.references)) for (const o of ref.outputs) await removeBenchFile(o.key);
  if (data.source) await removeBenchFile(data.source.key);
  data = { schema, runs: [], references: {}, source: null };
  input = null;
  cooldownUntil = 0;
  await persist();
  show();
  $("#bench-status").textContent = "\u30D9\u30F3\u30C1\u5C02\u7528\u30C7\u30FC\u30BF\u3092\u6D88\u53BB\u3057\u307E\u3057\u305F";
};
show();

// src/diagnostics.js
var $2 = (s) => document.querySelector(s);
var report;
var memoryProbe = { status: "not measured", bytes: null };
var items = { launch: "\u8D77\u52D5 / \u97F3\u6E90import", download: "\u30E2\u30C7\u30EB\u53D6\u5F97", cache: "\u30E2\u30C7\u30EB\u30AD\u30E3\u30C3\u30B7\u30E5", wav: "\u500B\u5225WAV\u3092\u4FDD\u5B58\u30FB\u78BA\u8A8D", zip: "ZIP\u3092\u4FDD\u5B58\u30FB\u78BA\u8A8D", offlineLaunch: "\u30AA\u30D5\u30E9\u30A4\u30F3\u8D77\u52D5", offlineInference: "\u30AA\u30D5\u30E9\u30A4\u30F3\u65B0\u898F\u63A8\u8AD6", pauseResume: "\u4E2D\u65AD / \u518D\u958B", background: "\u30D0\u30C3\u30AF\u30B0\u30E9\u30A6\u30F3\u30C9 / \u753B\u9762OFF", stability: "OOM / \u518D\u8AAD\u307F\u8FBC\u307F / \u5F37\u5236\u7D42\u4E86", listening: "\u8074\u611F\u30FB\u5206\u96E2\u54C1\u8CEA", thermal: "\u71B1 / \u30D0\u30C3\u30C6\u30EA\u30FC\uFF08\u78BA\u8A8D\u53EF\u80FD\u306A\u3089\uFF09" };
var observations = { os: "unconfirmed", browser: "", checks: {}, failureDetail: "" };
try {
  observations = JSON.parse(localStorage.getItem("stemlight-device-observations") || "null") || observations;
} catch {
}
observations = { os: "unconfirmed", browser: "", failureDetail: "", ...observations, checks: observations.checks && typeof observations.checks === "object" ? observations.checks : {} };
function persist2() {
  try {
    localStorage.setItem("stemlight-device-observations", JSON.stringify(observations));
  } catch {
  }
}
function checklist() {
  const model = $2("#check-model").value;
  $2("#checklist").innerHTML = Object.entries(items).map(([id, label]) => `<label for="check-${id}">${label}</label><select id="check-${id}" data-check="${id}"><option value="unconfirmed">\u672A\u78BA\u8A8D</option><option value="pass">\u672C\u4EBA\u78BA\u8A8D\u6210\u529F</option><option value="fail">\u5931\u6557</option><option value="safety-blocked">\u5B89\u5168\u5236\u5FA1\u3067\u505C\u6B62</option><option value="unavailable">\u5229\u7528\u4E0D\u53EF</option></select>`).join("");
  for (const el of document.querySelectorAll("[data-check]")) {
    el.value = observations.checks?.[model]?.[el.dataset.check] || "unconfirmed";
    el.onchange = () => {
      observations.checks[model] ||= {};
      observations.checks[model][el.dataset.check] = el.value;
      persist2();
      refresh();
    };
  }
}
$2("#device-os").value = observations.os;
$2("#browser-label").value = observations.browser;
$2("#failure-detail").value = observations.failureDetail;
$2("#check-model").onchange = checklist;
checklist();
for (const [id, key] of [["device-os", "os"], ["browser-label", "browser"], ["failure-detail", "failureDetail"]]) $2("#" + id).onchange = (e) => {
  observations[key] = e.target.value;
  persist2();
  refresh();
};
async function refresh() {
  const caps = await capabilities();
  caps.backendHint = caps.backend;
  delete caps.backend;
  let cache = [], jobs = [], cacheError = null;
  try {
    cache = await Promise.all(Object.keys(WEIGHTS).map(async (id) => {
      const m = await get("models", id), f = await get("files", `model-${id}`);
      return { id, available: await modelStatus(id), metadataPresent: !!m, fileMetadataPresent: !!f, metadataHashMatches: m?.hash === WEIGHTS[id].hash, storedBytes: f?.size ?? m?.bytes ?? null, storage: f?.opfs ? "OPFS" : f?.blocks ? "IndexedDB blocks" : null, expectedBytes: WEIGHTS[id].bytes, expectedSHA256: WEIGHTS[id].hash, integrity: "metadata only; fresh hash not calculated" };
    }));
    jobs = (await jobSummaries()).map(([, j]) => ({ model: j.model, status: j.status, quality: j.mode, selected: j.selected, frames: j.frames ?? null, audio: j.audio ? { duration: j.audio.duration, rate: j.audio.rate, channels: j.audio.channels, inputPerformance: j.audio.inputPerformance ?? null } : null, pipeline: j.pipeline ? { phase: j.pipeline.phase, inputKind: j.pipeline.inputKind, scnetMetrics: j.pipeline.scnetMetrics || null, karaokeMetrics: j.pipeline.karaokeMetrics || null, transitions: j.pipeline.transitions } : null, metrics: j.metrics ?? null, error: j.error ?? null }));
  } catch (e) {
    cacheError = String(e.message);
  }
  report = { schema: "stemlight-diagnostics-3", runtimeLoad: await get("settings", "load-trace") || { selectedModel: null, loadedModel: null, activeSessions: 0, activeWorkers: 0, modelLoadStage: null, measurement: "No recorded run; not a measured OS process count" }, capturedAt: (/* @__PURE__ */ new Date()).toISOString(), physicalDeviceUserConfirmed: $2("#physical").checked, declaredDeviceOS: observations.os, userAgent: navigator.userAgent, launchMode: matchMedia("(display-mode:standalone)").matches || navigator.standalone === true ? "standalone PWA" : "browser tab", ownerReportedObservations: { ...observations, source: "manual owner report; not an automatically verified result" }, memoryProbe, windowJSHeap: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, scope: "nonstandard window-reported estimate; not total process or Worker memory" } : null, capabilities: caps, storage: { quota: caps.storage.quota ?? null, usage: caps.storage.usage ?? null, error: cacheError ?? caps.storageError }, modelCache: cache, jobs, limitations: ["deviceMemory is not free RAM", "memoryEstimateBytes is an estimate", "WebGPU adapter availability is not proof of successful ONNX execution", "BS-RoFormer weights redistribution permission unknown; local development only", "No battery/thermal/OS-kill result is inferred from userAgent", "BS 0.73s is Safe/Emergency only; Best/Standard quality not certified"] };
  report.benchmark = await get("settings", "performance-benchmark") || null;
  report.performance = jobs.map((j) => ({ model: j.model, phase: j.pipeline?.phase || "separation", backend: j.metrics?.backend ?? null, threads: j.metrics?.performance?.runtime?.threads ?? j.metrics?.threads ?? null, chunkFrames: j.pipeline?.karaokeMetrics?.frames ?? j.frames ?? j.metrics?.chunkFrames ?? null, audioDuration: j.audio?.duration ?? null, modelLoadMs: j.metrics?.modelLoadMs ?? null, inferenceMs: j.metrics?.inferenceMs ?? null, totalMs: j.metrics?.wallMs ?? null, totalScope: "Job wall time; excludes initial download, input preparation and export", realtimeFactor: j.audio?.duration > 0 && j.metrics?.inferenceMs != null ? j.metrics.inferenceMs / 1e3 / j.audio.duration : null, input: j.audio?.inputPerformance ?? null, worker: j.metrics?.performance ?? null, export: j.metrics?.export ?? null }));
  $2("#performance").textContent = report.performance.length ? JSON.stringify(report.performance, null, 2) : "\u5B9F\u884C\u8A18\u9332\u306A\u3057\u3002\u904E\u53BB\u306Ejob\u3067\u672A\u8A08\u6E2C\u306E\u9805\u76EE\u306Fnull\u3067\u3059\u3002";
  $2("#report").textContent = JSON.stringify(report, null, 2);
}
window.addEventListener("benchmark-updated", refresh);
$2("#refresh").onclick = refresh;
$2("#physical").onchange = refresh;
$2("#memory").onclick = async () => {
  const button = $2("#memory");
  button.disabled = true;
  try {
    if (!performance.measureUserAgentSpecificMemory) {
      memoryProbe = { status: "API unavailable", bytes: null };
    } else {
      let timer;
      try {
        const r = await Promise.race([performance.measureUserAgentSpecificMemory(), new Promise((_, reject) => timer = setTimeout(() => reject(Error("API timeout; no measurement")), 1e4))]);
        memoryProbe = { status: "API measurement", bytes: r.bytes, method: "measureUserAgentSpecificMemory; user-agent-defined scope; not free RAM", breakdown: r.breakdown?.map((b) => ({ bytes: b.bytes, types: b.types })) };
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (e) {
    memoryProbe = { status: "failed or unavailable", bytes: null, error: String(e.message) };
  } finally {
    button.disabled = false;
    await refresh();
  }
};
$2("#copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    $2("#status").textContent = "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F";
  } catch (e) {
    $2("#status").textContent = `\u30B3\u30D4\u30FC\u3067\u304D\u307E\u305B\u3093\u3002JSON\u4FDD\u5B58\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044: ${e.message}`;
  }
};
$2("#save").onclick = () => {
  const u = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })), a = document.createElement("a");
  a.href = u;
  a.download = "stemlight-diagnostics.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1e3);
};
await refresh();
