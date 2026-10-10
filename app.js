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
    for (let start2 = 0; start2 < blob.size; start2 += 4 * 1024 ** 2) {
      await put("blocks", `${key}:${count}`, await blob.slice(start2, start2 + 4 * 1024 ** 2).arrayBuffer());
      count++;
    }
    await put("files", key, { blocks: count, size: blob.size, type: blob.type, binary: true });
  } catch (e) {
    for (let j = 0; j < count; j++) await del("blocks", `${key}:${j}`);
    throw e;
  }
}
async function readFile(key, lazy = false) {
  const meta = await get("files", key);
  if (meta?.opfs) {
    const dir = await root();
    if (!dir) throw Error("\u4FDD\u5B58\u9818\u57DF\u3092\u958B\u3051\u307E\u305B\u3093");
    return await (await dir.getFileHandle(key)).getFile();
  }
  if (meta?.blob) return meta.blob;
  if (meta?.blocks) {
    if (lazy) {
      return { size: meta.size, slice(start2 = 0, end = meta.size) {
        return { async arrayBuffer() {
          const parts = [];
          let position = 0;
          for (let i = 0; i < meta.blocks && position < end; i++) {
            const size = meta.sizes?.[i] || Math.min(4 * 1024 ** 2, meta.size - position);
            if (position + size > start2) {
              const b = await get("blocks", `${key}:${i}`);
              if (!b) throw Error("\u4FDD\u5B58\u3055\u308C\u305F\u97F3\u6E90\u30D6\u30ED\u30C3\u30AF\u304C\u3042\u308A\u307E\u305B\u3093");
              const from = Math.max(0, start2 - position), to = Math.min(b.byteLength, end - position);
              parts.push(new Uint8Array(b, from, Math.max(0, to - from)));
            }
            position += size;
          }
          return await new Blob(parts).arrayBuffer();
        } };
      }, stream() {
        let index = 0;
        return new ReadableStream({ async pull(controller) {
          if (index >= meta.blocks) {
            controller.close();
            return;
          }
          const b = await get("blocks", `${key}:${index++}`);
          if (!b) {
            controller.error(Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u4E0D\u5B8C\u5168\u3067\u3059"));
            return;
          }
          controller.enqueue(new Uint8Array(b));
        } });
      } };
    }
    const blobs = [];
    for (let i = 0; i < meta.blocks; i++) {
      const b = await get("blocks", `${key}:${i}`);
      if (!b) throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u306E\u30D6\u30ED\u30C3\u30AF\u304C\u3042\u308A\u307E\u305B\u3093");
      blobs.push(b);
    }
    return new Blob(blobs, { type: meta.type || "audio/wav" });
  }
  throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
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
    const { current: current2, ...summary } = j;
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
      await new Promise((release) => resolve(release));
    }).catch(reject);
  });
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
var TYPES = { two: { label: "\u30DC\u30FC\u30AB\u30EB / \u4F34\u594F", stems: ["Vocals", "Instrumental"] }, four: { label: "4\u30B9\u30C6\u30E0", stems: ["Vocals", "Drums", "Bass", "Other"] }, six: { label: "6\u30B9\u30C6\u30E0", stems: ["Vocals", "Drums", "Bass", "Guitar", "Piano", "Other"] }, karaoke: { label: "\u30EA\u30FC\u30C9 / \u30B3\u30FC\u30E9\u30B9", stems: ["LeadVocal", "BackingVocal"] } };
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
function weightsFor(model, selected = model.stems) {
  if (!selected.length) return [];
  if (model.architecture) return model.weights;
  return model.weights.filter((w) => selected.includes(WEIGHTS[w].output) || selected.includes(WEIGHTS[w].residual));
}
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
function qualityLabel(modelId, mode) {
  return MODES[mode]?.label || mode;
}
function framesFor(mode, caps) {
  return mode === "best" && (!caps.memoryGB || caps.memoryGB < 8) ? 64 : MODES[mode].frames;
}
var LABELS = { LeadVocal: "\u30EA\u30FC\u30C9", BackingVocal: "\u30B3\u30FC\u30E9\u30B9", Vocals: "\u30DC\u30FC\u30AB\u30EB", Instrumental: "\u4F34\u594F", Drums: "\u30C9\u30E9\u30E0", Bass: "\u30D9\u30FC\u30B9", Other: "\u305D\u306E\u4ED6", Guitar: "\u30AE\u30BF\u30FC", Piano: "\u30D4\u30A2\u30CE" };

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
async function importModel(file) {
  const candidates = Object.values(WEIGHTS).filter((w) => w.import && w.bytes === file.size);
  if (!candidates.length) throw Error(`${file.name}: \u5BFE\u5FDC\u3059\u308B\u30E2\u30C7\u30EB\u3067\u306F\u3042\u308A\u307E\u305B\u3093`);
  const sum = await digest(await file.arrayBuffer()), m = candidates.find((w) => w.hash === sum);
  if (!m) throw Error(`${file.name}: \u5185\u5BB9\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093`);
  await writeFile(`model-${m.id}`, file);
  await put("models", m.id, { hash: m.hash, bytes: file.size, downloadedAt: (/* @__PURE__ */ new Date()).toISOString(), version: m.hash.slice(0, 8), imported: true });
  return m.id;
}
async function deleteModel(id) {
  await removeFile(`model-${id}`);
  await del("models", id);
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
async function saveInput(file, info2, key) {
  inputTiming = { fileRead: 0, decode: 0, resample: 0, inputStorage: 0 };
  const t = performance.now(), r = await prepareInput(file, info2, key);
  return { ...r, inputPerformance: { ...inputTiming, total: performance.now() - t, decodeApplicable: !info2.streaming, scope: "Main-thread input preparation elapsed; decode includes file read" } };
}
async function prepareInput(file, info2, key) {
  if (info2.streaming) {
    await inputTime("inputStorage", () => writeFile(key, file));
    return info2;
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
      for (let start2 = 0; start2 < buffer.length; start2 += 65536) {
        const count = Math.min(65536, buffer.length - start2), raw = new Float32Array(count * 2);
        for (let j = 0; j < count; j++) {
          raw[j * 2] = l[start2 + j];
          raw[j * 2 + 1] = r[start2 + j];
        }
        await inputTime("inputStorage", () => sink.write(new Uint8Array(raw.buffer)));
      }
    } finally {
      sink.close();
    }
    return { name: info2.name, size: buffer.length * 8, streaming: true, raw: true, frames: buffer.length, rate: 44100, channels: 2, align: 8, bits: 32, format: 3, dataOffset: 0, duration: buffer.length / 44100 };
  } finally {
    await ctx.close();
    await updateTrace({ audioBufferBytes: 0, audioContextClosed: true });
  }
}

// src/player.js
var Mixer = class {
  constructor(outputs) {
    this.outputs = outputs;
    this.tracks = [];
    this.ctx = null;
    this.playing = false;
    this.urls = [];
  }
  async add(stem, blob) {
    const url = URL.createObjectURL(blob);
    this.urls.push(url);
    const audio = new Audio(url);
    audio.preload = "metadata";
    audio.playsInline = true;
    const t = { stem, audio, volume: 1, mute: false, solo: false, gain: null };
    this.tracks.push(t);
    return t;
  }
  async init() {
    if (!this.ctx) {
      const C = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!C) throw Error("\u3053\u306E\u74B0\u5883\u3067\u306F\u97F3\u58F0\u30DF\u30AD\u30B5\u30FC\u3092\u5229\u7528\u3067\u304D\u307E\u305B\u3093");
      this.ctx = new C();
      for (const t of this.tracks) {
        const s = this.ctx.createMediaElementSource(t.audio), g = this.ctx.createGain();
        s.connect(g);
        g.connect(this.ctx.destination);
        t.gain = g;
      }
    }
    await this.ctx.resume();
    this.apply();
  }
  apply() {
    const solo = this.tracks.some((t) => t.solo);
    for (const t of this.tracks) {
      const v = t.mute || solo && !t.solo ? 0 : t.volume;
      if (t.gain) t.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
    }
  }
  async play(stem = null) {
    await this.init();
    if (stem) {
      for (const t of this.tracks) t.solo = t.stem === stem;
      this.apply();
    }
    const first = this.tracks[0];
    if (!first) return;
    if (first.audio.ended) this.seek(0);
    await Promise.all(this.tracks.map((t) => t.audio.play()));
    this.playing = true;
  }
  pause() {
    for (const t of this.tracks) t.audio.pause();
    this.playing = false;
  }
  seek(time) {
    for (const t of this.tracks) {
      try {
        t.audio.currentTime = time;
      } catch {
      }
    }
  }
  time() {
    return this.tracks[0]?.audio.currentTime || 0;
  }
  sync() {
    const t = this.time();
    if (this.tracks[0]?.audio.ended) {
      this.pause();
      return;
    }
    for (const track of this.tracks.slice(1)) if (Math.abs(track.audio.currentTime - t) > 0.15) track.audio.currentTime = t;
  }
  async destroy() {
    this.pause();
    for (const t of this.tracks) {
      t.audio.removeAttribute("src");
      t.audio.load();
    }
    await this.ctx?.close();
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.tracks = [];
  }
};

// src/app.js
var $ = (s) => document.querySelector(s);
var main = $("#main");
var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var mb = (n) => n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(1) + " GB" : Math.max(1, Math.round(n / 1024 ** 2)) + " MB";
var clock = (n) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
var svg = (d, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
var I = { up: "M12 16V4m0 0l-5 5m5-5l5 5M5 20h14", x: "M6 6l12 12M18 6L6 18", down: "M12 4v12m0 0l-5-5m5 5l5-5M5 20h14", trash: "M5 7h14M10 7V4h4v3m-7 0l1 13h8l1-13", check: "M5 12.5l4.5 4.5L19 7", note: "M9 18V5l11-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm11-2a3 3 0 11-6 0 3 3 0 016 0z", plus: "M12 5v14M5 12h14", chev: "M9 6l6 6-6 6", vol: "M5 9v6h4l5 4V5L9 9H5z", warn: "M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" };
var PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
var PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>';
var COLOR = { Vocals: "--c-vocals", Instrumental: "--c-inst", Drums: "--c-drums", Bass: "--c-bass", Other: "--c-other", Guitar: "--c-guitar", Piano: "--c-piano", LeadVocal: "--c-lead", BackingVocal: "--c-backing" };
var color = (s) => `var(${COLOR[s] || "--accent"})`;
var state = { type: "two", picks: {}, stems: {}, inputKind: "song", mode: "standard", backend: "auto", caps: null, file: null, audio: null, view: "home", busy: false, job: null, worker: null, exportWorker: null, exporting: false, mixer: null, pauseRequested: false };
if (globalThis.__STEMLIGHT_QA__) globalThis.__STEMLIGHT_STATE__ = state;
var initiallyControlled = !!navigator.serviceWorker?.controller;
var toastTimer = null;
var wake = null;
var downloadController = null;
var waitingSW = null;
var installPrompt = null;
var importTarget = null;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.display = "none", 3200);
}
function error(e) {
  $("#message-title").textContent = "\u30A8\u30E9\u30FC";
  $("#message-body").textContent = String(e?.message || e || "\u51E6\u7406\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F");
  if (!$("#message").open) $("#message").showModal();
}
function info(title, body) {
  $("#message-title").textContent = title;
  $("#message-body").textContent = body;
  if (!$("#message").open) $("#message").showModal();
}
$("#message-close").onclick = () => $("#message").close();
function nav(view) {
  state.view = view;
  for (const b of document.querySelectorAll("[data-nav]")) b.classList.toggle("active", b.dataset.nav === view);
  window.scrollTo(0, 0);
}
function bind(sel, fn) {
  const e = $(sel);
  if (e) e.onclick = fn;
}
function blocked() {
  if (state.exporting) {
    toast("ZIP\u3092\u4F5C\u6210\u4E2D\u3067\u3059");
    return true;
  }
  if (downloadController && !state.busy) {
    toast("\u30E2\u30C7\u30EB\u3092\u53D6\u5F97\u4E2D\u3067\u3059");
    return true;
  }
  return false;
}
async function disposeMixer() {
  if (state.mixer) {
    await state.mixer.destroy();
    state.mixer = null;
  }
}
var modelById = (id) => MODELS.find((m) => m.id === id);
function current() {
  const id = state.picks[state.type] || typeModels(state.type)[0].id, base = modelById(id);
  return modelFor({ ...base, inputKind: state.inputKind }, state.mode, state.caps);
}
function typeModels(type) {
  return MODELS.filter((m) => m.types.includes(type));
}
function selection(m) {
  const saved = state.stems[`${state.type}:${m.id}`];
  if (saved) return saved.filter((s) => m.stems.includes(s));
  return TYPES[state.type].stems.filter((s) => m.stems.includes(s));
}
var meter = (label, n) => `<span class="meter"><b>${label}</b>${[1, 2, 3].map((i) => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}</span>`;
function fits(m) {
  if (m.tier === "heavy" && !(state.caps.memoryGB >= 8)) return false;
  return true;
}
async function cachedAll(ids) {
  return (await Promise.all(ids.map(modelStatus))).every(Boolean);
}
async function home() {
  if (blocked()) return;
  if (state.busy) {
    processing();
    return;
  }
  await disposeMixer();
  nav("home");
  if (state.audio) return setup();
  const jobs = (await jobSummaries()).map(([, j]) => j).sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  main.innerHTML = `<h1>\u97F3\u6E90\u3092\u5206\u96E2</h1><button class="drop" id="choose"><span class="disc">${svg(I.up)}</span><strong>\u97F3\u6E90\u3092\u9078\u3076</strong><span>WAV \xB7 MP3 \xB7 M4A \xB7 FLAC</span></button>
 ${jobs.length ? `<span class="label">\u6700\u8FD1</span><div class="list">${jobs.map(jobRow).join("")}</div>` : ""}`;
  bind("#choose", () => $("#file").click());
  bindJobRows();
  dropTarget($("#choose"));
}
function jobRow(j) {
  const m = modelById(j.model);
  return `<button class="row" data-job="${esc(j.id)}"><div class="grow"><div class="title">${esc(j.name)}</div><div class="meta">${esc(m?.name || j.model)} \xB7 ${clock(j.audio?.duration || 0)}</div></div>${j.status === "complete" ? svg(I.chev) : `<span class="badge accent">\u518D\u958B</span>`}</button>`;
}
function bindJobRows() {
  for (const b of main.querySelectorAll("[data-job]")) b.onclick = () => openJob(b.dataset.job);
}
function dropTarget(el) {
  if (!el) return;
  el.ondragover = (e) => {
    e.preventDefault();
    el.classList.add("dragging");
  };
  el.ondragleave = () => el.classList.remove("dragging");
  el.ondrop = (e) => {
    e.preventDefault();
    el.classList.remove("dragging");
    const f = e.dataTransfer?.files?.[0];
    if (f) choose(f);
  };
}
async function choose(file, inputKind) {
  if (blocked() || !file || state.busy) return;
  try {
    await disposeMixer();
    const audio = await inspectAudio(file);
    state.audio = audio;
    state.file = file;
    if (inputKind) {
      state.inputKind = inputKind;
      state.type = "karaoke";
      state.picks.karaoke = "lead-backing";
    } else state.inputKind = "song";
    await setup();
  } catch (e) {
    error(e);
  }
}
$("#file").onchange = () => {
  const f = $("#file").files[0];
  $("#file").value = "";
  choose(f);
};
async function setup() {
  if (blocked()) return;
  nav("home");
  const caps = state.caps, a = state.audio, m = current(), selected = selection(m), e = estimate(m, state.mode, a, caps, selected), need = weightsFor(m, selected);
  const missing = [];
  for (const w of need) if (!await modelStatus(w)) missing.push(w);
  const needImport = missing.filter((w) => WEIGHTS[w].import && !WEIGHTS[w].url), download = missing.filter((w) => !needImport.includes(w)).reduce((n, w) => n + WEIGHTS[w].bytes, 0);
  const models2 = typeModels(state.type), status = Object.fromEntries(await Promise.all(models2.map(async (x) => [x.id, await cachedAll(modelFor({ ...x, inputKind: state.inputKind }, state.mode, caps).weights)])));
  const runtimeOK = caps.wasm && caps.simd && caps.worker, ready = runtimeOK && e.safe && selected.length && !needImport.length && fits(m);
  const reason = !runtimeOK ? "\u3053\u306E\u30D6\u30E9\u30A6\u30B6\u306F\u975E\u5BFE\u5FDC\u3067\u3059" : !fits(m) ? "RAM 8GB\u4EE5\u4E0A\u304C\u5FC5\u8981\u3067\u3059" : !e.memorySafe ? "\u30E1\u30E2\u30EA\u304C\u4E0D\u8DB3\u3059\u308B\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059" : !e.storageSafe ? "\u4FDD\u5B58\u9818\u57DF\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059" : "";
  main.innerHTML = `<div class="file"><span class="note">${svg(I.note)}</span><div class="grow" style="flex:1;min-width:0"><div class="title" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.name)}</div><div class="sub" style="font-size:12px;margin-top:2px">${clock(a.duration)}${a.streaming ? ` \xB7 ${a.rate / 1e3} kHz` : ""}</div></div><button class="icon-btn plain" id="clear" aria-label="\u97F3\u6E90\u3092\u5916\u3059">${svg(I.x)}</button></div>
 <span class="label">\u5206\u96E2</span><div class="chips">${Object.entries(TYPES).map(([id, t]) => `<button class="chip ${id === state.type ? "on" : ""}" data-type="${id}">${t.label}</button>`).join("")}</div>
 ${state.type === "karaoke" ? `<span class="label">\u5165\u529B</span><div class="seg"><button data-kind="song" class="${state.inputKind === "song" ? "on" : ""}">\u66F2</button><button data-kind="vocals" class="${state.inputKind === "vocals" ? "on" : ""}">\u30DC\u30FC\u30AB\u30EB\u306E\u307F</button></div>` : ""}
 <span class="label">\u30E2\u30C7\u30EB</span><div class="list">${models2.map((x) => {
    const on = x.id === m.id, ok = fits(x), imp = x.weights.some((w) => WEIGHTS[w].import && !WEIGHTS[w].url);
    return `<button class="model ${on ? "on" : ""}" data-model="${x.id}" aria-pressed="${on}" ${ok ? "" : 'aria-disabled="true"'}><span class="name">${esc(x.name)}</span><span class="side">${status[x.id] ? svg(I.check) : imp ? '<span class="badge">\u8981\u8FFD\u52A0</span>' : mb(modelFor({ ...x, inputKind: state.inputKind }, state.mode, caps).bytes)}</span><span class="meta">${esc(x.by)} ${meter("\u901F\u5EA6", x.speed)} ${meter("\u54C1\u8CEA", x.quality)}</span></button>`;
  }).join("")}</div>
 <span class="label">\u30B9\u30C6\u30E0</span><div class="stems">${m.stems.map((s) => `<button class="stem ${selected.includes(s) ? "on" : ""}" data-stem="${s}" style="--c:${color(s)}"><i></i>${LABELS[s]}</button>`).join("")}</div>
 <span class="label">\u54C1\u8CEA</span><div class="seg">${Object.entries(MODES).map(([id, q]) => `<button data-mode="${id}" class="${state.mode === id ? "on" : ""}">${q.label}</button>`).join("")}</div>
 ${(m.architecture === "bs-roformer" || !m.architecture) && caps.webgpu ? `<details class="more"><summary>\u8A73\u7D30</summary><select id="backend" aria-label="\u5B9F\u884C"><option value="auto" ${state.backend === "auto" ? "selected" : ""}>\u81EA\u52D5</option><option value="wasm" ${state.backend === "wasm" ? "selected" : ""}>CPU (WASM)</option>${m.architecture === "bs-roformer" ? `<option value="webgpu" ${state.backend === "webgpu" ? "selected" : ""}>GPU (WebGPU)</option>` : ""}</select></details>` : ""}
 <div class="actions">${needImport.length ? `<button class="primary" id="add-model">${svg(I.plus)}\u30E2\u30C7\u30EB\u30D5\u30A1\u30A4\u30EB\u3092\u8FFD\u52A0</button><p class="sub" style="text-align:center;font-size:12px">${needImport.map((w) => `<code>${esc(WEIGHTS[w].file)}</code>`).join(" + ")}</p>` : `<button class="primary" id="start" ${ready ? "" : "disabled"}>${download ? `\u53D6\u5F97\u3057\u3066\u5206\u96E2 \xB7 ${mb(download)}` : "\u5206\u96E2"}</button>`}</div>
 ${reason ? `<div class="warn">${svg(I.warn)}${reason}</div>` : ""}`;
  bind("#clear", async () => {
    state.audio = null;
    state.file = null;
    await home();
  });
  for (const b of main.querySelectorAll("[data-type]")) b.onclick = async () => {
    state.type = b.dataset.type;
    await setup();
  };
  for (const b of main.querySelectorAll("[data-kind]")) b.onclick = async () => {
    state.inputKind = b.dataset.kind;
    await setup();
  };
  for (const b of main.querySelectorAll("[data-model]")) b.onclick = async () => {
    if (b.getAttribute("aria-disabled") === "true") {
      toast("RAM 8GB\u4EE5\u4E0A\u304C\u5FC5\u8981\u3067\u3059");
      return;
    }
    state.picks[state.type] = b.dataset.model;
    await setup();
  };
  for (const b of main.querySelectorAll("[data-stem]")) b.onclick = async () => {
    const key = `${state.type}:${m.id}`, cur = selection(m), s = b.dataset.stem, next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
    state.stems[key] = m.stems.filter((x) => next.includes(x));
    await setup();
  };
  for (const b of main.querySelectorAll("[data-mode]")) b.onclick = async () => {
    state.mode = b.dataset.mode;
    await setup();
  };
  if ($("#backend")) $("#backend").onchange = (ev) => state.backend = ev.target.value;
  bind("#add-model", () => {
    importTarget = setup;
    $("#model-file").click();
  });
  bind("#start", start);
}
async function keepAwake() {
  try {
    wake = await navigator.wakeLock?.request("screen");
  } catch {
  }
}
async function releaseAwake() {
  await wake?.release().catch(() => {
  });
  wake = null;
}
async function start() {
  if ((await navigator.locks?.query())?.held.some((l) => l.name === "stemlight-performance-benchmark")) {
    toast("\u8A3A\u65AD\u30D9\u30F3\u30C1\u5B9F\u884C\u4E2D\u3067\u3059");
    return;
  }
  if (blocked() || state.busy) return;
  const m = current(), selected = selection(m), e = estimate(m, state.mode, state.audio, state.caps, selected);
  if (!e.safe) {
    error(Error("\u30E1\u30E2\u30EA\u307E\u305F\u306F\u4FDD\u5B58\u9818\u57DF\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059"));
    return;
  }
  state.busy = true;
  state.pauseRequested = false;
  await beginTrace(m.id);
  await disposeMixer();
  processing({ name: state.audio.name });
  try {
    state.modelLease = await acquireModelLease();
    await keepAwake();
    downloadController = new AbortController();
    for (const w of weightsFor(m, selected)) await downloadModel(w, (f) => progress({ stage: `\u30E2\u30C7\u30EB\u3092\u53D6\u5F97 \xB7 ${Math.floor(f * 100)}%`, percent: f * 100, stem: "Download" }), downloadController.signal);
    downloadController = null;
    progress({ stage: "\u97F3\u6E90\u3092\u6E96\u5099", percent: 0 });
    const id = crypto.randomUUID(), input = `input-${id}`, audio = await saveInput(state.file, state.audio, input);
    const job = { id, input, audio, name: state.audio.name, model: m.id, mode: state.mode, selected: [...selected], backend: m.architecture === "lead-backing" ? "wasm" : state.backend, pipeline: m.architecture === "lead-backing" ? { phase: state.inputKind === "vocals" ? "karaoke" : "vocals", inputKind: state.inputKind, transitions: [] } : null, caps: state.caps, status: "paused", createdAt: Date.now(), startedAt: Date.now() };
    await put("jobs", id, job);
    state.job = job;
    await put("settings", "last", { type: state.type, picks: state.picks, stems: state.stems, mode: state.mode, backend: state.backend });
    state.audio = null;
    state.file = null;
    await launch(job);
  } catch (e2) {
    if (state.worker || state.modelLease) await stopped();
    state.busy = false;
    await releaseAwake();
    if (e2?.name === "AbortError") toast("\u53D6\u5F97\u3092\u4E2D\u6B62\u3057\u307E\u3057\u305F");
    else error(e2);
    await setup().catch(() => home());
  }
}
function processing(j = state.job) {
  nav("home");
  main.innerHTML = `<div class="progress"><div class="ring"><svg viewBox="0 0 220 220"><circle class="track" cx="110" cy="110" r="100"/><circle class="bar" id="ring" cx="110" cy="110" r="100" stroke-dasharray="628.3" stroke-dashoffset="628.3"/></svg><div class="center"><strong><span id="percent">0</span><small>%</small></strong><span class="elapsed" id="elapsed"></span></div></div>
 <h2 style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(j?.name || "")}</h2><div class="stage" id="stage">\u6E96\u5099\u4E2D</div><div class="actions"><button class="secondary" id="pause">\u4E00\u6642\u505C\u6B62</button></div></div>`;
  bind("#pause", () => {
    autoPaused = null;
    pause();
  });
}
function progress(d) {
  if (state.view !== "home" || !$("#percent")) return;
  const pipe = state.job?.pipeline;
  if (pipe?.inputKind === "song" && d.stem !== "Download") {
    const half = pipe.phase === "vocals" ? 0 : 50;
    d = { ...d, percent: half + (d.percent || 0) / 2 };
  }
  const p = Math.max(0, Math.min(100, d.percent || 0));
  $("#percent").textContent = Math.floor(p);
  $("#ring").setAttribute("stroke-dashoffset", String(628.3 * (1 - p / 100)));
  const m = modelById(state.job?.model);
  let line = d.stage || "";
  if (d.processedSeconds != null && state.job) line = `${m?.name || ""} \xB7 ${clock(d.processedSeconds)} / ${clock(state.job.audio.duration)}`;
  $("#stage").textContent = line;
  if (d.elapsed) $("#elapsed").textContent = clock(d.elapsed / 1e3);
}
async function launch(job) {
  if ((await navigator.locks?.query())?.held.some((l) => l.name === "stemlight-performance-benchmark")) throw Error("\u8A3A\u65AD\u30D9\u30F3\u30C1\u5B9F\u884C\u4E2D\u3067\u3059");
  if (state.worker) await stopped();
  state.modelLease ||= await acquireModelLease();
  if (snapshot()?.selectedModel !== job.model) await beginTrace(job.model);
  await disposeMixer();
  state.job = job;
  state.loadTrace = null;
  state.busy = true;
  processing(job);
  await keepAwake();
  const w = await stage("Worker start", async () => {
    const worker = new Worker(labURL("engine-worker.js"), { type: "module" });
    state.worker = worker;
    return worker;
  });
  await updateTrace({ activeWorkers: 1, pipelinePhase: job.pipeline?.phase || null });
  state.worker = w;
  w.onerror = async (ev) => {
    state.loadTrace = { ...state.loadTrace || snapshot() || {}, exception: { stage: "Worker startup/runtime", message: String(ev.message || "Worker stopped"), stack: ev.error?.stack || null } };
    await stopped();
    error(Error(`\u51E6\u7406\u304C\u505C\u6B62\u3057\u307E\u3057\u305F\uFF08${ev.message || "\u30E1\u30E2\u30EA\u4E0D\u8DB3\u306E\u53EF\u80FD\u6027"}\uFF09\u3002\u30E9\u30A4\u30D6\u30E9\u30EA\u304B\u3089\u518D\u958B\u3067\u304D\u307E\u3059`));
    await library();
  };
  w.onmessage = async ({ data: d }) => {
    if (state.worker !== w) return;
    try {
      if (d.loadTrace) {
        state.loadTrace = d.loadTrace;
        return;
      }
      if (d.notice) return;
      if (d.error) {
        await stopped();
        error(Error(`${d.error}
\u30E9\u30A4\u30D6\u30E9\u30EA\u304B\u3089\u518D\u958B\u3067\u304D\u307E\u3059`));
        await library();
        return;
      }
      if (d.paused) {
        await stopped();
        toast("\u4E00\u6642\u505C\u6B62\u3057\u307E\u3057\u305F");
        await library();
        return;
      }
      if (d.nextStage) {
        await stopped();
        state.busy = true;
        const next = await get("jobs", job.id);
        next.pipeline.transitions.push({ at: Date.now(), stage: "SCNet cleanup before Karaoke 2", workerTerminated: true, activeWorkers: 0, activeSessions: state.loadTrace?.activeSessions, release: state.loadTrace?.cleanup, WASMLinearMemoryBytes: state.loadTrace?.WASMLinearMemoryBytes ?? null });
        await put("jobs", job.id, next);
        if (state.pauseRequested || document.hidden) {
          state.busy = false;
          toast("\u4E00\u6642\u505C\u6B62\u3057\u307E\u3057\u305F");
          await library();
          return;
        }
        await launch(next);
        return;
      }
      if (d.complete) {
        await stopped();
        state.busy = true;
        const done = await get("jobs", job.id);
        if (done.pipeline?.intermediate) {
          await removeFile(done.pipeline.intermediate.key);
          done.pipeline.intermediateRemoved = true;
          await put("jobs", done.id, done);
        }
        state.busy = false;
        await results(done);
        return;
      }
      progress(d);
    } catch (e) {
      await stopped();
      error(e);
      await library();
    }
  };
  w.postMessage({ type: "start", id: job.id, postedAt: performance.timeOrigin + performance.now() });
}
async function stopped() {
  const worker = state.worker;
  worker?.terminate();
  state.worker = null;
  state.modelLease?.();
  state.modelLease = null;
  state.loadTrace = { ...state.loadTrace || snapshot() || {}, activeWorkers: 0, activeSessions: 0, loadedModel: null, arrayBufferBytes: 0, workerTerminated: !!worker, OSMemoryReclaimed: null };
  await put("settings", "load-trace", state.loadTrace).catch(() => {
  });
  state.busy = false;
  downloadController = null;
  await releaseAwake();
}
async function pause() {
  state.pauseRequested = true;
  if (downloadController) {
    downloadController.abort();
    return;
  }
  if (state.worker) {
    const w = state.worker;
    w.postMessage({ type: "pause" });
    if ($("#stage")) $("#stage").textContent = "\u4E00\u6642\u505C\u6B62\u4E2D\u2026";
    if ($("#pause")) $("#pause").disabled = true;
    setTimeout(async () => {
      if (!state.busy || state.worker !== w) return;
      await stopped();
      toast("\u4E00\u6642\u505C\u6B62\u3057\u307E\u3057\u305F");
      await library();
    }, 12e3);
  }
}
async function openJob(id) {
  if (blocked()) return;
  if (state.busy) {
    toast("\u51E6\u7406\u4E2D\u3067\u3059");
    return;
  }
  const j = await get("jobs", id);
  if (!j) return;
  if (j.status === "complete") {
    await results(j);
    return;
  }
  await disposeMixer();
  state.job = j;
  nav("library");
  const m = modelById(j.model), done = j.current?.next ? j.current.next / 44100 : j.current?.index && j.metrics?.plannedChunks ? j.audio.duration * j.current.index / j.metrics.plannedChunks : 0;
  main.innerHTML = `<h1>${esc(j.name)}</h1><p class="sub">${esc(m?.name || j.model)} \xB7 ${qualityLabel(j.model, j.mode)} \xB7 ${clock(Math.min(done, j.audio.duration))} / ${clock(j.audio.duration)}</p>${j.error ? `<div class="warn">${svg(I.warn)}${esc(j.error)}</div>` : ""}<div class="actions"><button class="primary" id="resume">\u518D\u958B</button><button class="secondary" id="back">\u623B\u308B</button></div>`;
  bind("#back", library);
  bind("#resume", () => resumeJob(j));
}
async function resumeJob(j) {
  if (state.busy) return;
  state.busy = true;
  try {
    await fileSize(j.pipeline?.phase === "karaoke" && j.pipeline.intermediate ? j.pipeline.intermediate.key : j.input);
    const caps = await capabilities(), mm = modelFor({ ...modelById(j.model), inputKind: j.pipeline?.phase === "karaoke" ? "vocals" : j.pipeline?.inputKind }, j.mode, caps, j.frames), e = estimate(mm, j.mode, j.audio, caps, j.selected);
    if (!e.safe) throw Error("\u3053\u306E\u7AEF\u672B\u3067\u306F\u518D\u958B\u3067\u304D\u307E\u305B\u3093\uFF08\u30E1\u30E2\u30EA\u4E0D\u8DB3\uFF09");
    for (const w of weightsFor(mm, j.selected)) if (!await modelStatus(w)) await downloadModel(w, (f) => toast(`\u30E2\u30C7\u30EB\u3092\u53D6\u5F97 ${Math.floor(f * 100)}%`));
    j.caps = caps;
    state.pauseRequested = false;
    await put("jobs", j.id, j);
    await launch(j);
  } catch (e) {
    if (state.worker || state.modelLease) await stopped();
    else state.busy = false;
    error(e);
  }
}
async function library() {
  if (blocked()) return;
  if (state.busy) {
    processing();
    return;
  }
  await disposeMixer();
  nav("library");
  const jobs = (await jobSummaries()).map(([, j]) => j).sort((a, b) => b.createdAt - a.createdAt);
  main.innerHTML = `<h1>\u30E9\u30A4\u30D6\u30E9\u30EA</h1>${jobs.length ? `<div class="list">${jobs.map((j) => `<div class="row" style="padding-right:8px"><button class="grow" data-job="${esc(j.id)}" style="all:unset;flex:1;min-width:0;cursor:pointer"><div class="title">${esc(j.name)}</div><div class="meta">${esc(modelById(j.model)?.name || j.model)} \xB7 ${clock(j.audio?.duration || 0)} \xB7 ${new Date(j.createdAt).toLocaleDateString()}</div></button>${j.status === "complete" ? "" : '<span class="badge accent">\u518D\u958B</span>'}<button class="icon-btn plain" data-delete="${esc(j.id)}" aria-label="\u524A\u9664">${svg(I.trash)}</button></div>`).join("")}</div>` : `<div class="empty"><p>\u307E\u3060\u3042\u308A\u307E\u305B\u3093</p><button class="secondary" id="new">\u97F3\u6E90\u3092\u9078\u3076</button></div>`}`;
  bindJobRows();
  for (const b of main.querySelectorAll("[data-delete]")) b.onclick = async () => {
    if (!confirm("\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F")) return;
    const j = await get("jobs", b.dataset.delete);
    await removeFile(j.input);
    if (j.pipeline?.intermediate) await removeFile(j.pipeline.intermediate.key);
    for (const s of j.selected) await removeFile(`out-${j.id}-${s.toLowerCase()}`);
    await removeFile(`zip-${j.id}`);
    await del("jobs", j.id);
    await library();
  };
  bind("#new", () => $("#file").click());
}
function paint(canvas, wave, c) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth || 320, h = 44;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(COLOR[c] || "--accent").trim() || "#9df0c8";
  const max = Math.max(...wave, 1e-6), bw = w / wave.length;
  for (let j = 0; j < wave.length; j++) {
    const v = Math.max(1, wave[j] / max * (h / 2 - 2));
    ctx.globalAlpha = 0.85;
    ctx.fillRect(j * bw, h / 2 - v, Math.max(1, bw - 1), v * 2);
  }
}
async function results(job) {
  if (state.busy) return;
  await disposeMixer();
  const m = modelById(job.model), order = m?.stems || [];
  job = { ...job, outputs: [...job.outputs].sort((x, y) => order.indexOf(x.stem) - order.indexOf(y.stem)) };
  state.job = job;
  nav("library");
  const karaoke = job.outputs.some((o) => o.stem === "Vocals") && job.model !== "lead-backing";
  main.innerHTML = `<h1>${esc(job.name)}</h1><p class="sub" style="margin:-8px 0 14px">${esc(m?.name || job.model)} \xB7 ${qualityLabel(job.model, job.mode)} \xB7 ${clock(job.audio.duration)}</p>
 <div class="transport"><button class="play" id="play" aria-label="\u518D\u751F">${PLAY}</button><input id="seek" aria-label="\u518D\u751F\u4F4D\u7F6E" type="range" min="0" max="${job.audio.duration}" step="0.05" value="0"><span id="position" class="time">0:00</span></div>
 ${job.outputs.map((o) => `<div class="track" style="--c:${color(o.stem)}"><div class="track-head"><span class="name"><i></i>${LABELS[o.stem] || o.stem}</span><button class="toggle" data-solo="${o.stem}" aria-label="${LABELS[o.stem]}\u3092\u30BD\u30ED">S</button><button class="toggle" data-mute="${o.stem}" aria-label="${LABELS[o.stem]}\u3092\u30DF\u30E5\u30FC\u30C8">M</button><button class="icon-btn" data-export="${o.stem}" aria-label="${LABELS[o.stem]}\u3092\u4FDD\u5B58">${svg(I.down)}</button></div><canvas id="wave-${o.stem}"></canvas><div class="vol">${svg(I.vol)}<input data-volume="${o.stem}" aria-label="${LABELS[o.stem]}\u306E\u97F3\u91CF" type="range" min="0" max="1" step="0.01" value="1"></div></div>`).join("")}
 <div class="actions"><button class="primary" id="zip">${svg(I.down)}\u3059\u3079\u3066\u4FDD\u5B58 (ZIP)</button>${karaoke ? '<button class="secondary" id="split-vocals">\u30DC\u30FC\u30AB\u30EB\u3092\u30EA\u30FC\u30C9 / \u30B3\u30FC\u30E9\u30B9\u306B\u5206\u3051\u308B</button>' : ""}<button class="secondary" id="new">\u65B0\u3057\u3044\u97F3\u6E90</button></div>`;
  bind("#split-vocals", async () => {
    if (state.exporting || state.busy) return;
    try {
      await disposeMixer();
      const o = job.outputs.find((o2) => o2.stem === "Vocals"), blob = await readFile(o.key);
      await choose(new File([blob], `${cleanName(job.name)}_Vocals.wav`, { type: "audio/wav" }), "vocals");
    } catch (e) {
      error(e);
    }
  });
  bind("#zip", () => exportAll(job));
  bind("#new", () => $("#file").click());
  const mixer = new Mixer(job.outputs);
  state.mixer = mixer;
  try {
    for (const o of job.outputs) {
      const blob = await readFile(o.key);
      if (state.mixer !== mixer) return;
      if (blob.size !== o.bytes) throw Error("\u7D50\u679C\u30D5\u30A1\u30A4\u30EB\u304C\u4E0D\u5B8C\u5168\u3067\u3059");
      await mixer.add(o.stem, blob);
      if (state.mixer !== mixer) return;
      paint($(`#wave-${o.stem}`), o.waveform, o.stem);
    }
  } catch (e) {
    if (state.mixer === mixer) error(e);
    return;
  }
  if (state.mixer !== mixer) return;
  const refresh = () => {
    for (const t of mixer.tracks) {
      $(`[data-solo="${t.stem}"]`)?.classList.toggle("on", t.solo);
      $(`[data-mute="${t.stem}"]`)?.classList.toggle("on", t.mute);
    }
  };
  bind("#play", async () => {
    try {
      if (mixer.playing) {
        mixer.pause();
        $("#play").innerHTML = PLAY;
      } else {
        await mixer.play();
        $("#play").innerHTML = PAUSE;
        refresh();
      }
    } catch (e) {
      error(e);
    }
  });
  for (const b of main.querySelectorAll("[data-solo],[data-mute]")) b.onclick = () => {
    const s = b.dataset.solo || b.dataset.mute, t = mixer.tracks.find((t2) => t2.stem === s), k = b.dataset.solo ? "solo" : "mute";
    t[k] = !t[k];
    mixer.apply();
    refresh();
  };
  for (const i of main.querySelectorAll("[data-volume]")) i.oninput = () => {
    mixer.tracks.find((t) => t.stem === i.dataset.volume).volume = Number(i.value);
    mixer.apply();
  };
  $("#seek").oninput = (e) => mixer.seek(Number(e.target.value));
  for (const b of main.querySelectorAll("[data-export]")) b.onclick = async () => {
    try {
      const o = job.outputs.find((o2) => o2.stem === b.dataset.export);
      await exportBlob(await readFile(o.key), `${cleanName(job.name)}_${o.stem}.wav`);
    } catch (e) {
      error(e);
    }
  };
  mixer.ready = true;
  const tick = () => {
    if (state.mixer !== mixer) return;
    mixer.sync();
    const t = mixer.time();
    if ($("#seek") && document.activeElement !== $("#seek")) $("#seek").value = t;
    if ($("#position")) $("#position").textContent = clock(t);
    if (!mixer.playing && $("#play") && !$("#play").innerHTML.includes("5.5v13")) $("#play").innerHTML = PLAY;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function cleanName(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) || "stemlight";
}
async function exportBlob(blob, name) {
  const file = new File([blob], name, { type: name.endsWith(".wav") ? "audio/wav" : "application/zip" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file), a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
async function exportAll(job) {
  const b = $("#zip");
  if (b.disabled || state.busy || state.exporting) return;
  state.exporting = true;
  b.disabled = true;
  const label = b.innerHTML;
  b.textContent = "ZIP\u3092\u4F5C\u6210\u4E2D\u2026";
  try {
    const caps = await capabilities(), size = job.outputs.reduce((s, o) => s + o.bytes, 0);
    if (caps.storage.quota && caps.storage.quota - caps.storage.usage < size * 1.1) throw Error("\u7A7A\u304D\u5BB9\u91CF\u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\u3002\u500B\u5225\u306B\u4FDD\u5B58\u3057\u3066\u304F\u3060\u3055\u3044");
    const w = new Worker("export-worker.js", { type: "module" });
    state.exportWorker = w;
    const key = await new Promise((resolve, reject) => {
      w.onmessage = ({ data: d }) => {
        if (d.error) {
          w.terminate();
          reject(Error(d.error));
        } else if (d.complete) {
          w.terminate();
          resolve(d.key);
        } else if (d.progress) b.textContent = `ZIP\u3092\u4F5C\u6210\u4E2D\u2026 ${Math.round(d.progress * 100)}%`;
      };
      w.onerror = (e) => {
        w.terminate();
        reject(Error(e.message));
      };
      w.postMessage({ id: job.id, outputs: job.outputs });
    });
    await exportBlob(await readFile(key), `${cleanName(job.name)}_stems.zip`);
  } catch (e) {
    error(e);
  } finally {
    state.exportWorker?.terminate();
    state.exportWorker = null;
    state.exporting = false;
    b.disabled = false;
    b.innerHTML = label;
  }
}
function ownWeights() {
  const seen = /* @__PURE__ */ new Set(), own = {};
  for (const m of MODELS) {
    const ws = [...m.weights, ...m.architecture === "scnet" ? ["scnet-base"] : []].filter((w) => !seen.has(w));
    ws.forEach((w) => seen.add(w));
    own[m.id] = ws;
  }
  return own;
}
async function models() {
  if (blocked()) return;
  if (state.busy) {
    toast("\u51E6\u7406\u4E2D\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093");
    processing();
    return;
  }
  await disposeMixer();
  nav("models");
  const caps = await capabilities(), own = ownWeights(), st = Object.fromEntries(await Promise.all(Object.keys(WEIGHTS).map(async (w) => [w, await modelStatus(w)])));
  const used = caps.storage.usage || 0, quota = caps.storage.quota || 0;
  main.innerHTML = `<h1>\u30E2\u30C7\u30EB</h1>${quota ? `<div class="storage"><div class="nums"><span>\u4F7F\u7528 ${mb(used)}</span><span>\u7A7A\u304D ${mb(Math.max(0, quota - used))}</span></div><div class="bar"><i style="width:${Math.min(100, used / quota * 100).toFixed(1)}%"></i></div></div><span class="label">\u7AEF\u672B\u306B\u4FDD\u5B58</span>` : ""}
 <div class="list">${MODELS.filter((m) => own[m.id].length).map((m) => {
    const ws = own[m.id], have = ws.filter((w) => st[w]), core = m.architecture === "scnet" ? ["scnet-base-64"] : ws, complete = core.every((w) => st[w]), imp = ws.some((w) => WEIGHTS[w].import && !WEIGHTS[w].url), size = core.reduce((n, w) => n + WEIGHTS[w].bytes, 0);
    return `<div class="pack" data-pack="${m.id}"><div class="pack-head"><div class="grow"><div class="name">${esc(m.name)}</div><div class="meta">${esc(m.by)} \xB7 ${mb(size)} \xB7 ${m.stems.filter((s) => s !== "Instrumental" || m.stems.length === 2).map((s) => LABELS[s]).join(" / ")}</div></div>${complete ? `<button class="icon-btn plain" data-remove="${m.id}" aria-label="${esc(m.name)}\u3092\u524A\u9664">${svg(I.trash)}</button>` : imp ? `<button class="small-btn" data-import="${m.id}">${svg(I.plus, "ico")}</button>` : `<button class="small-btn accent" data-download="${m.id}">\u53D6\u5F97</button>`}</div>${imp && !complete ? `<code>${ws.filter((w) => !st[w]).map((w) => esc(WEIGHTS[w].file)).join("<br>")}</code>` : ""}<progress class="hidden" value="0" max="1"></progress></div>`;
  }).join("")}</div>
 <div class="links"><button id="install">\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0</button><a href="licenses.html">\u30E9\u30A4\u30BB\u30F3\u30B9</a><a href="diagnostics.html">\u8A3A\u65AD</a></div>`;
  for (const b of main.querySelectorAll("[data-download]")) b.onclick = async () => {
    if (downloadController) return;
    const m = modelById(b.dataset.download), ws = (m.architecture === "scnet" ? ["scnet-base-64"] : own[m.id]).filter((w) => !WEIGHTS[w].import || WEIGHTS[w].url), p = b.closest(".pack").querySelector("progress");
    p.classList.remove("hidden");
    for (const x of main.querySelectorAll("button")) x.disabled = true;
    downloadController = new AbortController();
    try {
      const total = ws.reduce((n, w) => n + WEIGHTS[w].bytes, 0);
      let base = 0;
      for (const w of ws) {
        await downloadModel(w, (f) => p.value = (base + f * WEIGHTS[w].bytes) / total, downloadController.signal);
        base += WEIGHTS[w].bytes;
      }
      downloadController = null;
      toast("\u4FDD\u5B58\u3057\u307E\u3057\u305F");
    } catch (e) {
      downloadController = null;
      error(e);
    }
    await models();
  };
  for (const b of main.querySelectorAll("[data-remove]")) b.onclick = async () => {
    if (!confirm("\u3053\u306E\u30E2\u30C7\u30EB\u3092\u524A\u9664\u3057\u307E\u3059\u304B\uFF1F")) return;
    for (const w of own[b.dataset.remove]) await deleteModel(w);
    await models();
  };
  for (const b of main.querySelectorAll("[data-import]")) b.onclick = () => {
    importTarget = models;
    $("#model-file").click();
  };
  bind("#install", install);
}
$("#model-file").onchange = async () => {
  const files = [...$("#model-file").files];
  $("#model-file").value = "";
  if (!files.length) return;
  const back = importTarget || models;
  importTarget = null;
  toast("\u78BA\u8A8D\u3057\u3066\u3044\u307E\u3059\u2026");
  const added = [], failed = [];
  for (const f of files) {
    try {
      added.push(WEIGHTS[await importModel(f)].name);
    } catch (e) {
      failed.push(e.message);
    }
  }
  if (failed.length) error(Error(failed.join("\n")));
  else toast(`\u8FFD\u52A0\u3057\u307E\u3057\u305F: ${added.join(", ")}`);
  await back();
};
async function install() {
  if (installPrompt) {
    await installPrompt.prompt();
    installPrompt = null;
    return;
  }
  info("\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0", /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && "ontouchend" in document ? "\u5171\u6709\u30DC\u30BF\u30F3 \u2192\u300C\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0\u300D" : "\u30D6\u30E9\u30A6\u30B6\u306E\u30E1\u30CB\u30E5\u30FC \u2192\u300C\u30A2\u30D7\u30EA\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u300D");
}
for (const b of document.querySelectorAll("[data-nav]")) b.onclick = () => ({ home, library, models })[b.dataset.nav]();
$(".brand").onclick = (e) => {
  e.preventDefault();
  home();
};
$("#update").onclick = () => {
  if (state.busy) {
    toast("\u51E6\u7406\u5F8C\u306B\u66F4\u65B0\u3067\u304D\u307E\u3059");
    return;
  }
  waitingSW?.postMessage({ type: "ACTIVATE" });
};
function online() {
  $("#offline").classList.toggle("hidden", navigator.onLine);
}
window.addEventListener("online", online);
window.addEventListener("offline", online);
var autoPaused = null;
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) {
    if (state.busy && state.job) {
      autoPaused = state.job.id;
      pause();
    }
    return;
  }
  if (state.busy) {
    keepAwake();
    return;
  }
  if (autoPaused) {
    const id = autoPaused;
    autoPaused = null;
    for (let k = 0; k < 30 && state.busy; k++) await new Promise((r) => setTimeout(r, 400));
    const j = await get("jobs", id);
    if (j && j.status !== "complete" && !state.busy) await resumeJob(j);
  }
});
window.addEventListener("pagehide", () => state.worker?.postMessage({ type: "pause" }));
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
dropTarget(document.body);
async function init() {
  state.caps = await capabilities();
  const last = await get("settings", "last");
  if (last?.picks) {
    state.type = TYPES[last.type] ? last.type : "two";
    state.picks = Object.fromEntries(Object.entries(last.picks).filter(([t, id]) => TYPES[t] && modelById(id)?.types.includes(t)));
    state.stems = last.stems || {};
    if (MODES[last.mode]) state.mode = last.mode;
    state.backend = last.backend || "auto";
  }
  online();
  await home();
  if ("serviceWorker" in navigator) {
    try {
      const r = await navigator.serviceWorker.register("sw.js");
      waitingSW = r.waiting;
      $("#update").classList.toggle("hidden", !waitingSW);
      r.addEventListener("updatefound", () => {
        const w = r.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            waitingSW = w;
            $("#update").classList.remove("hidden");
          }
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading || state.busy) return;
        if (initiallyControlled || !globalThis.crossOriginIsolated) {
          reloading = true;
          location.reload();
        }
      });
    } catch {
    }
  }
}
init().catch(error);
//# sourceMappingURL=app.js.map
