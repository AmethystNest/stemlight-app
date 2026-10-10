var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn2, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn2 && (res = (0, fn2[__getOwnPropNames(fn2)[0]])(fn2 = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/benchmark-policy.js
function benchmarkThreads(job) {
  if (!job.benchmark) return job.caps.shared ? Math.max(1, Math.min(2, Math.floor(job.caps.cores / 2))) : 1;
  const n = job.benchmark.threads;
  if (![1, 2, 3, 4].includes(n)) throw Error("Invalid benchmark threads");
  if (n > 1 && !job.caps.shared) throw Error("WASM threads unavailable");
  return n;
}
var init_benchmark_policy = __esm({
  "src/benchmark-policy.js"() {
  }
});

// src/performance.js
function beginPerformance(job) {
  if (!job) {
    active = null;
    return;
  }
  const phase = job.pipeline?.phase || "separation", previous = job.metrics?.performance;
  active = previous?.phase === phase ? structuredClone(previous) : { schema: 1, phase, timings: {}, runtime: null, audioDuration: job.audio?.duration ?? null, scope: "Worker elapsed time; overlapping/inclusive categories must not be summed", memory: "No total process/GPU RAM measurement" };
}
function addTime(name, ms) {
  if (!active) return;
  const t = active.timings[name] ||= { ms: 0, calls: 0 };
  t.ms += ms;
  t.calls++;
}
function measure(name, fn2) {
  const t = performance.now();
  try {
    return fn2();
  } finally {
    addTime(name, performance.now() - t);
  }
}
async function measureAsync(name, fn2) {
  const t = performance.now();
  try {
    return await fn2();
  } finally {
    addTime(name, performance.now() - t);
  }
}
function runtimePerformance(runtime, provider) {
  if (!active) return;
  active.runtime = { backend: provider, threads: runtime.env.wasm.numThreads, simdFlag: runtime.env.wasm.simd ?? true, wasmPaths: runtime.env.wasm.wasmPaths, binary: provider === "wasm" ? "ort-wasm-simd-threaded.wasm" : null, binaryEvidence: provider === "wasm" ? "ORT 1.30.0 SIMD-only artifact; session creation succeeded" : "WebGPU session; node placement not measured" };
}
function performanceSnapshot() {
  if (!active) return null;
  const p = structuredClone(active);
  p.neuralRealtimeFactor = p.audioDuration > 0 ? (p.timings.neuralNetwork?.ms ?? 0) / 1e3 / p.audioDuration : null;
  return p;
}
function ownedCPUOutput(tensor) {
  const data = tensor.data;
  return tensor.location === "cpu" && data instanceof Float32Array ? data : new Float32Array(data);
}
var active;
var init_performance = __esm({
  "src/performance.js"() {
    active = null;
  }
});

// src/storage.js
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
      return { size: meta.size, slice(start = 0, end = meta.size) {
        return { async arrayBuffer() {
          const parts = [];
          let position = 0;
          for (let i = 0; i < meta.blocks && position < end; i++) {
            const size = meta.sizes?.[i] || Math.min(4 * 1024 ** 2, meta.size - position);
            if (position + size > start) {
              const b = await get("blocks", `${key}:${i}`);
              if (!b) throw Error("\u4FDD\u5B58\u3055\u308C\u305F\u97F3\u6E90\u30D6\u30ED\u30C3\u30AF\u304C\u3042\u308A\u307E\u305B\u3093");
              const from = Math.max(0, start - position), to = Math.min(b.byteLength, end - position);
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
async function readBytes(key, onAllocate = async (fn2) => fn2()) {
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
async function removeFile(key) {
  const meta = await get("files", key);
  if (meta?.opfs) await (await root())?.removeEntry(key).catch(() => {
  });
  if (meta?.blocks) for (let i = 0; i < meta.blocks; i++) await del("blocks", `${key}:${i}`);
  await del("files", key);
}
var dbPromise, Sink;
var init_storage = __esm({
  "src/storage.js"() {
    init_performance();
    Sink = class _Sink {
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
  }
});

// src/load-trace.js
async function beginTrace(selectedModel) {
  trace = { selectedModel, loadedModel: null, activeSessions: 0, activeWorkers: 0, modelLoadStage: null, lastSuccessfulStage: null, modelBytes: 0, arrayBufferBytes: 0, audioBufferBytes: null, currentChunk: null, backend: null, exception: null, cleanup: [], stages: Object.fromEntries(LOAD_STAGES.map((s) => [s, { status: "NOT REACHED" }])), events: [], measurement: "Application-owned references/counts, not measured OS RAM or guaranteed memory reclamation" };
  await flush();
}
async function resumeTrace(selectedModel, onTrace) {
  trace = await get("settings", "load-trace");
  if (!trace || trace.selectedModel !== selectedModel) await beginTrace(selectedModel);
  notify = onTrace || (() => {
  });
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
async function stage(name, fn2, details = {}) {
  if (!trace) return fn2();
  trace.modelLoadStage = name;
  trace.stages[name] = { status: "RUNNING", ...details };
  trace.events.push({ stage: name, status: "RUNNING", at: Date.now() });
  trace.events = trace.events.slice(-48);
  await flush();
  const tick = performance.now();
  try {
    const categories = { "inference": "neuralNetwork", "tensor allocation": "tensorConstruction", "InferenceSession.create": "sessionCreate", "ORT module initialization": "runtimeInitialization", "cache read": "modelCacheRead", "SHA-256 verification": "modelHashVerification" };
    let v2;
    if (name === "inference") globalThis.__benchmarkInference = true;
    try {
      v2 = await measureAsync(categories[name] || "stage:" + name, fn2);
    } finally {
      if (name === "inference") globalThis.__benchmarkInference = false;
    }
    trace.stages[name] = { status: "PASS", ms: performance.now() - tick, ...details };
    trace.lastSuccessfulStage = name;
    await flush();
    return v2;
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
function trackedOrt(runtime) {
  return { ...runtime, InferenceSession: { async create(bytes, { stemlightStaged, ...options }) {
    if (sessions.size && !stemlightStaged) throw Error("\u65E7InferenceSession\u304C\u89E3\u653E\u3055\u308C\u3066\u3044\u307E\u305B\u3093");
    const payload = bytes.byteLength + (options.externalData || []).reduce((n, d) => n + (d.data?.byteLength || 0), 0);
    await updateTrace({ modelBytes: payload, arrayBufferBytes: payload });
    const session = await stage("InferenceSession.create", () => runtime.InferenceSession.create(bytes, options));
    runtimePerformance(runtime, options.executionProviders?.[0] || "unknown");
    sessions.add(session);
    const release = session.release.bind(session);
    let released = false;
    session.release = async () => {
      if (released) return;
      try {
        await release();
        released = true;
        sessions.delete(session);
        if (trace) {
          trace.cleanup.push({ operation: "InferenceSession.release", status: "PASS" });
          await updateTrace({ activeSessions: sessions.size, loadedModel: null });
        }
      } catch (e) {
        if (trace) {
          trace.cleanup.push({ operation: "InferenceSession.release", status: "FAIL", message: String(e.message) });
          await flush();
        }
        throw e;
      }
    };
    await updateTrace({ activeSessions: sessions.size, loadedModel: trace?.executingModel || trace?.selectedModel, backend: options.executionProviders?.[0] || null });
    await stage("session ready", async () => {
    }, { inputs: session.inputNames, outputs: session.outputNames });
    return session;
  } } };
}
async function cleanupSessions() {
  for (const s of [...sessions]) await s.release().catch(() => {
  });
  await updateTrace({ arrayBufferBytes: 0, cleanupComplete: sessions.size === 0 });
  await flush();
}
function observeWASM() {
  const memories = [], artifacts = [];
  const Memory = WebAssembly.Memory;
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args) => {
    const r = await originalFetch(...args);
    const value = typeof args[0] === "string" ? args[0] : args[0]?.url || String(args[0]);
    try {
      const path = new URL(value, location.href).pathname;
      if (path.endsWith(".wasm")) {
        artifacts.push({ path, status: r.status, bytes: r.headers.get("content-length") ? Number(r.headers.get("content-length")) : null });
        if (artifacts.length > 8) artifacts.shift();
      }
    } catch {
    }
    return r;
  };
  WebAssembly.Memory = new Proxy(Memory, { construct(target, args) {
    try {
      const m = Reflect.construct(target, args);
      memories.push(m);
      return m;
    } catch (e) {
      try {
        e._stemlightStage = "WASM memory allocation";
      } catch {
      }
      throw e;
    }
  } });
  for (const name of ["instantiate", "instantiateStreaming"]) if (WebAssembly[name]) {
    const original = WebAssembly[name].bind(WebAssembly);
    WebAssembly[name] = (...args) => stage("WASM initialization", () => original(...args), { observer: `WebAssembly.${name}; compilation/instantiation only, not model session ready` });
  }
  return () => {
    const sizes = memories.map((m) => m.buffer.byteLength);
    return { wasmArtifacts: artifacts, WASMLinearMemoryBytes: sizes.length ? Math.max(...sizes) : null, WASMMemoryScope: "Observed largest parent-Worker Memory.buffer; excludes JS/model buffers/GPU/OS. null if runtime used an unobserved creation path." };
  };
}
var LOAD_STAGES, trace, queue, notify, sessions;
var init_load_trace = __esm({
  "src/load-trace.js"() {
    init_performance();
    init_storage();
    LOAD_STAGES = ["model URL resolution", "fetch start", "download", "cache read", "ArrayBuffer allocation", "Worker start", "ORT module initialization", "WASM initialization", "InferenceSession.create", "tensor allocation", "session ready"];
    trace = null;
    queue = Promise.resolve();
    notify = () => {
    };
    sessions = /* @__PURE__ */ new Set();
  }
});

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
var init_lab_access = __esm({
  "src/lab-access.js"() {
  }
});

// src/catalog.js
function weightsFor(model, selected = model.stems) {
  if (!selected.length) return [];
  if (model.architecture) return model.weights;
  return model.weights.filter((w) => selected.includes(WEIGHTS[w].output) || selected.includes(WEIGHTS[w].residual));
}
function scnetFrames(mode, caps = {}) {
  return mode === "fast" || !caps.memoryGB || caps.memoryGB < 8 ? 64 : 128;
}
function framesFor(mode, caps) {
  return mode === "best" && (!caps.memoryGB || caps.memoryGB < 8) ? 64 : MODES[mode].frames;
}
var kuielab, WEIGHTS, local, imported, MODELS, MODES;
var init_catalog = __esm({
  "src/catalog.js"() {
    init_lab_access();
    kuielab = {
      vocals: { hash: "daba83c2ee1afee9139766ad64c9b6808d6b6f092fff04bed3338be50baac721", fft: 6144, output: "Vocals", residual: "Instrumental" },
      drums: { hash: "40f586b7091934dd6f5563f0cba8f14bad57ce88440da1098bf388ea716c2901", fft: 4096, output: "Drums" },
      bass: { hash: "0c3e77b9963185b1ea6bb46a4b8924137d9370fc1ccdefec7b1b416ef550dcaa", fft: 16384, output: "Bass" },
      other: { hash: "7b67a1dcb5f232153528c59960b4c7bf8dc736b8114de360af0e719633f53358", fft: 8192, output: "Other" }
    };
    WEIGHTS = Object.fromEntries(Object.entries(kuielab).map(([id, a]) => [id, { ...a, id, name: `MDX ${a.output}`, bytes: 29703204, url: `https://media.githubusercontent.com/media/kuielab/mdx-net-submission/68b969d7b9a99ed4557ba372035b4eb2ac67547d/onnx_A/${id}.onnx`, license: "MIT", bins: 2048, compensate: 1 }]));
    WEIGHTS["scnet-base"] = { id: "scnet-base", name: "SCNet Base 128", architecture: "scnet", bytes: 42849113, hash: "46a9313dc9220d3c8ecc011569c5e465dd0f1ad29c61e47a87c9775bafdddbde", url: "models/scnet-base-128.onnx", license: "MIT", frames: 128, fft: 4096, bins: 2049 };
    WEIGHTS["scnet-base-64"] = { ...WEIGHTS["scnet-base"], id: "scnet-base-64", name: "SCNet Base 64", bytes: 42749771, hash: "3654b2a9c33ae82427147f7ae0e3c75cf266a0072b9134e580817ee97dadb436", url: "models/scnet-base-64.onnx", frames: 64 };
    local = labAccess().allowed;
    imported = (path) => local ? labURL(path) : null;
    WEIGHTS["htdemucs-4s"] = { id: "htdemucs-4s", name: "HTDemucs", architecture: "htdemucs", file: "htdemucs-4s.slpk", bytes: 90433598, hash: "1d0b735e851caa8af45cd51a48962e9642c5f4e26b49818ec255f483f9dc7dd4", url: imported("/local-models/htdemucs-4s.slpk"), import: true, license: "\u7814\u7A76\u76EE\u7684\uFF08\u4F5C\u8005\u898B\u89E3\uFF09" };
    WEIGHTS["htdemucs-6s"] = { id: "htdemucs-6s", name: "HTDemucs 6", architecture: "htdemucs", file: "htdemucs-6s.slpk", bytes: 59867070, hash: "d92c068deb1962f658662ec14e62f9151439ec7e4982c6d38b5f73742d8d4cc2", url: imported("/local-models/htdemucs-6s.slpk"), import: true, license: "\u7814\u7A76\u76EE\u7684\uFF08\u4F5C\u8005\u898B\u89E3\uFF09" };
    WEIGHTS["inst-hq5"] = { id: "inst-hq5", name: "UVR Inst HQ 5", file: "UVR-MDX-NET-Inst_HQ_5.onnx", bytes: 59074342, hash: "811cb24095d865763752310848b7ec86aeede0626cb05749ab35350e46897000", url: imported("/local-models/inst-hq5.onnx"), import: true, license: "UVR", fft: 5120, bins: 2560, compensate: 1.01, output: "Instrumental", residual: "Vocals" };
    WEIGHTS["karaoke2"] = { id: "karaoke2", name: "UVR Karaoke 2", file: "UVR_MDXNET_KARA_2.onnx", bytes: 52786726, hash: "bf32e15105a09c0f7dddd2b67346146334d6f3ecb399ed7638eba2ab07cbf5f4", url: imported("/local-models/karaoke2.onnx"), import: true, license: "UVR", fft: 5120, bins: 2048, compensate: 1.065, output: "BackingVocal", residual: "LeadVocal" };
    WEIGHTS["bs-sw-core"] = { id: "bs-sw-core", name: "BS-RoFormer SW (graph)", architecture: "bs-roformer", file: "bs-short.onnx", bytes: 2651463, hash: "0f14e2e8ee983314237b67f25294578aaa33594f3497c6329449636ba4038541", url: imported("/local-models/bs-short.onnx"), import: true, license: "\u672A\u78BA\u8A8D" };
    WEIGHTS["bs-sw-data"] = { ...WEIGHTS["bs-sw-core"], id: "bs-sw-data", name: "BS-RoFormer SW (weights)", file: "bs-weights.bin", bytes: 350213328, hash: "9cdb4ef1b6723cb2a4ebc74ac6ad8a3734593e709b4ae8e63cae086cc681555d", url: imported("/local-models/bs-weights.bin") };
    MODELS = [
      { id: "mdx-vocals", name: "MDX Vocal", by: "KUIELab", stems: ["Vocals", "Instrumental"], weights: ["vocals"], types: ["two"], tier: "light", speed: 3, quality: 1 },
      { id: "inst-hq5", name: "Inst HQ 5", by: "UVR", stems: ["Vocals", "Instrumental"], weights: ["inst-hq5"], types: ["two"], tier: "standard", speed: 1, quality: 3 },
      { id: "htdemucs-4s", name: "HTDemucs", by: "Meta", architecture: "htdemucs", stems: ["Vocals", "Drums", "Bass", "Other", "Instrumental"], weights: ["htdemucs-4s"], types: ["four", "two"], tier: "standard", speed: 2, quality: 3 },
      { id: "scnet-base", name: "SCNet", by: "starrytong", architecture: "scnet", stems: ["Vocals", "Drums", "Bass", "Other"], weights: ["scnet-base-64"], types: ["four"], tier: "light", speed: 2, quality: 2 },
      { id: "mdx-four", name: "MDX Quartet", by: "KUIELab", stems: ["Vocals", "Drums", "Bass", "Other", "Instrumental"], weights: ["vocals", "drums", "bass", "other"], types: ["four"], tier: "light", speed: 1, quality: 1 },
      { id: "htdemucs-6s", name: "HTDemucs 6", by: "Meta", architecture: "htdemucs", stems: ["Vocals", "Drums", "Bass", "Guitar", "Piano", "Other", "Instrumental"], weights: ["htdemucs-6s"], types: ["six"], tier: "standard", speed: 2, quality: 2 },
      { id: "bs-sw", name: "BS-RoFormer SW", by: "jarredou", architecture: "bs-roformer", stems: ["Vocals", "Drums", "Bass", "Guitar", "Piano", "Other"], weights: ["bs-sw-core", "bs-sw-data"], types: ["six"], tier: "heavy", speed: 1, quality: 3 },
      { id: "lead-backing", name: "Karaoke 2", by: "UVR", architecture: "lead-backing", stems: ["LeadVocal", "BackingVocal"], weights: ["scnet-base-64", "karaoke2"], types: ["karaoke"], tier: "light", speed: 1, quality: 2 }
    ].map((m) => ({ ...m, stemCount: m.stems.filter((s) => s !== "Instrumental" || m.stems.length === 2).length, bytes: m.weights.reduce((s, w) => s + WEIGHTS[w].bytes, 0), imported: m.weights.some((w) => WEIGHTS[w].import) }));
    MODES = { fast: { label: "\u9AD8\u901F", english: "Fast", frames: 32, overlap: 0.08, denoise: false }, standard: { label: "\u6A19\u6E96", english: "Standard", frames: 64, overlap: 0.25, denoise: false }, best: { label: "\u9AD8\u54C1\u8CEA", english: "Best", frames: 128, overlap: 0.5, denoise: true } };
  }
});

// node_modules/fft.js/lib/fft.js
var require_fft = __commonJS({
  "node_modules/fft.js/lib/fft.js"(exports, module) {
    "use strict";
    function FFT2(size) {
      this.size = size | 0;
      if (this.size <= 1 || (this.size & this.size - 1) !== 0)
        throw new Error("FFT size must be a power of two and bigger than 1");
      this._csize = size << 1;
      var table = new Array(this.size * 2);
      for (var i = 0; i < table.length; i += 2) {
        const angle = Math.PI * i / this.size;
        table[i] = Math.cos(angle);
        table[i + 1] = -Math.sin(angle);
      }
      this.table = table;
      var power = 0;
      for (var t = 1; this.size > t; t <<= 1)
        power++;
      this._width = power % 2 === 0 ? power - 1 : power;
      this._bitrev = new Array(1 << this._width);
      for (var j = 0; j < this._bitrev.length; j++) {
        this._bitrev[j] = 0;
        for (var shift = 0; shift < this._width; shift += 2) {
          var revShift = this._width - shift - 2;
          this._bitrev[j] |= (j >>> shift & 3) << revShift;
        }
      }
      this._out = null;
      this._data = null;
      this._inv = 0;
    }
    module.exports = FFT2;
    FFT2.prototype.fromComplexArray = function fromComplexArray(complex, storage) {
      var res = storage || new Array(complex.length >>> 1);
      for (var i = 0; i < complex.length; i += 2)
        res[i >>> 1] = complex[i];
      return res;
    };
    FFT2.prototype.createComplexArray = function createComplexArray() {
      const res = new Array(this._csize);
      for (var i = 0; i < res.length; i++)
        res[i] = 0;
      return res;
    };
    FFT2.prototype.toComplexArray = function toComplexArray(input, storage) {
      var res = storage || this.createComplexArray();
      for (var i = 0; i < res.length; i += 2) {
        res[i] = input[i >>> 1];
        res[i + 1] = 0;
      }
      return res;
    };
    FFT2.prototype.completeSpectrum = function completeSpectrum(spectrum) {
      var size = this._csize;
      var half = size >>> 1;
      for (var i = 2; i < half; i += 2) {
        spectrum[size - i] = spectrum[i];
        spectrum[size - i + 1] = -spectrum[i + 1];
      }
    };
    FFT2.prototype.transform = function transform(out, data) {
      if (out === data)
        throw new Error("Input and output buffers must be different");
      this._out = out;
      this._data = data;
      this._inv = 0;
      this._transform4();
      this._out = null;
      this._data = null;
    };
    FFT2.prototype.realTransform = function realTransform(out, data) {
      if (out === data)
        throw new Error("Input and output buffers must be different");
      this._out = out;
      this._data = data;
      this._inv = 0;
      this._realTransform4();
      this._out = null;
      this._data = null;
    };
    FFT2.prototype.inverseTransform = function inverseTransform(out, data) {
      if (out === data)
        throw new Error("Input and output buffers must be different");
      this._out = out;
      this._data = data;
      this._inv = 1;
      this._transform4();
      for (var i = 0; i < out.length; i++)
        out[i] /= this.size;
      this._out = null;
      this._data = null;
    };
    FFT2.prototype._transform4 = function _transform4() {
      var out = this._out;
      var size = this._csize;
      var width = this._width;
      var step = 1 << width;
      var len = size / step << 1;
      var outOff;
      var t;
      var bitrev = this._bitrev;
      if (len === 4) {
        for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
          const off = bitrev[t];
          this._singleTransform2(outOff, off, step);
        }
      } else {
        for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
          const off = bitrev[t];
          this._singleTransform4(outOff, off, step);
        }
      }
      var inv = this._inv ? -1 : 1;
      var table = this.table;
      for (step >>= 2; step >= 2; step >>= 2) {
        len = size / step << 1;
        var quarterLen = len >>> 2;
        for (outOff = 0; outOff < size; outOff += len) {
          var limit = outOff + quarterLen;
          for (var i = outOff, k2 = 0; i < limit; i += 2, k2 += step) {
            const A = i;
            const B2 = A + quarterLen;
            const C = B2 + quarterLen;
            const D2 = C + quarterLen;
            const Ar = out[A];
            const Ai = out[A + 1];
            const Br = out[B2];
            const Bi = out[B2 + 1];
            const Cr = out[C];
            const Ci = out[C + 1];
            const Dr = out[D2];
            const Di = out[D2 + 1];
            const MAr = Ar;
            const MAi = Ai;
            const tableBr = table[k2];
            const tableBi = inv * table[k2 + 1];
            const MBr = Br * tableBr - Bi * tableBi;
            const MBi = Br * tableBi + Bi * tableBr;
            const tableCr = table[2 * k2];
            const tableCi = inv * table[2 * k2 + 1];
            const MCr = Cr * tableCr - Ci * tableCi;
            const MCi = Cr * tableCi + Ci * tableCr;
            const tableDr = table[3 * k2];
            const tableDi = inv * table[3 * k2 + 1];
            const MDr = Dr * tableDr - Di * tableDi;
            const MDi = Dr * tableDi + Di * tableDr;
            const T0r = MAr + MCr;
            const T0i = MAi + MCi;
            const T1r = MAr - MCr;
            const T1i = MAi - MCi;
            const T2r = MBr + MDr;
            const T2i = MBi + MDi;
            const T3r = inv * (MBr - MDr);
            const T3i = inv * (MBi - MDi);
            const FAr = T0r + T2r;
            const FAi = T0i + T2i;
            const FCr = T0r - T2r;
            const FCi = T0i - T2i;
            const FBr = T1r + T3i;
            const FBi = T1i - T3r;
            const FDr = T1r - T3i;
            const FDi = T1i + T3r;
            out[A] = FAr;
            out[A + 1] = FAi;
            out[B2] = FBr;
            out[B2 + 1] = FBi;
            out[C] = FCr;
            out[C + 1] = FCi;
            out[D2] = FDr;
            out[D2 + 1] = FDi;
          }
        }
      }
    };
    FFT2.prototype._singleTransform2 = function _singleTransform2(outOff, off, step) {
      const out = this._out;
      const data = this._data;
      const evenR = data[off];
      const evenI = data[off + 1];
      const oddR = data[off + step];
      const oddI = data[off + step + 1];
      const leftR = evenR + oddR;
      const leftI = evenI + oddI;
      const rightR = evenR - oddR;
      const rightI = evenI - oddI;
      out[outOff] = leftR;
      out[outOff + 1] = leftI;
      out[outOff + 2] = rightR;
      out[outOff + 3] = rightI;
    };
    FFT2.prototype._singleTransform4 = function _singleTransform4(outOff, off, step) {
      const out = this._out;
      const data = this._data;
      const inv = this._inv ? -1 : 1;
      const step2 = step * 2;
      const step3 = step * 3;
      const Ar = data[off];
      const Ai = data[off + 1];
      const Br = data[off + step];
      const Bi = data[off + step + 1];
      const Cr = data[off + step2];
      const Ci = data[off + step2 + 1];
      const Dr = data[off + step3];
      const Di = data[off + step3 + 1];
      const T0r = Ar + Cr;
      const T0i = Ai + Ci;
      const T1r = Ar - Cr;
      const T1i = Ai - Ci;
      const T2r = Br + Dr;
      const T2i = Bi + Di;
      const T3r = inv * (Br - Dr);
      const T3i = inv * (Bi - Di);
      const FAr = T0r + T2r;
      const FAi = T0i + T2i;
      const FBr = T1r + T3i;
      const FBi = T1i - T3r;
      const FCr = T0r - T2r;
      const FCi = T0i - T2i;
      const FDr = T1r - T3i;
      const FDi = T1i + T3r;
      out[outOff] = FAr;
      out[outOff + 1] = FAi;
      out[outOff + 2] = FBr;
      out[outOff + 3] = FBi;
      out[outOff + 4] = FCr;
      out[outOff + 5] = FCi;
      out[outOff + 6] = FDr;
      out[outOff + 7] = FDi;
    };
    FFT2.prototype._realTransform4 = function _realTransform4() {
      var out = this._out;
      var size = this._csize;
      var width = this._width;
      var step = 1 << width;
      var len = size / step << 1;
      var outOff;
      var t;
      var bitrev = this._bitrev;
      if (len === 4) {
        for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
          const off = bitrev[t];
          this._singleRealTransform2(outOff, off >>> 1, step >>> 1);
        }
      } else {
        for (outOff = 0, t = 0; outOff < size; outOff += len, t++) {
          const off = bitrev[t];
          this._singleRealTransform4(outOff, off >>> 1, step >>> 1);
        }
      }
      var inv = this._inv ? -1 : 1;
      var table = this.table;
      for (step >>= 2; step >= 2; step >>= 2) {
        len = size / step << 1;
        var halfLen = len >>> 1;
        var quarterLen = halfLen >>> 1;
        var hquarterLen = quarterLen >>> 1;
        for (outOff = 0; outOff < size; outOff += len) {
          for (var i = 0, k2 = 0; i <= hquarterLen; i += 2, k2 += step) {
            var A = outOff + i;
            var B2 = A + quarterLen;
            var C = B2 + quarterLen;
            var D2 = C + quarterLen;
            var Ar = out[A];
            var Ai = out[A + 1];
            var Br = out[B2];
            var Bi = out[B2 + 1];
            var Cr = out[C];
            var Ci = out[C + 1];
            var Dr = out[D2];
            var Di = out[D2 + 1];
            var MAr = Ar;
            var MAi = Ai;
            var tableBr = table[k2];
            var tableBi = inv * table[k2 + 1];
            var MBr = Br * tableBr - Bi * tableBi;
            var MBi = Br * tableBi + Bi * tableBr;
            var tableCr = table[2 * k2];
            var tableCi = inv * table[2 * k2 + 1];
            var MCr = Cr * tableCr - Ci * tableCi;
            var MCi = Cr * tableCi + Ci * tableCr;
            var tableDr = table[3 * k2];
            var tableDi = inv * table[3 * k2 + 1];
            var MDr = Dr * tableDr - Di * tableDi;
            var MDi = Dr * tableDi + Di * tableDr;
            var T0r = MAr + MCr;
            var T0i = MAi + MCi;
            var T1r = MAr - MCr;
            var T1i = MAi - MCi;
            var T2r = MBr + MDr;
            var T2i = MBi + MDi;
            var T3r = inv * (MBr - MDr);
            var T3i = inv * (MBi - MDi);
            var FAr = T0r + T2r;
            var FAi = T0i + T2i;
            var FBr = T1r + T3i;
            var FBi = T1i - T3r;
            out[A] = FAr;
            out[A + 1] = FAi;
            out[B2] = FBr;
            out[B2 + 1] = FBi;
            if (i === 0) {
              var FCr = T0r - T2r;
              var FCi = T0i - T2i;
              out[C] = FCr;
              out[C + 1] = FCi;
              continue;
            }
            if (i === hquarterLen)
              continue;
            var ST0r = T1r;
            var ST0i = -T1i;
            var ST1r = T0r;
            var ST1i = -T0i;
            var ST2r = -inv * T3i;
            var ST2i = -inv * T3r;
            var ST3r = -inv * T2i;
            var ST3i = -inv * T2r;
            var SFAr = ST0r + ST2r;
            var SFAi = ST0i + ST2i;
            var SFBr = ST1r + ST3i;
            var SFBi = ST1i - ST3r;
            var SA = outOff + quarterLen - i;
            var SB = outOff + halfLen - i;
            out[SA] = SFAr;
            out[SA + 1] = SFAi;
            out[SB] = SFBr;
            out[SB + 1] = SFBi;
          }
        }
      }
    };
    FFT2.prototype._singleRealTransform2 = function _singleRealTransform2(outOff, off, step) {
      const out = this._out;
      const data = this._data;
      const evenR = data[off];
      const oddR = data[off + step];
      const leftR = evenR + oddR;
      const rightR = evenR - oddR;
      out[outOff] = leftR;
      out[outOff + 1] = 0;
      out[outOff + 2] = rightR;
      out[outOff + 3] = 0;
    };
    FFT2.prototype._singleRealTransform4 = function _singleRealTransform4(outOff, off, step) {
      const out = this._out;
      const data = this._data;
      const inv = this._inv ? -1 : 1;
      const step2 = step * 2;
      const step3 = step * 3;
      const Ar = data[off];
      const Br = data[off + step];
      const Cr = data[off + step2];
      const Dr = data[off + step3];
      const T0r = Ar + Cr;
      const T1r = Ar - Cr;
      const T2r = Br + Dr;
      const T3r = inv * (Br - Dr);
      const FAr = T0r + T2r;
      const FBr = T1r;
      const FBi = -T3r;
      const FCr = T0r - T2r;
      const FDr = T1r;
      const FDi = T3r;
      out[outOff] = FAr;
      out[outOff + 1] = 0;
      out[outOff + 2] = FBr;
      out[outOff + 3] = FBi;
      out[outOff + 4] = FCr;
      out[outOff + 5] = 0;
      out[outOff + 6] = FDr;
      out[outOff + 7] = FDi;
    };
  }
});

// src/dsp.js
function reflected(i, n) {
  if (n <= 1) return 0;
  const period = 2 * (n - 1);
  i = (i % period + period) % period;
  return i < n ? i : period - i;
}
function wavHeader(frames, rate = 44100, channels = 2) {
  const b = new ArrayBuffer(44), v2 = new DataView(b);
  function s(p, t) {
    for (let j = 0; j < t.length; j++) v2.setUint8(p + j, t.charCodeAt(j));
  }
  s(0, "RIFF");
  v2.setUint32(4, 36 + frames * channels * 2, true);
  s(8, "WAVE");
  s(12, "fmt ");
  v2.setUint32(16, 16, true);
  v2.setUint16(20, 1, true);
  v2.setUint16(22, channels, true);
  v2.setUint32(24, rate, true);
  v2.setUint32(28, rate * channels * 2, true);
  v2.setUint16(32, channels * 2, true);
  v2.setUint16(34, 16, true);
  s(36, "data");
  v2.setUint32(40, frames * channels * 2, true);
  return new Uint8Array(b);
}
function pcm16(channels) {
  return measure("wavEncode", () => encodePCM16(channels));
}
function encodePCM16(channels) {
  const n = channels[0].length, b = new Uint8Array(n * 4), v2 = new DataView(b.buffer);
  let clipped = 0;
  for (let j = 0; j < n; j++) for (let c = 0; c < 2; c++) {
    let x = channels[c][j];
    if (!Number.isFinite(x)) throw Error("Non-finite audio");
    if (Math.abs(x) > 1) clipped++;
    x = Math.max(-1, Math.min(1, x));
    v2.setInt16((j * 2 + c) * 2, Math.round(x * (x < 0 ? 32768 : 32767)), true);
  }
  return { bytes: b, clipped };
}
var import_fft, Fourier, Spectral;
var init_dsp = __esm({
  "src/dsp.js"() {
    import_fft = __toESM(require_fft(), 1);
    init_performance();
    Fourier = class {
      constructor(n) {
        this.n = n;
        this.direct = (n & n - 1) === 0;
        this.size = this.direct ? n : 2 ** Math.ceil(Math.log2(2 * n - 1));
        this.fft = new import_fft.default(this.size);
        this.a = new Float64Array(this.size * 2);
        this.b = new Float64Array(this.size * 2);
        this.c = new Float64Array(this.size * 2);
        this.chirp = new Float64Array(n * 2);
        if (!this.direct) {
          for (let j = 0; j < n; j++) {
            const angle = Math.PI * (j * j % (2 * n)) / n, co = Math.cos(angle), si = Math.sin(angle);
            this.chirp[j * 2] = co;
            this.chirp[j * 2 + 1] = si;
            this.a[j * 2] = co;
            this.a[j * 2 + 1] = si;
            if (j) {
              this.a[(this.size - j) * 2] = co;
              this.a[(this.size - j) * 2 + 1] = si;
            }
          }
          this.kernel = new Float64Array(this.size * 2);
          this.fft.transform(this.kernel, this.a);
        }
      }
      forward(input, out) {
        if (this.direct) {
          this.fft.transform(out, input);
          return;
        }
        this.a.fill(0);
        for (let j = 0; j < this.n; j++) {
          const r = input[2 * j], i = input[2 * j + 1], co = this.chirp[2 * j], si = this.chirp[2 * j + 1];
          this.a[2 * j] = r * co + i * si;
          this.a[2 * j + 1] = i * co - r * si;
        }
        this.fft.transform(this.b, this.a);
        for (let j = 0; j < this.size; j++) {
          const r = this.b[2 * j], i = this.b[2 * j + 1], kr = this.kernel[2 * j], ki = this.kernel[2 * j + 1];
          this.a[2 * j] = r * kr - i * ki;
          this.a[2 * j + 1] = r * ki + i * kr;
        }
        this.fft.inverseTransform(this.c, this.a);
        for (let j = 0; j < this.n; j++) {
          const r = this.c[2 * j], i = this.c[2 * j + 1], co = this.chirp[2 * j], si = this.chirp[2 * j + 1];
          out[2 * j] = r * co + i * si;
          out[2 * j + 1] = i * co - r * si;
        }
      }
      inverse(input, out) {
        if (this.direct) {
          this.fft.inverseTransform(out, input);
          return;
        }
        if (input.buffer === out.buffer) {
          const a = new Float64Array(input.length), b = new Float64Array(input.length);
          for (let j = 0; j < this.n; j++) {
            a[2 * j] = input[2 * j];
            a[2 * j + 1] = -input[2 * j + 1];
          }
          this.forward(a, b);
          for (let j = 0; j < this.n; j++) {
            out[2 * j] = b[2 * j] / this.n;
            out[2 * j + 1] = -b[2 * j + 1] / this.n;
          }
          return;
        }
        for (let j = 0; j < this.n; j++) input[2 * j + 1] = -input[2 * j + 1];
        try {
          this.forward(input, out);
        } finally {
          for (let j = 0; j < this.n; j++) input[2 * j + 1] = -input[2 * j + 1];
        }
        for (let j = 0; j < this.n; j++) {
          out[2 * j] /= this.n;
          out[2 * j + 1] = -out[2 * j + 1] / this.n;
        }
      }
    };
    Spectral = class {
      constructor(n, bins, frames, hop = 1024) {
        Object.assign(this, { n, bins, frames, hop });
        this.fft = new Fourier(n);
        this.window = Float64Array.from({ length: n }, (_, j) => 0.5 - 0.5 * Math.cos(2 * Math.PI * j / n));
        this.a = new Float64Array(n * 2);
        this.b = new Float64Array(n * 2);
      }
      stft(channels, zeroLow = true) {
        return measure("stft", () => this.transformSTFT(channels, zeroLow));
      }
      transformSTFT(channels, zeroLow = true) {
        const { n, bins, frames, hop } = this;
        const out = new Float32Array(4 * bins * frames);
        for (let c = 0; c < 2; c++) for (let t = 0; t < frames; t++) {
          for (let j = 0; j < n; j++) {
            this.a[2 * j] = channels[c][reflected(t * hop + j - n / 2, channels[c].length)] * this.window[j];
            this.a[2 * j + 1] = 0;
          }
          this.fft.forward(this.a, this.b);
          for (let f = zeroLow ? 3 : 0; f < bins; f++) {
            out[(c * 2 * bins + f) * frames + t] = this.b[2 * f];
            out[((c * 2 + 1) * bins + f) * frames + t] = this.b[2 * f + 1];
          }
        }
        return out;
      }
      istft(spec) {
        return measure("istft", () => this.transformISTFT(spec));
      }
      transformISTFT(spec) {
        const { n, bins, frames, hop } = this, len = hop * (frames - 1), padded = len + n, weight = new Float64Array(padded), out = [new Float64Array(padded), new Float64Array(padded)];
        for (let t = 0; t < frames; t++) for (let j = 0; j < n; j++) weight[t * hop + j] += this.window[j] ** 2;
        for (let c = 0; c < 2; c++) for (let t = 0; t < frames; t++) {
          this.a.fill(0);
          for (let f = 0; f < bins; f++) {
            const r = spec[(c * 2 * bins + f) * frames + t], i = spec[((c * 2 + 1) * bins + f) * frames + t];
            this.a[2 * f] = r;
            this.a[2 * f + 1] = i;
            if (f > 0 && f < n / 2) {
              this.a[2 * (n - f)] = r;
              this.a[2 * (n - f) + 1] = -i;
            }
          }
          this.fft.inverse(this.a, this.b);
          for (let j = 0; j < n; j++) out[c][t * hop + j] += this.b[2 * j] * this.window[j];
        }
        return out.map((a) => {
          const e = new Float32Array(len);
          for (let j = 0; j < len; j++) e[j] = a[j + n / 2] / Math.max(weight[j + n / 2], 1e-12);
          return e;
        });
      }
    };
  }
});

// src/models.js
async function loadModel(id) {
  await updateTrace({ modelBytes: WEIGHTS[id].bytes });
  const bytes = await stage("cache read", () => readBytes(`model-${id}`, (fn2) => stage("ArrayBuffer allocation", fn2, { expectedBytes: WEIGHTS[id].bytes })), { weight: id });
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
var digest;
var init_models = __esm({
  "src/models.js"() {
    init_lab_access();
    init_catalog();
    init_storage();
    init_load_trace();
    digest = async (b) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)), (x) => x.toString(16).padStart(2, "0")).join("");
  }
});

// src/audio.js
var AudioReader;
var init_audio = __esm({
  "src/audio.js"() {
    init_performance();
    init_load_trace();
    init_storage();
    AudioReader = class _AudioReader {
      static async open(key, info) {
        const r = new _AudioReader();
        r.file = await readFile(key, true);
        r.info = info;
        r.length = Math.round(info.duration * 44100);
        return r;
      }
      async read(start, length) {
        return measureAsync("audioReadDecodeResample", () => this.readPCM(start, length));
      }
      async readPCM(start, length) {
        const i = this.info, ratio = i.rate / 44100, first = Math.max(0, Math.floor(start * ratio) - 20), last = Math.min(i.frames, Math.ceil((start + length) * ratio) + 20);
        const ch = [new Float32Array(length), new Float32Array(length)];
        if (last <= first) return ch;
        const b = await measureAsync("fileRead", () => this.file.slice(i.dataOffset + first * i.align, i.dataOffset + last * i.align).arrayBuffer()), v2 = new DataView(b), count = Math.floor(b.byteLength / i.align), source = [new Float32Array(count), new Float32Array(count)];
        const decodeTick = performance.now();
        for (let j = 0; j < count; j++) for (let c = 0; c < 2; c++) {
          const p = j * i.align + Math.min(c, i.channels - 1) * (i.bits / 8);
          let x;
          if (i.format === 3) x = v2.getFloat32(p, true);
          else if (i.bits === 16) x = v2.getInt16(p, true) / 32768;
          else if (i.bits === 32) x = v2.getInt32(p, true) / 2147483648;
          else {
            let n = v2.getUint8(p) | v2.getUint8(p + 1) << 8 | v2.getUint8(p + 2) << 16;
            if (n & 8388608) n -= 16777216;
            x = n / 8388608;
          }
          source[c][j] = Number.isFinite(x) ? x : 0;
        }
        addTime("decodePCM", performance.now() - decodeTick);
        const resampleTick = performance.now();
        const cut = Math.min(1, 1 / ratio);
        for (let j = 0; j < length; j++) {
          const pos = (start + j) * ratio;
          if (pos < 0 || pos >= i.frames) continue;
          const local2 = pos - first;
          if (ratio === 1) {
            ch[0][j] = source[0][local2] || 0;
            ch[1][j] = source[1][local2] || 0;
            continue;
          }
          let w = 0, l = 0, r = 0;
          for (let k2 = Math.ceil(local2 - 16); k2 <= Math.floor(local2 + 16); k2++) {
            if (k2 < 0 || k2 >= count) continue;
            const d = local2 - k2, z = d * cut, sinc = Math.abs(z) < 1e-10 ? 1 : Math.sin(Math.PI * z) / (Math.PI * z), win = 0.5 + 0.5 * Math.cos(Math.PI * d / 16), a = cut * sinc * win;
            w += a;
            l += source[0][k2] * a;
            r += source[1][k2] * a;
          }
          if (w) {
            ch[0][j] = l / w;
            ch[1][j] = r / w;
          }
        }
        addTime(ratio === 1 ? "sameRateCopy" : "resample", performance.now() - resampleTick);
        return ch;
      }
    };
  }
});

// src/scnet.js
var scnet_exports = {};
__export(scnet_exports, {
  SCNET: () => SCNET,
  SCNetSpectral: () => SCNetSpectral,
  executeSCNet: () => executeSCNet
});
function interleavedFloat(ch) {
  const b = new Float32Array(ch[0].length * 2);
  for (let j = 0; j < ch[0].length; j++) {
    b[j * 2] = ch[0][j];
    b[j * 2 + 1] = ch[1][j];
    if (!Number.isFinite(b[j * 2]) || !Number.isFinite(b[j * 2 + 1])) throw Error("Non-finite intermediate vocals");
  }
  return new Uint8Array(b.buffer);
}
async function executeSCNet(job, { cpuOrt: cpuOrt2, send: send2, isStopped }) {
  globalThis.__STEMLIGHT_NO_OPFS__ = job.caps.opfs === false;
  const reader = await AudioReader.open(job.input, job.audio), total = reader.length, mode = MODES[job.mode], rawOutput = job.model === "lead-backing", labels = rawOutput ? ["Vocals"] : job.selected;
  if (!labels.length || labels.some((s) => !SCNET.order.includes(s))) throw Error("SCNet\u306E\u30B9\u30C6\u30E0\u9078\u629E\u304C\u4E0D\u6B63\u3067\u3059");
  const frames = rawOutput ? 64 : job.frames || scnetFrames(job.mode, job.caps), weightId = frames === 128 ? "scnet-base" : "scnet-base-64";
  const paddedLength = (frames - 1) * 1024, inputLength = paddedLength - 1300, core = inputLength - 4096, step = Math.floor(core * (1 - mode.overlap)), steps = Math.ceil(total / step), dsp = new SCNetSpectral(frames);
  job.status = "running";
  job.startedAt ||= Date.now();
  job.outputs ||= [];
  job.metrics ||= {};
  job.frames = frames;
  const carry = job.current?.weight === weightId ? job.current : null;
  let acc = carry?.acc || Object.fromEntries(labels.map((s) => [s, [new Float32Array(core), new Float32Array(core)]])), divider = carry?.divider || new Float32Array(core), offsets = carry?.offsets || {}, waves = carry?.waves || Object.fromEntries(labels.map((s) => [s, new Float32Array(160)]));
  const sinks = {};
  let session, bytes, ort2 = cpuOrt2, backend = "wasm", first = true;
  const configure2 = () => {
    ort2.env.wasm.wasmPaths = new URL("runtime/", location.href).href;
    ort2.env.wasm.numThreads = benchmarkThreads(job);
    ort2.env.wasm.proxy = false;
  };
  const create = (provider) => ort2.InferenceSession.create(bytes, { executionProviders: [provider], graphOptimizationLevel: "all" });
  const run = async (x) => {
    const t = await stage("tensor allocation", async () => new ort2.Tensor("float32", x, [1, 4, 2049, frames]));
    let out;
    try {
      out = await stage("inference", () => session.run({ spectrogram: t }));
      const y = measure("outputTensorAccess", () => ownedCPUOutput(out.separated));
      if (y.length !== 4 * x.length || !y.every(Number.isFinite)) throw Error("SCNet\u51FA\u529B\u304C\u4E0D\u6B63\u3067\u3059");
      return y;
    } finally {
      t.dispose();
      if (out) for (const v2 of Object.values(out)) v2.dispose();
    }
  };
  try {
    for (const s of labels) {
      sinks[s] = await Sink.open(`out-${job.id}-${s.toLowerCase()}`, offsets[s]?.offset || 0, offsets[s]?.blocks || 0);
      if (!offsets[s] && !rawOutput) await sinks[s].write(wavHeader(total));
    }
    send2({ stage: "SCNet\u3092\u8AAD\u307F\u8FBC\u307F", stem: "SCNet", percent: (job.finishedSteps || 0) / steps * 100 });
    await updateTrace({ executingModel: weightId, pipelinePhase: job.pipeline?.phase || null });
    const load = performance.now();
    bytes = await loadModel(weightId);
    configure2();
    if (job.backend === "webgpu" && job.caps.webgpu) {
      try {
        ort2 = trackedOrt(await import(new URL("runtime/ort.webgpu.min.mjs", location.href).href));
        configure2();
        session = await create("webgpu");
        backend = "webgpu";
      } catch (e) {
        if (job.benchmark) throw e;
        job.metrics.gpuFailure = String(e.message);
        ort2 = cpuOrt2;
        configure2();
        send2({ notice: "SCNet GPU\u3092\u958B\u59CB\u3067\u304D\u306A\u3044\u305F\u3081WASM\u3078\u5207\u308A\u66FF\u3048\u307E\u3059", detail: String(e.message) });
      }
    }
    session ||= await create("wasm");
    if (backend === "wasm") {
      bytes = null;
      await updateTrace({ arrayBufferBytes: 0 });
    }
    job.metrics.modelLoadMs = (job.metrics.modelLoadMs || 0) + performance.now() - load;
    job.metrics.threads = ort2.env.wasm.numThreads;
    job.metrics.chunkFrames = frames;
    job.metrics.overlap = mode.overlap;
    job.metrics.passes = 1;
    job.metrics.plannedChunks = steps;
    await put("jobs", job.id, job);
    for (let start = carry?.next || 0; start < total; start += step) {
      if (isStopped()) break;
      const preprocessingTick = performance.now(), raw = await reader.read(start - SCNET.trim, inputLength), chunk = raw.map((c) => {
        const p = new Float32Array(paddedLength);
        p.set(c);
        return p;
      });
      addTime("preprocessing", performance.now() - preprocessingTick);
      const x = dsp.stft(chunk), time = performance.now();
      let prediction;
      try {
        prediction = await run(x);
      } catch (e) {
        if (job.benchmark || backend !== "webgpu") throw e;
        await session.release();
        ort2 = cpuOrt2;
        configure2();
        session = await create("wasm");
        backend = "wasm";
        prediction = await run(x);
        send2({ notice: "SCNet GPU\u63A8\u8AD6\u306B\u5931\u6557\u3057\u305F\u305F\u3081WASM\u3067\u518D\u51E6\u7406\u3057\u307E\u3059" });
      }
      if (!job.benchmark && first && backend === "webgpu") {
        await session.release();
        ort2 = cpuOrt2;
        configure2();
        session = await create("wasm");
        const cpu = await run(x);
        let sq = 0, ref = 0;
        for (let i = 0; i < cpu.length; i += 127) {
          sq += (prediction[i] - cpu[i]) ** 2;
          ref += cpu[i] ** 2;
        }
        const error = Math.sqrt(sq / Math.max(ref, 1e-20));
        job.metrics.gpuParity = error;
        prediction = cpu;
        backend = "wasm";
        bytes = null;
        send2({ notice: error > 5e-3 ? "SCNet GPU\u6570\u5024\u691C\u8A3C\u3092\u901A\u904E\u3057\u306A\u304B\u3063\u305F\u305F\u3081WASM\u3092\u4F7F\u7528\u3057\u307E\u3059" : "SCNet GPU\u3092WASM\u3068\u6BD4\u8F03\u3057\u307E\u3057\u305F\u3002\u5B89\u5B9A\u3057\u305FWASM\u3067\u7D99\u7D9A\u3057\u307E\u3059" });
      }
      first = false;
      job.metrics.inferenceMs = (job.metrics.inferenceMs || 0) + performance.now() - time;
      job.metrics.backend = backend;
      const dividerTick = performance.now();
      for (let j = 0; j < core; j++) divider[j] += Math.max(1e-4, Math.sin(Math.PI * (j + 0.5) / core) ** 2);
      addTime("overlapAdd", performance.now() - dividerTick);
      const count = Math.min(step, total - start), span = x.length;
      for (const s of labels) {
        const index = SCNET.order.indexOf(s), out = dsp.istft(prediction.subarray(index * span, (index + 1) * span));
        const overlapTick = performance.now();
        for (let j = 0; j < core; j++) {
          const a = Math.max(1e-4, Math.sin(Math.PI * (j + 0.5) / core) ** 2);
          for (let c = 0; c < 2; c++) acc[s][c][j] += out[c][j + SCNET.trim] * a;
        }
        addTime("overlapAdd", performance.now() - overlapTick);
        const postTick = performance.now();
        const emit = acc[s].map((a) => {
          const e = new Float32Array(count);
          for (let j = 0; j < count; j++) e[j] = a[j] / Math.max(divider[j], 1e-12);
          return e;
        });
        for (let j = 0; j < count; j++) {
          const b = Math.min(159, Math.floor((start + j) * 160 / total));
          waves[s][b] = Math.max(waves[s][b], Math.abs(emit[0][j]), Math.abs(emit[1][j]));
        }
        addTime("postprocessing", performance.now() - postTick);
        const pcm = rawOutput ? { bytes: interleavedFloat(emit), clipped: 0 } : pcm16(emit);
        job.metrics.clippedSamples = (job.metrics.clippedSamples || 0) + pcm.clipped;
        await sinks[s].write(pcm.bytes);
        offsets[s] = { offset: sinks[s].offset, blocks: sinks[s].blocks || 0 };
        for (const a of acc[s]) {
          a.copyWithin(0, step);
          a.fill(0, core - step);
        }
      }
      divider.copyWithin(0, step);
      divider.fill(0, core - step);
      job.finishedSteps = (job.finishedSteps || 0) + 1;
      job.current = { weight: weightId, next: start + step, acc, divider, offsets, waves };
      await put("jobs", job.id, job);
      send2({ stage: "4\u30B9\u30C6\u30E0\u3092\u5206\u96E2", stem: "SCNet", percent: Math.min(99, job.finishedSteps / steps * 100), backend, processedSeconds: Math.min(total, start + count) / 44100, inferenceMs: job.metrics.inferenceMs, elapsed: Date.now() - job.startedAt });
      await new Promise((r) => setTimeout(r, 0));
    }
    if (isStopped()) {
      job.status = "paused";
      await put("jobs", job.id, job);
      send2({ paused: true, id: job.id });
      return;
    }
    if (rawOutput) {
      job.pipeline.intermediate = { key: `out-${job.id}-vocals`, audio: { raw: true, format: 3, bits: 32, align: 8, channels: 2, rate: 44100, frames: total, duration: total / 44100, dataOffset: 0, size: total * 8, streaming: true } };
      job.pipeline.scnetMetrics = structuredClone(job.metrics);
      job.pipeline.phase = "karaoke";
      job.current = null;
      job.frames = null;
      job.finishedSteps = 0;
      job.status = "paused";
      await put("jobs", job.id, job);
      send2({ nextStage: true, id: job.id });
      return;
    }
    job.outputs = labels.map((s) => ({ stem: s, key: `out-${job.id}-${s.toLowerCase()}`, frames: total, rate: 44100, waveform: Array.from(waves[s]), bytes: 44 + total * 4 }));
    job.current = null;
    job.status = "complete";
    job.completedAt = Date.now();
    job.metrics.wallMs = job.completedAt - job.startedAt;
    await put("jobs", job.id, job);
    send2({ complete: true, id: job.id, outputs: job.outputs, metrics: job.metrics });
  } finally {
    for (const s of Object.values(sinks)) s.close();
    await session?.release().catch(() => {
    });
    bytes = null;
  }
}
var SCNET, SCNetSpectral;
var init_scnet = __esm({
  "src/scnet.js"() {
    init_benchmark_policy();
    init_performance();
    init_load_trace();
    init_dsp();
    init_storage();
    init_audio();
    init_models();
    init_catalog();
    SCNET = { frames: 128, fft: 4096, bins: 2049, hop: 1024, inputLength: 128748, paddedLength: 130048, trim: 2048, core: 124652, order: ["Drums", "Bass", "Other", "Vocals"] };
    SCNetSpectral = class extends Spectral {
      constructor(frames = 128) {
        super(4096, 2049, frames);
        this.window.fill(1);
      }
      stft(channels) {
        const x = super.stft(channels, false);
        for (let i = 0; i < x.length; i++) x[i] /= 64;
        return x;
      }
      istft(x) {
        const y = super.istft(x);
        for (const c of y) for (let i = 0; i < c.length; i++) c[i] *= 64;
        return y;
      }
    };
  }
});

// src/htdemucs.js
var htdemucs_exports = {};
__export(htdemucs_exports, {
  DEMUCS_STEMS: () => DEMUCS_STEMS,
  DemucsSpectral: () => DemucsSpectral,
  demixChunk: () => demixChunk,
  executeHTDemucs: () => executeHTDemucs,
  parsePack: () => parsePack,
  runStages: () => runStages,
  segmentPlan: () => segmentPlan,
  triangle: () => triangle
});
function parsePack(bytes) {
  const magic = new TextDecoder().decode(bytes.subarray(0, 8));
  if (magic !== "SLPK0001") throw Error("\u30E2\u30C7\u30EB\u5F62\u5F0F\u304C\u4E0D\u6B63\u3067\u3059");
  const n = new DataView(bytes.buffer, bytes.byteOffset + 8, 4).getUint32(0, true), header = JSON.parse(new TextDecoder().decode(bytes.subarray(12, 12 + n))), base = 12 + n;
  return { header, stages: header.stages.map((s) => ({ ...s, data: bytes.subarray(base + s.offset, base + s.offset + s.bytes) })) };
}
function reflect(i, n) {
  const period = 2 * (n - 1);
  i = (i % period + period) % period;
  return i < n ? i : period - i;
}
function triangle(L) {
  const h = Math.floor(L / 2), w = new Float32Array(L), max = Math.max(h, L - h);
  for (let i = 0; i < L; i++) w[i] = (i < h ? i + 1 : L - i) / max;
  return w;
}
function segmentPlan(total, L, overlap) {
  const stride = Math.floor((1 - overlap) * L), offsets = [];
  for (let o = 0; o < total; o += stride) offsets.push(o);
  return { stride, offsets };
}
async function normalisation(reader, total) {
  let sum = 0, sq = 0;
  for (let s = 0; s < total; s += 65536) {
    const n = Math.min(65536, total - s), [l, r] = await reader.read(s, n);
    for (let j = 0; j < n; j++) {
      const m = (l[j] + r[j]) / 2;
      sum += m;
      sq += m * m;
    }
  }
  const mean = sum / total, std = Math.sqrt(Math.max(0, (sq - total * mean * mean) / Math.max(1, total - 1)));
  return { mean, std: std > 1e-8 ? std : 1 };
}
async function runStages(ort2, sessions2, stages, feeds) {
  const env = { ...feeds }, last = {};
  stages.forEach((s, i) => s.inputs.forEach((x) => last[x] = i));
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i], out = await sessions2[i].run(Object.fromEntries(s.inputs.map((x) => [x, env[x]])), s.outputs);
    for (const x of s.inputs) if (last[x] === i && !(x in feeds)) {
      env[x].dispose?.();
      delete env[x];
    }
    Object.assign(env, out);
  }
  return env;
}
async function demixChunk(ort2, sessions2, stages, dsp, read, { offset, total, mean, std }) {
  const L = dsp.L, length = Math.min(L, total - offset), delta = L - length, start = offset - Math.floor(delta / 2), lo = Math.floor(delta / 2);
  const raw = await read(start, L);
  for (const ch of raw) for (let j = 0; j < L; j++) {
    const i = start + j;
    ch[j] = i < 0 || i >= total ? 0 : (ch[j] - mean) / std;
  }
  const mix = new Float32Array(2 * L);
  mix.set(raw[0]);
  mix.set(raw[1], L);
  const spec = dsp.stft(raw);
  const t1 = new ort2.Tensor("float32", mix, [1, 2, L]), t2 = new ort2.Tensor("float32", spec, [1, 4, 2048, dsp.T]);
  let env;
  try {
    env = await stage("inference", () => runStages(ort2, sessions2, stages, { mix: t1, spec: t2 }));
  } finally {
    t1.dispose();
    t2.dispose();
  }
  const specOut = ownedCPUOutput(env.spec_out), waveOut = ownedCPUOutput(env.wave_out), S2 = waveOut.length / (2 * L), outputs = [];
  for (let si = 0; si < S2; si++) {
    const y = dsp.istft(specOut, si);
    outputs.push([0, 1].map((c) => {
      const wv = waveOut.subarray((si * 2 + c) * L, (si * 2 + c + 1) * L), o = new Float32Array(length);
      for (let j = 0; j < length; j++) {
        const v2 = (y[c][lo + j] + wv[lo + j]) * std + mean;
        if (!Number.isFinite(v2)) throw Error("HTDemucs\u51FA\u529B\u304C\u4E0D\u6B63\u3067\u3059");
        o[j] = v2;
      }
      return o;
    }));
  }
  return { length, outputs };
}
async function executeHTDemucs(job, { cpuOrt: cpuOrt2, send: send2, isStopped }) {
  globalThis.__STEMLIGHT_NO_OPFS__ = job.caps.opfs === false;
  const reader = await AudioReader.open(job.input, job.audio), total = reader.length, mode = MODES[job.mode], labels = job.selected, weightId = job.weight || (job.model === "htdemucs-6s" ? "htdemucs-6s" : "htdemucs-4s");
  const sessions2 = [];
  let bytes = null;
  const sinks = {};
  try {
    send2({ stage: "\u30E2\u30C7\u30EB\u3092\u8AAD\u307F\u8FBC\u307F", stem: "HTDemucs", percent: 0 });
    const load = performance.now();
    bytes = await loadModel(weightId);
    const { header, stages } = parsePack(bytes), L = header.segment, sources = header.sources.map((s) => DEMUCS_STEMS[s]);
    if (labels.some((s) => s !== "Instrumental" && !sources.includes(s))) throw Error("HTDemucs\u306E\u30B9\u30C6\u30E0\u9078\u629E\u304C\u4E0D\u6B63\u3067\u3059");
    const ort2 = cpuOrt2;
    ort2.env.wasm.wasmPaths = new URL("runtime/", location.href).href;
    ort2.env.wasm.numThreads = benchmarkThreads(job);
    ort2.env.wasm.proxy = false;
    for (const s of stages) sessions2.push(await ort2.InferenceSession.create(s.data, { executionProviders: ["wasm"], graphOptimizationLevel: "all", stemlightStaged: true }));
    bytes = null;
    for (const s of stages) s.data = null;
    await updateTrace({ arrayBufferBytes: 0 });
    job.status = "running";
    job.startedAt ||= Date.now();
    job.outputs ||= [];
    job.metrics ||= {};
    job.metrics.modelLoadMs = (job.metrics.modelLoadMs || 0) + performance.now() - load;
    job.metrics.threads = ort2.env.wasm.numThreads;
    job.metrics.overlap = mode.overlap;
    job.metrics.backend = "wasm";
    job.metrics.stages = stages.length;
    job.norm ||= await normalisation(reader, total);
    const { mean, std } = job.norm, { stride, offsets } = segmentPlan(total, L, mode.overlap), weight = triangle(L), dsp = new DemucsSpectral(L), tail = L - stride;
    job.metrics.plannedChunks = offsets.length;
    const carry = job.current?.weight === weightId ? job.current : null;
    const acc = Object.fromEntries(sources.map((s) => [s, [new Float32Array(L), new Float32Array(L)]])), wsum = new Float32Array(L);
    if (carry) {
      for (const s of sources) for (let c = 0; c < 2; c++) acc[s][c].set(carry.acc[s][c]);
      wsum.set(carry.wsum);
    }
    let offsetsOut = carry?.offsets || {}, waves = carry?.waves || Object.fromEntries(labels.map((s) => [s, new Float32Array(160)]));
    for (const s of labels) {
      sinks[s] = await Sink.open(`out-${job.id}-${s.toLowerCase()}`, offsetsOut[s]?.offset || 0, offsetsOut[s]?.blocks || 0);
      if (!offsetsOut[s]) await sinks[s].write(wavHeader(total));
    }
    await put("jobs", job.id, job);
    for (let k2 = carry?.index || 0; k2 < offsets.length; k2++) {
      if (isStopped()) break;
      const offset = offsets[k2], time = performance.now(), { length, outputs } = await demixChunk(ort2, sessions2, stages, dsp, (a, n) => reader.read(a, n), { offset, total, mean, std });
      job.metrics.inferenceMs = (job.metrics.inferenceMs || 0) + performance.now() - time;
      const postTick = performance.now();
      for (let si = 0; si < sources.length; si++) for (let c = 0; c < 2; c++) {
        const a = acc[sources[si]][c], y = outputs[si][c];
        for (let j = 0; j < length; j++) a[j] += y[j] * weight[j];
      }
      for (let j = 0; j < length; j++) wsum[j] += weight[j];
      const emitCount = Math.min(stride, total - offset, length);
      for (const s of labels) {
        const ch = [0, 1].map((c) => {
          const e = new Float32Array(emitCount);
          if (s === "Instrumental") {
            for (const src of sources) if (src !== "Vocals") {
              const a = acc[src][c];
              for (let j = 0; j < emitCount; j++) e[j] += a[j];
            }
          } else {
            const a = acc[s][c];
            for (let j = 0; j < emitCount; j++) e[j] = a[j];
          }
          for (let j = 0; j < emitCount; j++) e[j] /= wsum[j];
          return e;
        });
        for (let j = 0; j < emitCount; j++) {
          const b = Math.min(159, Math.floor((offset + j) * 160 / total));
          waves[s][b] = Math.max(waves[s][b], Math.abs(ch[0][j]), Math.abs(ch[1][j]));
        }
        const pcm = pcm16(ch);
        job.metrics.clippedSamples = (job.metrics.clippedSamples || 0) + pcm.clipped;
        await sinks[s].write(pcm.bytes);
        offsetsOut[s] = { offset: sinks[s].offset, blocks: sinks[s].blocks || 0 };
      }
      for (const s of sources) for (const a of acc[s]) {
        a.copyWithin(0, stride);
        a.fill(0, L - stride);
      }
      wsum.copyWithin(0, stride);
      wsum.fill(0, L - stride);
      addTime("postprocessing", performance.now() - postTick);
      job.finishedSteps = k2 + 1;
      job.current = { weight: weightId, index: k2 + 1, acc: Object.fromEntries(sources.map((s) => [s, acc[s].map((a) => a.slice(0, tail))])), wsum: wsum.slice(0, tail), offsets: offsetsOut, waves };
      await put("jobs", job.id, job);
      send2({ stage: "\u5206\u96E2", stem: "HTDemucs", percent: Math.min(99, (k2 + 1) / offsets.length * 100), backend: "wasm", processedSeconds: Math.min(total, offset + emitCount) / 44100, inferenceMs: job.metrics.inferenceMs, elapsed: Date.now() - job.startedAt });
      await new Promise((r) => setTimeout(r, 0));
    }
    if (isStopped()) {
      job.status = "paused";
      await put("jobs", job.id, job);
      send2({ paused: true, id: job.id });
      return;
    }
    job.outputs = labels.map((s) => ({ stem: s, key: `out-${job.id}-${s.toLowerCase()}`, frames: total, rate: 44100, waveform: Array.from(waves[s]), bytes: 44 + total * 4 }));
    job.current = null;
    job.status = "complete";
    job.completedAt = Date.now();
    job.metrics.wallMs = job.completedAt - job.startedAt;
    await put("jobs", job.id, job);
    send2({ complete: true, id: job.id, outputs: job.outputs, metrics: job.metrics });
  } finally {
    for (const s of Object.values(sinks)) s.close();
    for (const s of sessions2) await s.release().catch(() => {
    });
    bytes = null;
  }
}
var DEMUCS_STEMS, DemucsSpectral;
var init_htdemucs = __esm({
  "src/htdemucs.js"() {
    init_benchmark_policy();
    init_performance();
    init_load_trace();
    init_dsp();
    init_storage();
    init_audio();
    init_models();
    init_catalog();
    DEMUCS_STEMS = { drums: "Drums", bass: "Bass", other: "Other", vocals: "Vocals", guitar: "Guitar", piano: "Piano" };
    DemucsSpectral = class {
      constructor(length) {
        this.L = length;
        this.T = Math.ceil(length / 1024);
        this.n = 4096;
        this.fft = new Fourier(4096);
        this.window = Float64Array.from({ length: 4096 }, (_, j) => 0.5 - 0.5 * Math.cos(2 * Math.PI * j / 4096));
        this.a = new Float64Array(8192);
        this.b = new Float64Array(8192);
        const frames = this.T + 4, span = (frames - 1) * 1024 + 4096;
        this.wsum = new Float64Array(span);
        for (let t = 0; t < frames; t++) for (let j = 0; j < 4096; j++) this.wsum[t * 1024 + j] += this.window[j] ** 2;
      }
      stft(channels) {
        return measure("stft", () => {
          const { L, T, a, b, window: w } = this, out = new Float32Array(4 * 2048 * T);
          for (let c = 0; c < 2; c++) {
            const x = channels[c];
            for (let t = 0; t < T; t++) {
              const base = t * 1024 - 1536;
              for (let j = 0; j < 4096; j++) {
                const i = base + j;
                a[2 * j] = x[i >= 0 && i < L ? i : reflect(i, L)] * w[j];
                a[2 * j + 1] = 0;
              }
              this.fft.forward(a, b);
              for (let f = 0; f < 2048; f++) {
                out[(2 * c * 2048 + f) * T + t] = b[2 * f] / 64;
                out[((2 * c + 1) * 2048 + f) * T + t] = b[2 * f + 1] / 64;
              }
            }
          }
          return out;
        });
      }
      // spec: [S,4,2048,T] flat; returns the source's two channels, length L.
      istft(spec, source) {
        return measure("istft", () => {
          const { L, T, a, b, window: w, wsum } = this, off = source * 4 * 2048 * T, acc = new Float64Array(wsum.length), out = [new Float32Array(L), new Float32Array(L)];
          for (let c = 0; c < 2; c++) {
            acc.fill(0);
            for (let tt2 = 0; tt2 < T; tt2++) {
              const t = tt2 + 2;
              a.fill(0);
              for (let f = 0; f < 2048; f++) {
                const re = spec[off + (2 * c * 2048 + f) * T + tt2] * 64, im = spec[off + ((2 * c + 1) * 2048 + f) * T + tt2] * 64;
                a[2 * f] = re;
                a[2 * f + 1] = im;
                if (f > 0) {
                  a[2 * (4096 - f)] = re;
                  a[2 * (4096 - f) + 1] = -im;
                }
              }
              this.fft.inverse(a, b);
              const p = t * 1024;
              for (let j = 0; j < 4096; j++) acc[p + j] += b[2 * j] * w[j];
            }
            const o = out[c];
            for (let i = 0; i < L; i++) {
              const k2 = i + 1536 + 2048;
              o[i] = acc[k2] / wsum[k2];
            }
          }
          return out;
        });
      }
    };
  }
});

// src/bs-roformer.js
var bs_roformer_exports = {};
__export(bs_roformer_exports, {
  BS: () => BS,
  executeBS: () => executeBS
});
async function executeBS(job, { cpuOrt: cpuOrt2, send: send2, isStopped }) {
  globalThis.__STEMLIGHT_NO_OPFS__ = job.caps.opfs === false;
  const reader = await AudioReader.open(job.input, job.audio), total = reader.length, mode = MODES[job.mode], labels = job.selected;
  if (!labels.length || labels.some((s) => !BS.order.includes(s))) throw Error("BS-RoFormer SW\u306E\u30B9\u30C6\u30E0\u9078\u629E\u304C\u4E0D\u6B63\u3067\u3059");
  const frames = 64, weightId = "bs-sw-core";
  const paddedLength = (frames - 1) * 512, inputLength = paddedLength, core = inputLength - 2048, step = Math.floor(core * (1 - mode.overlap)), steps = Math.ceil(total / step), dsp = new Spectral(2048, 1025, frames, 512);
  job.status = "running";
  job.startedAt ||= Date.now();
  job.outputs ||= [];
  job.metrics ||= {};
  job.frames = frames;
  const carry = job.current?.weight === weightId ? job.current : null;
  let acc = carry?.acc || Object.fromEntries(labels.map((s) => [s, [new Float32Array(core), new Float32Array(core)]])), divider = carry?.divider || new Float32Array(core), offsets = carry?.offsets || {}, waves = carry?.waves || Object.fromEntries(labels.map((s) => [s, new Float32Array(160)]));
  const sinks = {};
  let session, bytes, external, ort2 = cpuOrt2, backend = "wasm", first = true;
  const configure2 = () => {
    ort2.env.wasm.wasmPaths = new URL("runtime/", location.href).href;
    ort2.env.wasm.numThreads = job.caps.shared ? Math.max(1, Math.min(2, Math.floor(job.caps.cores / 2))) : 1;
    ort2.env.wasm.proxy = false;
  };
  const create = (provider) => ort2.InferenceSession.create(bytes, { executionProviders: [provider], graphOptimizationLevel: "disabled", enableMemPattern: false, externalData: [{ path: "bs-weights.bin", data: external }] });
  const run = async (x) => {
    const size = 1025 * frames, real = new Float32Array(size * 2), imag = new Float32Array(size * 2);
    for (let c = 0; c < 2; c++) {
      real.set(x.subarray(c * 2 * size, (c * 2 + 1) * size), c * size);
      imag.set(x.subarray((c * 2 + 1) * size, (c * 2 + 2) * size), c * size);
    }
    const [r, i] = await stage("tensor allocation", async () => [new ort2.Tensor("float32", real, [1, 2, 1025, frames]), new ort2.Tensor("float32", imag, [1, 2, 1025, frames])]);
    let out;
    try {
      out = await stage("inference", () => session.run({ spec_real: r, spec_imag: i }));
      const y = new Float32Array(6 * x.length);
      for (let stem = 0; stem < 6; stem++) for (let c = 0; c < 2; c++) {
        const from = (stem * 2 + c) * size, to = stem * x.length + c * 2 * size;
        y.set(out.out_spec_real.data.subarray(from, from + size), to);
        y.set(out.out_spec_imag.data.subarray(from, from + size), to + size);
      }
      if (!y.every(Number.isFinite)) throw Error("BS\u51FA\u529B\u304C\u4E0D\u6B63\u3067\u3059");
      return y;
    } finally {
      r.dispose();
      i.dispose();
      if (out) for (const v2 of Object.values(out)) v2.dispose();
    }
  };
  try {
    for (const s of labels) {
      sinks[s] = await Sink.open(`out-${job.id}-${s.toLowerCase()}`, offsets[s]?.offset || 0, offsets[s]?.blocks || 0);
      if (!offsets[s]) await sinks[s].write(wavHeader(total));
    }
    send2({ stage: "BS-RoFormer SW\u3092\u8AAD\u307F\u8FBC\u307F", stem: "BS-RoFormer SW", percent: (job.finishedSteps || 0) / steps * 100 });
    const load = performance.now();
    bytes = await loadModel(weightId);
    external = await loadModel("bs-sw-data");
    configure2();
    if (job.backend === "webgpu" && job.caps.webgpu) {
      try {
        ort2 = trackedOrt(await import(new URL("runtime/ort.webgpu.min.mjs", location.href).href));
        configure2();
        session = await create("webgpu");
        backend = "webgpu";
      } catch (e) {
        job.metrics.gpuFailure = String(e.message);
        ort2 = cpuOrt2;
        configure2();
        send2({ notice: "BS-RoFormer SW GPU\u3092\u958B\u59CB\u3067\u304D\u306A\u3044\u305F\u3081WASM\u3078\u5207\u308A\u66FF\u3048\u307E\u3059", detail: String(e.message) });
      }
    }
    session ||= await create("wasm");
    if (backend === "wasm") {
      bytes = null;
      external = null;
      await updateTrace({ arrayBufferBytes: 0 });
    }
    job.metrics.modelLoadMs = (job.metrics.modelLoadMs || 0) + performance.now() - load;
    job.metrics.threads = ort2.env.wasm.numThreads;
    job.metrics.chunkFrames = frames;
    job.metrics.overlap = mode.overlap;
    job.metrics.passes = 1;
    job.metrics.plannedChunks = steps;
    job.metrics.chunkSamples = inputLength;
    job.metrics.hop = 512;
    job.metrics.modelBytes = 352864791;
    job.metrics.memoryEstimateBytes = 1450 * 1024 ** 2;
    job.metrics.memoryMeasurement = "estimate, not observed RAM peak";
    await put("jobs", job.id, job);
    for (let start = carry?.next || 0; start < total; start += step) {
      if (isStopped()) break;
      const raw = await reader.read(start - BS.trim, inputLength), chunk = raw.map((c) => {
        const p = new Float32Array(paddedLength);
        p.set(c);
        return p;
      });
      const x = dsp.stft(chunk, false), time = performance.now();
      let prediction;
      try {
        prediction = await run(x);
      } catch (e) {
        if (backend !== "webgpu") throw e;
        await session.release();
        ort2 = cpuOrt2;
        configure2();
        session = await create("wasm");
        backend = "wasm";
        prediction = await run(x);
        send2({ notice: "BS-RoFormer SW GPU\u63A8\u8AD6\u306B\u5931\u6557\u3057\u305F\u305F\u3081WASM\u3067\u518D\u51E6\u7406\u3057\u307E\u3059" });
      }
      if (first && backend === "webgpu") {
        await session.release();
        ort2 = cpuOrt2;
        configure2();
        session = await create("wasm");
        const cpu = await run(x);
        let sq = 0, ref = 0;
        for (let i = 0; i < cpu.length; i += 127) {
          sq += (prediction[i] - cpu[i]) ** 2;
          ref += cpu[i] ** 2;
        }
        const error = Math.sqrt(sq / Math.max(ref, 1e-20));
        job.metrics.gpuParity = error;
        prediction = cpu;
        if (error <= 5e-3) {
          await session.release();
          ort2 = trackedOrt(await import(new URL("runtime/ort.webgpu.min.mjs", location.href).href));
          configure2();
          try {
            session = await create("webgpu");
            backend = "webgpu";
          } catch (e) {
            job.metrics.gpuFailure = String(e.message);
            ort2 = cpuOrt2;
            configure2();
            session = await create("wasm");
            backend = "wasm";
          }
        } else backend = "wasm";
        send2({ notice: error > 5e-3 ? "BS-RoFormer SW GPU\u6570\u5024\u691C\u8A3C\u3092\u901A\u904E\u3057\u306A\u304B\u3063\u305F\u305F\u3081WASM\u3092\u4F7F\u7528\u3057\u307E\u3059" : "BS GPU\u3068WASM\u3092\u6BD4\u8F03\u3057\u307E\u3057\u305F\u3002\u5229\u7528\u53EF\u80FD\u306A\u30D0\u30C3\u30AF\u30A8\u30F3\u30C9\u3067\u7D99\u7D9A\u3057\u307E\u3059" });
      }
      first = false;
      job.metrics.inferenceMs = (job.metrics.inferenceMs || 0) + performance.now() - time;
      job.metrics.backend = backend;
      for (let j = 0; j < core; j++) divider[j] += Math.max(1e-4, Math.sin(Math.PI * (j + 0.5) / core) ** 2);
      const count = Math.min(step, total - start), span = x.length;
      for (const s of labels) {
        const index = BS.order.indexOf(s), out = dsp.istft(prediction.subarray(index * span, (index + 1) * span));
        for (let j = 0; j < core; j++) {
          const a = Math.max(1e-4, Math.sin(Math.PI * (j + 0.5) / core) ** 2);
          for (let c = 0; c < 2; c++) acc[s][c][j] += out[c][j + BS.trim] * a;
        }
        const emit = acc[s].map((a) => Float32Array.from({ length: count }, (_, j) => a[j] / Math.max(divider[j], 1e-12)));
        for (let j = 0; j < count; j++) {
          const b = Math.min(159, Math.floor((start + j) * 160 / total));
          waves[s][b] = Math.max(waves[s][b], Math.abs(emit[0][j]), Math.abs(emit[1][j]));
        }
        const pcm = pcm16(emit);
        job.metrics.clippedSamples = (job.metrics.clippedSamples || 0) + pcm.clipped;
        await sinks[s].write(pcm.bytes);
        offsets[s] = { offset: sinks[s].offset, blocks: sinks[s].blocks || 0 };
        for (const a of acc[s]) {
          a.copyWithin(0, step);
          a.fill(0, core - step);
        }
      }
      divider.copyWithin(0, step);
      divider.fill(0, core - step);
      job.finishedSteps = (job.finishedSteps || 0) + 1;
      job.current = { weight: weightId, next: start + step, acc, divider, offsets, waves };
      await put("jobs", job.id, job);
      send2({ stage: "6\u30B9\u30C6\u30E0\u3092\u5206\u96E2", stem: "BS-RoFormer SW", percent: Math.min(99, job.finishedSteps / steps * 100), backend, processedSeconds: Math.min(total, start + count) / 44100, inferenceMs: job.metrics.inferenceMs, elapsed: Date.now() - job.startedAt });
      await new Promise((r) => setTimeout(r, 0));
    }
    if (isStopped()) {
      job.status = "paused";
      await put("jobs", job.id, job);
      send2({ paused: true, id: job.id });
      return;
    }
    job.outputs = labels.map((s) => ({ stem: s, key: `out-${job.id}-${s.toLowerCase()}`, frames: total, rate: 44100, waveform: Array.from(waves[s]), bytes: 44 + total * 4 }));
    job.current = null;
    job.status = "complete";
    job.completedAt = Date.now();
    job.metrics.wallMs = job.completedAt - job.startedAt;
    await put("jobs", job.id, job);
    send2({ complete: true, id: job.id, outputs: job.outputs, metrics: job.metrics });
  } finally {
    for (const s of Object.values(sinks)) s.close();
    await session?.release().catch(() => {
    });
    bytes = null;
    external = null;
  }
}
var BS;
var init_bs_roformer = __esm({
  "src/bs-roformer.js"() {
    init_load_trace();
    init_dsp();
    init_storage();
    init_audio();
    init_models();
    init_catalog();
    BS = { order: ["Bass", "Drums", "Other", "Vocals", "Guitar", "Piano"], trim: 1024 };
  }
});

// node_modules/onnxruntime-web/dist/ort.wasm.min.mjs
var ort_wasm_min_exports = {};
__export(ort_wasm_min_exports, {
  InferenceSession: () => Un,
  TRACE: () => Nt,
  TRACE_EVENT_BEGIN: () => K,
  TRACE_EVENT_END: () => Q,
  TRACE_FUNC_BEGIN: () => Z,
  TRACE_FUNC_END: () => X,
  Tensor: () => G,
  default: () => Ro,
  env: () => B,
  registerBackend: () => pe
});
var Ve, On, Ln, Pn, Je, E, qe, Dn, wt, Se, q, pe, _n, ht, Ye, bt, yt, gt, Et, D, Ze, B, St, Tt, It, At, Xe, Bt, Ot, Lt, Pt, Dt, _t, Y, me, Ut, xt, vt, Ct, Mt, Rt, v, Te, G, Ke, Nt, Ft, Z, X, K, Q, Qe, Ie, kt, Un, Wt, Gt, $t, zt, Ht, et, J, Ae, qt, Vt, Jt, xn, Yt, Kt, vn, Cn, R, Ce, nt, Mn, Rn, Qt, Nn, Zt, en, Xt, tn, Be, rt, ot, Me, nn, Fn, kn, Wn, Oe, I, ee, N, he, S, Re, rn, on, Gn, $n, zn, se, Hn, sn, an, ie, Ne, ae, un, fn, Fe, ke, cn, st, be, it, jn, Le, Pe, ue, Vn, dn, we, De, _e, ln, Ue, xe, ve, tt, ne, k, ye, Ge, $e, We, at, ut, fe, ce, qn, pn, mn, wn, hn, bn, yn, gn, ft, En, Yn, ze, Sn, In, Tn, He, Zn, An, jt, Ro;
var init_ort_wasm_min = __esm({
  "node_modules/onnxruntime-web/dist/ort.wasm.min.mjs"() {
    Ve = Object.defineProperty;
    On = Object.getOwnPropertyDescriptor;
    Ln = Object.getOwnPropertyNames;
    Pn = Object.prototype.hasOwnProperty;
    Je = ((e) => typeof __require < "u" ? __require : typeof Proxy < "u" ? new Proxy(e, { get: (t, n) => (typeof __require < "u" ? __require : t)[n] }) : e)(function(e) {
      if (typeof __require < "u") return __require.apply(this, arguments);
      throw Error('Dynamic require of "' + e + '" is not supported');
    });
    E = (e, t, n) => () => {
      if (n) throw n[0];
      try {
        return e && (t = e(e = 0)), t;
      } catch (o) {
        throw n = [o], o;
      }
    };
    qe = (e, t) => {
      for (var n in t) Ve(e, n, { get: t[n], enumerable: true });
    };
    Dn = (e, t, n, o) => {
      if (t && typeof t == "object" || typeof t == "function") for (let r of Ln(t)) !Pn.call(e, r) && r !== n && Ve(e, r, { get: () => t[r], enumerable: !(o = On(t, r)) || o.enumerable });
      return e;
    };
    wt = (e) => Dn(Ve({}, "__esModule", { value: true }), e);
    Ye = E(() => {
      "use strict";
      Se = /* @__PURE__ */ new Map(), q = [], pe = (e, t, n) => {
        if (t && typeof t.init == "function" && typeof t.createInferenceSessionHandler == "function") {
          let o = Se.get(e);
          if (o === void 0) Se.set(e, { backend: t, priority: n });
          else {
            if (o.priority > n) return;
            if (o.priority === n && o.backend !== t) throw new Error(`cannot register backend "${e}" using priority ${n}`);
          }
          if (n >= 0) {
            let r = q.indexOf(e);
            r !== -1 && q.splice(r, 1);
            for (let i = 0; i < q.length; i++) if (Se.get(q[i]).priority <= n) {
              q.splice(i, 0, e);
              return;
            }
            q.push(e);
          }
          return;
        }
        throw new TypeError("not a valid backend");
      }, _n = async (e) => {
        let t = Se.get(e);
        if (!t) return "backend not found.";
        if (t.initialized) return t.backend;
        if (t.aborted) return t.error;
        {
          let n = !!t.initPromise;
          try {
            return n || (t.initPromise = t.backend.init(e)), await t.initPromise, t.initialized = true, t.backend;
          } catch (o) {
            return n || (t.error = `${o}`, t.aborted = true), t.error;
          } finally {
            delete t.initPromise;
          }
        }
      }, ht = async (e) => {
        let t = e.executionProviders || [], n = t.map((u) => typeof u == "string" ? u : u.name), o = n.length === 0 ? q : n, r, i = [], s = /* @__PURE__ */ new Set();
        for (let u of o) {
          let f = await _n(u);
          typeof f == "string" ? i.push({ name: u, err: f }) : (r || (r = f), r === f && s.add(u));
        }
        if (!r) throw new Error(`no available backend found. ERR: ${i.map((u) => `[${u.name}] ${u.err}`).join(", ")}`);
        for (let { name: u, err: f } of i) n.includes(u) && console.warn(`removing requested execution provider "${u}" from session options because it is not available: ${f}`);
        let a = t.filter((u) => s.has(typeof u == "string" ? u : u.name));
        return [r, new Proxy(e, { get: (u, f) => f === "executionProviders" ? a : Reflect.get(u, f) })];
      };
    });
    bt = E(() => {
      "use strict";
      Ye();
    });
    gt = E(() => {
      "use strict";
      yt = "1.30.0";
    });
    Ze = E(() => {
      "use strict";
      gt();
      Et = "warning", D = { wasm: {}, webgl: {}, webgpu: {}, versions: { common: yt }, set logLevel(e) {
        if (e !== void 0) {
          if (typeof e != "string" || ["verbose", "info", "warning", "error", "fatal"].indexOf(e) === -1) throw new Error(`Unsupported logging level: ${e}`);
          Et = e;
        }
      }, get logLevel() {
        return Et;
      } };
      Object.defineProperty(D, "logLevel", { enumerable: true });
    });
    St = E(() => {
      "use strict";
      Ze();
      B = D;
    });
    At = E(() => {
      "use strict";
      Tt = (e, t) => {
        let n = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
        n.width = e.dims[3], n.height = e.dims[2];
        let o = n.getContext("2d");
        if (o != null) {
          let r, i;
          t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (r = e.dims[2], i = e.dims[3]) : (r = e.dims[3], i = e.dims[2]);
          let s = t?.format !== void 0 ? t.format : "RGB", a = t?.norm, u, f;
          a === void 0 || a.mean === void 0 ? u = [255, 255, 255, 255] : typeof a.mean == "number" ? u = [a.mean, a.mean, a.mean, a.mean] : (u = [a.mean[0], a.mean[1], a.mean[2], 0], a.mean[3] !== void 0 && (u[3] = a.mean[3])), a === void 0 || a.bias === void 0 ? f = [0, 0, 0, 0] : typeof a.bias == "number" ? f = [a.bias, a.bias, a.bias, a.bias] : (f = [a.bias[0], a.bias[1], a.bias[2], 0], a.bias[3] !== void 0 && (f[3] = a.bias[3]));
          let l = i * r, c = 0, d = l, p = l * 2, h = -1;
          s === "RGBA" ? (c = 0, d = l, p = l * 2, h = l * 3) : s === "RGB" ? (c = 0, d = l, p = l * 2) : s === "RBG" && (c = 0, p = l, d = l * 2);
          for (let b = 0; b < i; b++) for (let A = 0; A < r; A++) {
            let m = (e.data[c++] - f[0]) * u[0], w = (e.data[d++] - f[1]) * u[1], O = (e.data[p++] - f[2]) * u[2], g = h === -1 ? 255 : (e.data[h++] - f[3]) * u[3];
            o.fillStyle = "rgba(" + m + "," + w + "," + O + "," + g + ")", o.fillRect(A, b, 1, 1);
          }
          if ("toDataURL" in n) return n.toDataURL();
          throw new Error("toDataURL is not supported");
        } else throw new Error("Can not access image data");
      }, It = (e, t) => {
        let n = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d"), o;
        if (n != null) {
          let r, i, s;
          t?.tensorLayout !== void 0 && t.tensorLayout === "NHWC" ? (r = e.dims[2], i = e.dims[1], s = e.dims[3]) : (r = e.dims[3], i = e.dims[2], s = e.dims[1]);
          let a = t !== void 0 && t.format !== void 0 ? t.format : "RGB", u = t?.norm, f, l;
          u === void 0 || u.mean === void 0 ? f = [255, 255, 255, 255] : typeof u.mean == "number" ? f = [u.mean, u.mean, u.mean, u.mean] : (f = [u.mean[0], u.mean[1], u.mean[2], 255], u.mean[3] !== void 0 && (f[3] = u.mean[3])), u === void 0 || u.bias === void 0 ? l = [0, 0, 0, 0] : typeof u.bias == "number" ? l = [u.bias, u.bias, u.bias, u.bias] : (l = [u.bias[0], u.bias[1], u.bias[2], 0], u.bias[3] !== void 0 && (l[3] = u.bias[3]));
          let c = i * r;
          if (t !== void 0 && (t.format !== void 0 && s === 4 && t.format !== "RGBA" || s === 3 && t.format !== "RGB" && t.format !== "BGR")) throw new Error("Tensor format doesn't match input tensor dims");
          let d = 4, p = 0, h = 1, b = 2, A = 3, m = 0, w = c, O = c * 2, g = -1;
          a === "RGBA" ? (m = 0, w = c, O = c * 2, g = c * 3) : a === "RGB" ? (m = 0, w = c, O = c * 2) : a === "RBG" && (m = 0, O = c, w = c * 2), o = n.createImageData(r, i);
          for (let T = 0; T < i * r; p += d, h += d, b += d, A += d, T++) o.data[p] = (e.data[m++] - l[0]) * f[0], o.data[h] = (e.data[w++] - l[1]) * f[1], o.data[b] = (e.data[O++] - l[2]) * f[2], o.data[A] = g === -1 ? 255 : (e.data[g++] - l[3]) * f[3];
        } else throw new Error("Can not access image data");
        return o;
      };
    });
    _t = E(() => {
      "use strict";
      Te();
      Xe = (e, t) => {
        if (e === void 0) throw new Error("Image buffer must be defined");
        if (t.height === void 0 || t.width === void 0) throw new Error("Image height and width must be defined");
        if (t.tensorLayout === "NHWC") throw new Error("NHWC Tensor layout is not supported yet");
        let { height: n, width: o } = t, r = t.norm ?? { mean: 255, bias: 0 }, i, s;
        typeof r.mean == "number" ? i = [r.mean, r.mean, r.mean, r.mean] : i = [r.mean[0], r.mean[1], r.mean[2], r.mean[3] ?? 255], typeof r.bias == "number" ? s = [r.bias, r.bias, r.bias, r.bias] : s = [r.bias[0], r.bias[1], r.bias[2], r.bias[3] ?? 0];
        let a = t.format !== void 0 ? t.format : "RGBA", u = t.tensorFormat !== void 0 && t.tensorFormat !== void 0 ? t.tensorFormat : "RGB", f = n * o, l = u === "RGBA" ? new Float32Array(f * 4) : new Float32Array(f * 3), c = 4, d = 0, p = 1, h = 2, b = 3, A = 0, m = f, w = f * 2, O = -1;
        a === "RGB" && (c = 3, d = 0, p = 1, h = 2, b = -1), u === "RGBA" ? O = f * 3 : u === "RBG" ? (A = 0, w = f, m = f * 2) : u === "BGR" && (w = 0, m = f, A = f * 2);
        for (let T = 0; T < f; T++, d += c, h += c, p += c, b += c) l[A++] = (e[d] + s[0]) / i[0], l[m++] = (e[p] + s[1]) / i[1], l[w++] = (e[h] + s[2]) / i[2], O !== -1 && b !== -1 && (l[O++] = (e[b] + s[3]) / i[3]);
        return u === "RGBA" ? new v("float32", l, [1, 4, n, o]) : new v("float32", l, [1, 3, n, o]);
      }, Bt = async (e, t) => {
        let n = typeof HTMLImageElement < "u" && e instanceof HTMLImageElement, o = typeof ImageData < "u" && e instanceof ImageData, r = typeof ImageBitmap < "u" && e instanceof ImageBitmap, i = typeof e == "string", s, a = t ?? {}, u = () => {
          if (typeof document < "u") return document.createElement("canvas");
          if (typeof OffscreenCanvas < "u") return new OffscreenCanvas(1, 1);
          throw new Error("Canvas is not supported");
        }, f = (l) => typeof HTMLCanvasElement < "u" && l instanceof HTMLCanvasElement || l instanceof OffscreenCanvas ? l.getContext("2d") : null;
        if (n) {
          let l = u();
          l.width = e.width, l.height = e.height;
          let c = f(l);
          if (c != null) {
            let d = e.height, p = e.width;
            if (t !== void 0 && t.resizedHeight !== void 0 && t.resizedWidth !== void 0 && (d = t.resizedHeight, p = t.resizedWidth), t !== void 0) {
              if (a = t, t.tensorFormat !== void 0) throw new Error("Image input config format must be RGBA for HTMLImageElement");
              a.tensorFormat = "RGBA", a.height = d, a.width = p;
            } else a.tensorFormat = "RGBA", a.height = d, a.width = p;
            c.drawImage(e, 0, 0), s = c.getImageData(0, 0, p, d).data;
          } else throw new Error("Can not access image data");
        } else if (o) {
          let l, c;
          if (t !== void 0 && t.resizedWidth !== void 0 && t.resizedHeight !== void 0 ? (l = t.resizedHeight, c = t.resizedWidth) : (l = e.height, c = e.width), t !== void 0 && (a = t), a.format = "RGBA", a.height = l, a.width = c, t !== void 0) {
            let d = u();
            d.width = c, d.height = l;
            let p = f(d);
            if (p != null) p.putImageData(e, 0, 0), s = p.getImageData(0, 0, c, l).data;
            else throw new Error("Can not access image data");
          } else s = e.data;
        } else if (r) {
          if (t === void 0) throw new Error("Please provide image config with format for Imagebitmap");
          let l = u();
          l.width = e.width, l.height = e.height;
          let c = f(l);
          if (c != null) {
            let d = e.height, p = e.width;
            return c.drawImage(e, 0, 0, p, d), s = c.getImageData(0, 0, p, d).data, a.height = d, a.width = p, Xe(s, a);
          } else throw new Error("Can not access image data");
        } else {
          if (i) return new Promise((l, c) => {
            let d = u(), p = f(d);
            if (!e || !p) return c();
            let h = new Image();
            h.crossOrigin = "Anonymous", h.src = e, h.onload = () => {
              d.width = h.width, d.height = h.height, p.drawImage(h, 0, 0, d.width, d.height);
              let b = p.getImageData(0, 0, d.width, d.height);
              a.height = d.height, a.width = d.width, l(Xe(b.data, a));
            };
          });
          throw new Error("Input data provided is not supported - aborted tensor creation");
        }
        if (s !== void 0) return Xe(s, a);
        throw new Error("Input data provided is not supported - aborted tensor creation");
      }, Ot = (e, t) => {
        let { width: n, height: o, download: r, dispose: i } = t, s = [1, o, n, 4];
        return new v({ location: "texture", type: "float32", texture: e, dims: s, download: r, dispose: i });
      }, Lt = (e, t) => {
        let { dataType: n, dims: o, download: r, dispose: i } = t;
        return new v({ location: "gpu-buffer", type: n ?? "float32", gpuBuffer: e, dims: o, download: r, dispose: i });
      }, Pt = (e, t) => {
        let { dataType: n, dims: o, download: r, dispose: i } = t;
        return new v({ location: "ml-tensor", type: n ?? "float32", mlTensor: e, dims: o, download: r, dispose: i });
      }, Dt = (e, t, n) => new v({ location: "cpu-pinned", type: e, data: t, dims: n ?? [t.length] });
    });
    vt = E(() => {
      "use strict";
      Y = /* @__PURE__ */ new Map([["float32", Float32Array], ["uint8", Uint8Array], ["int8", Int8Array], ["uint16", Uint16Array], ["int16", Int16Array], ["int32", Int32Array], ["bool", Uint8Array], ["float64", Float64Array], ["uint32", Uint32Array], ["int4", Uint8Array], ["uint4", Uint8Array]]), me = /* @__PURE__ */ new Map([[Float32Array, "float32"], [Uint8Array, "uint8"], [Int8Array, "int8"], [Uint16Array, "uint16"], [Int16Array, "int16"], [Int32Array, "int32"], [Float64Array, "float64"], [Uint32Array, "uint32"]]), Ut = false, xt = () => {
        if (!Ut) {
          Ut = true;
          let e = typeof BigInt64Array < "u" && BigInt64Array.from, t = typeof BigUint64Array < "u" && BigUint64Array.from, n = globalThis.Float16Array, o = typeof n < "u" && n.from;
          e && (Y.set("int64", BigInt64Array), me.set(BigInt64Array, "int64")), t && (Y.set("uint64", BigUint64Array), me.set(BigUint64Array, "uint64")), o ? (Y.set("float16", n), me.set(n, "float16")) : Y.set("float16", Uint16Array);
        }
      };
    });
    Rt = E(() => {
      "use strict";
      Te();
      Ct = (e) => {
        let t = 1;
        for (let n = 0; n < e.length; n++) {
          let o = e[n];
          if (typeof o != "number" || !Number.isSafeInteger(o)) throw new TypeError(`dims[${n}] must be an integer, got: ${o}`);
          if (o < 0) throw new RangeError(`dims[${n}] must be a non-negative integer, got: ${o}`);
          t *= o;
        }
        return t;
      }, Mt = (e, t) => {
        switch (e.location) {
          case "cpu":
            return new v(e.type, e.data, t);
          case "cpu-pinned":
            return new v({ location: "cpu-pinned", data: e.data, type: e.type, dims: t });
          case "texture":
            return new v({ location: "texture", texture: e.texture, type: e.type, dims: t });
          case "gpu-buffer":
            return new v({ location: "gpu-buffer", gpuBuffer: e.gpuBuffer, type: e.type, dims: t });
          case "ml-tensor":
            return new v({ location: "ml-tensor", mlTensor: e.mlTensor, type: e.type, dims: t });
          default:
            throw new Error(`tensorReshape: tensor location ${e.location} is not supported`);
        }
      };
    });
    Te = E(() => {
      "use strict";
      At();
      _t();
      vt();
      Rt();
      v = class {
        constructor(t, n, o) {
          xt();
          let r, i;
          if (typeof t == "object" && "location" in t) switch (this.dataLocation = t.location, r = t.type, i = t.dims, t.location) {
            case "cpu-pinned": {
              let a = Y.get(r);
              if (!a) throw new TypeError(`unsupported type "${r}" to create tensor from pinned buffer`);
              if (!(t.data instanceof a)) throw new TypeError(`buffer should be of type ${a.name}`);
              this.cpuData = t.data;
              break;
            }
            case "texture": {
              if (r !== "float32") throw new TypeError(`unsupported type "${r}" to create tensor from texture`);
              this.gpuTextureData = t.texture, this.downloader = t.download, this.disposer = t.dispose;
              break;
            }
            case "gpu-buffer": {
              if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw new TypeError(`unsupported type "${r}" to create tensor from gpu buffer`);
              this.gpuBufferData = t.gpuBuffer, this.downloader = t.download, this.disposer = t.dispose;
              break;
            }
            case "ml-tensor": {
              if (r !== "float32" && r !== "float16" && r !== "int32" && r !== "int64" && r !== "uint32" && r !== "uint64" && r !== "int8" && r !== "uint8" && r !== "bool" && r !== "uint4" && r !== "int4") throw new TypeError(`unsupported type "${r}" to create tensor from MLTensor`);
              this.mlTensorData = t.mlTensor, this.downloader = t.download, this.disposer = t.dispose;
              break;
            }
            default:
              throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
          }
          else {
            let a, u;
            if (typeof t == "string") if (r = t, u = o, t === "string") {
              if (!Array.isArray(n)) throw new TypeError("A string tensor's data must be a string array.");
              a = n;
            } else {
              let f = Y.get(t);
              if (f === void 0) throw new TypeError(`Unsupported tensor type: ${t}.`);
              if (Array.isArray(n)) {
                if (t === "float16" && f === Uint16Array || t === "uint4" || t === "int4") throw new TypeError(`Creating a ${t} tensor from number array is not supported. Please use ${f.name} as data.`);
                t === "uint64" || t === "int64" ? a = f.from(n, BigInt) : a = f.from(n);
              } else if (n instanceof f) a = n;
              else if (n instanceof Uint8ClampedArray) if (t === "uint8") a = Uint8Array.from(n);
              else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
              else if (t === "float16" && n instanceof Uint16Array && f !== Uint16Array) a = new globalThis.Float16Array(n.buffer, n.byteOffset, n.length);
              else throw new TypeError(`A ${r} tensor's data must be type of ${f}`);
            }
            else if (u = n, Array.isArray(t)) {
              if (t.length === 0) throw new TypeError("Tensor type cannot be inferred from an empty array.");
              let f = typeof t[0];
              if (f === "string") r = "string", a = t;
              else if (f === "boolean") r = "bool", a = Uint8Array.from(t);
              else throw new TypeError(`Invalid element type of data array: ${f}.`);
            } else if (t instanceof Uint8ClampedArray) r = "uint8", a = Uint8Array.from(t);
            else {
              let f = me.get(t.constructor);
              if (f === void 0) throw new TypeError(`Unsupported type for tensor data: ${t.constructor}.`);
              r = f, a = t;
            }
            if (u === void 0) u = [a.length];
            else if (!Array.isArray(u)) throw new TypeError("A tensor's dims must be a number array");
            i = u, this.cpuData = a, this.dataLocation = "cpu";
          }
          let s = Ct(i);
          if (this.cpuData && s !== this.cpuData.length && !((r === "uint4" || r === "int4") && Math.ceil(s / 2) === this.cpuData.length)) throw new Error(`Tensor's size(${s}) does not match data length(${this.cpuData.length}).`);
          this.type = r, this.dims = i, this.size = s;
        }
        static async fromImage(t, n) {
          return Bt(t, n);
        }
        static fromTexture(t, n) {
          return Ot(t, n);
        }
        static fromGpuBuffer(t, n) {
          return Lt(t, n);
        }
        static fromMLTensor(t, n) {
          return Pt(t, n);
        }
        static fromPinnedBuffer(t, n, o) {
          return Dt(t, n, o);
        }
        toDataURL(t) {
          return Tt(this, t);
        }
        toImageData(t) {
          return It(this, t);
        }
        get data() {
          if (this.ensureValid(), !this.cpuData) throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
          return this.cpuData;
        }
        get location() {
          return this.dataLocation;
        }
        get texture() {
          if (this.ensureValid(), !this.gpuTextureData) throw new Error("The data is not stored as a WebGL texture.");
          return this.gpuTextureData;
        }
        get gpuBuffer() {
          if (this.ensureValid(), !this.gpuBufferData) throw new Error("The data is not stored as a WebGPU buffer.");
          return this.gpuBufferData;
        }
        get mlTensor() {
          if (this.ensureValid(), !this.mlTensorData) throw new Error("The data is not stored as a WebNN MLTensor.");
          return this.mlTensorData;
        }
        async getData(t) {
          switch (this.ensureValid(), this.dataLocation) {
            case "cpu":
            case "cpu-pinned":
              return this.data;
            case "texture":
            case "gpu-buffer":
            case "ml-tensor": {
              if (!this.downloader) throw new Error("The current tensor is not created with a specified data downloader.");
              if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
              try {
                this.isDownloading = true;
                let n = await this.downloader();
                return this.downloader = void 0, this.dataLocation = "cpu", this.cpuData = n, t && this.disposer && (this.disposer(), this.disposer = void 0), n;
              } finally {
                this.isDownloading = false;
              }
            }
            default:
              throw new Error(`cannot get data from location: ${this.dataLocation}`);
          }
        }
        dispose() {
          if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
          this.disposer && (this.disposer(), this.disposer = void 0), this.cpuData = void 0, this.gpuTextureData = void 0, this.gpuBufferData = void 0, this.mlTensorData = void 0, this.downloader = void 0, this.isDownloading = void 0, this.dataLocation = "none";
        }
        ensureValid() {
          if (this.dataLocation === "none") throw new Error("The tensor is disposed.");
        }
        reshape(t) {
          if (this.ensureValid(), this.downloader || this.disposer) throw new Error("Cannot reshape a tensor that owns GPU resource.");
          return Mt(this, t);
        }
      };
    });
    Ke = E(() => {
      "use strict";
      Te();
      G = v;
    });
    Qe = E(() => {
      "use strict";
      Ze();
      Nt = (e, t) => {
        (typeof D.trace > "u" ? !D.wasm.trace : !D.trace) || console.timeStamp(`${e}::ORT::${t}`);
      }, Ft = (e, t) => {
        let n = new Error().stack?.split(/\r\n|\r|\n/g) || [], o = false;
        for (let r = 0; r < n.length; r++) {
          if (o && !n[r].includes("TRACE_FUNC")) {
            let i = `FUNC_${e}::${n[r].trim().split(" ")[1]}`;
            t && (i += `::${t}`), Nt("CPU", i);
            return;
          }
          n[r].includes("TRACE_FUNC") && (o = true);
        }
      }, Z = (e) => {
        (typeof D.trace > "u" ? !D.wasm.trace : !D.trace) || Ft("BEGIN", e);
      }, X = (e) => {
        (typeof D.trace > "u" ? !D.wasm.trace : !D.trace) || Ft("END", e);
      }, K = (e) => {
        (typeof D.trace > "u" ? !D.wasm.trace : !D.trace) || console.time(`ORT::${e}`);
      }, Q = (e) => {
        (typeof D.trace > "u" ? !D.wasm.trace : !D.trace) || console.timeEnd(`ORT::${e}`);
      };
    });
    kt = E(() => {
      "use strict";
      Ye();
      Ke();
      Qe();
      Ie = class e {
        constructor(t) {
          this.handler = t;
        }
        async run(t, n, o) {
          Z(), K("InferenceSession.run");
          let r = {}, i = {};
          if (typeof t != "object" || t === null || t instanceof G || Array.isArray(t)) throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
          let s = true;
          if (typeof n == "object") {
            if (n === null) throw new TypeError("Unexpected argument[1]: cannot be null.");
            if (n instanceof G) throw new TypeError("'fetches' cannot be a Tensor");
            if (Array.isArray(n)) {
              if (n.length === 0) throw new TypeError("'fetches' cannot be an empty array.");
              s = false;
              for (let f of n) {
                if (typeof f != "string") throw new TypeError("'fetches' must be a string array or an object.");
                if (this.outputNames.indexOf(f) === -1) throw new RangeError(`'fetches' contains invalid output name: ${f}.`);
                r[f] = null;
              }
              if (typeof o == "object" && o !== null) i = o;
              else if (typeof o < "u") throw new TypeError("'options' must be an object.");
            } else {
              let f = false, l = Object.getOwnPropertyNames(n);
              for (let c of this.outputNames) if (l.indexOf(c) !== -1) {
                let d = n[c];
                (d === null || d instanceof G) && (f = true, s = false, r[c] = d);
              }
              if (f) {
                if (typeof o == "object" && o !== null) i = o;
                else if (typeof o < "u") throw new TypeError("'options' must be an object.");
              } else i = n;
            }
          } else if (typeof n < "u") throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
          for (let f of this.inputNames) if (typeof t[f] > "u") throw new Error(`input '${f}' is missing in 'feeds'.`);
          if (s) for (let f of this.outputNames) r[f] = null;
          let a = await this.handler.run(t, r, i), u = {};
          for (let f in a) if (Object.hasOwnProperty.call(a, f)) {
            let l = a[f];
            l instanceof G ? u[f] = l : u[f] = new G(l.type, l.data, l.dims);
          }
          return Q("InferenceSession.run"), X(), u;
        }
        async release() {
          return this.handler.dispose();
        }
        static async create(t, n, o, r) {
          Z(), K("InferenceSession.create");
          let i, s = {};
          if (typeof t == "string") {
            if (i = t, typeof n == "object" && n !== null) s = n;
            else if (typeof n < "u") throw new TypeError("'options' must be an object.");
          } else if (t instanceof Uint8Array) {
            if (i = t, typeof n == "object" && n !== null) s = n;
            else if (typeof n < "u") throw new TypeError("'options' must be an object.");
          } else if (t instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && t instanceof SharedArrayBuffer) {
            let l = t, c = 0, d = t.byteLength;
            if (typeof n == "object" && n !== null) s = n;
            else if (typeof n == "number") {
              if (c = n, !Number.isSafeInteger(c)) throw new RangeError("'byteOffset' must be an integer.");
              if (c < 0 || c >= l.byteLength) throw new RangeError(`'byteOffset' is out of range [0, ${l.byteLength}).`);
              if (d = t.byteLength - c, typeof o == "number") {
                if (d = o, !Number.isSafeInteger(d)) throw new RangeError("'byteLength' must be an integer.");
                if (d <= 0 || c + d > l.byteLength) throw new RangeError(`'byteLength' is out of range (0, ${l.byteLength - c}].`);
                if (typeof r == "object" && r !== null) s = r;
                else if (typeof r < "u") throw new TypeError("'options' must be an object.");
              } else if (typeof o < "u") throw new TypeError("'byteLength' must be a number.");
            } else if (typeof n < "u") throw new TypeError("'options' must be an object.");
            i = new Uint8Array(l, c, d);
          } else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
          let [a, u] = await ht(s), f = await a.createInferenceSessionHandler(i, u);
          return Q("InferenceSession.create"), X(), new e(f);
        }
        startProfiling() {
          this.handler.startProfiling();
        }
        endProfiling() {
          this.handler.endProfiling();
        }
        get inputNames() {
          return this.handler.inputNames;
        }
        get outputNames() {
          return this.handler.outputNames;
        }
        get inputMetadata() {
          return this.handler.inputMetadata;
        }
        get outputMetadata() {
          return this.handler.outputMetadata;
        }
      };
    });
    Wt = E(() => {
      "use strict";
      kt();
      Un = Ie;
    });
    Gt = E(() => {
      "use strict";
    });
    $t = E(() => {
      "use strict";
    });
    zt = E(() => {
      "use strict";
    });
    Ht = E(() => {
      "use strict";
    });
    et = {};
    qe(et, { InferenceSession: () => Un, TRACE: () => Nt, TRACE_EVENT_BEGIN: () => K, TRACE_EVENT_END: () => Q, TRACE_FUNC_BEGIN: () => Z, TRACE_FUNC_END: () => X, Tensor: () => G, env: () => B, registerBackend: () => pe });
    J = E(() => {
      "use strict";
      bt();
      St();
      Wt();
      Ke();
      Gt();
      $t();
      Qe();
      zt();
      Ht();
    });
    Ae = E(() => {
      "use strict";
    });
    qt = {};
    qe(qt, { default: () => xn });
    Yt = E(() => {
      "use strict";
      tt();
      ee();
      Be();
      Vt = "ort-wasm-proxy-worker", Jt = globalThis.self?.name === Vt;
      Jt && (self.onmessage = (e) => {
        let { type: t, in: n } = e.data;
        try {
          switch (t) {
            case "init-wasm":
              Oe(n.wasm).then(() => {
                Le(n).then(() => {
                  postMessage({ type: t });
                }, (o) => {
                  postMessage({ type: t, err: o });
                });
              }, (o) => {
                postMessage({ type: t, err: o });
              });
              break;
            case "init-ep": {
              let { epName: o, env: r } = n;
              Pe(r, o).then(() => {
                postMessage({ type: t });
              }, (i) => {
                postMessage({ type: t, err: i });
              });
              break;
            }
            case "copy-from": {
              let { buffer: o } = n, r = we(o);
              postMessage({ type: t, out: r });
              break;
            }
            case "create": {
              let { model: o, options: r } = n;
              De(o, r).then((i) => {
                postMessage({ type: t, out: i });
              }, (i) => {
                postMessage({ type: t, err: i });
              });
              break;
            }
            case "release":
              _e(n), postMessage({ type: t });
              break;
            case "run": {
              let { sessionId: o, inputIndices: r, inputs: i, outputIndices: s, options: a } = n;
              Ue(o, r, i, s, new Array(s.length).fill(null), a).then((u) => {
                u.some((f) => f[3] !== "cpu") ? postMessage({ type: t, err: "Proxy does not support non-cpu tensor location." }) : postMessage({ type: t, out: u }, ve([...i, ...u]));
              }, (u) => {
                postMessage({ type: t, err: u });
              });
              break;
            }
            case "end-profiling":
              xe(n), postMessage({ type: t });
              break;
            default:
          }
        } catch (o) {
          postMessage({ type: t, err: o });
        }
      });
      xn = Jt ? null : (e) => new Worker(e ?? R, { type: "module", name: Vt });
    });
    Be = E(() => {
      "use strict";
      Ae();
      Kt = typeof location > "u" ? void 0 : location.origin, vn = import.meta.url > "file:" && import.meta.url < "file;", Cn = () => {
        if (true) {
          if (vn) {
            let e = URL;
            return new URL(new e("ort.wasm.min.mjs", import.meta.url).href, Kt).href;
          }
          return import.meta.url;
        }
      }, R = Cn(), Ce = () => {
        if (R && !R.startsWith("blob:")) return R.substring(0, R.lastIndexOf("/") + 1);
      }, nt = (e, t) => {
        try {
          let n = t ?? R;
          return (n ? new URL(e, n) : new URL(e)).origin === Kt;
        } catch {
          return false;
        }
      }, Mn = (e, t) => {
        let n = t ?? R;
        try {
          return (n ? new URL(e, n) : new URL(e)).href;
        } catch {
          return;
        }
      }, Rn = (e, t) => `${t ?? "./"}${e}`, Qt = async (e) => {
        let n = await (await fetch(e, { credentials: "same-origin" })).blob();
        return URL.createObjectURL(n);
      }, Nn = async (e) => (await import(
        /*webpackIgnore:true*/
        /*@vite-ignore*/
        e
      )).default, Zt = (Yt(), wt(qt)).default, en = async () => {
        if (!R) throw new Error("Failed to load proxy worker: cannot determine the script source URL.");
        if (nt(R)) return [void 0, Zt()];
        let e = await Qt(R);
        return [e, Zt(e)];
      }, Xt = void 0, tn = async (e, t, n, o) => {
        let r = Xt && !(e || t);
        if (r) if (R) r = nt(R) || o && !n;
        else if (o && !n) r = true;
        else throw new Error("cannot determine the script source URL.");
        if (r) return [void 0, Xt];
        {
          let i = "ort-wasm-simd-threaded.mjs", s = e ?? Mn(i, t), a = n && s && !nt(s, t), u = a ? await Qt(s) : s ?? Rn(i, t);
          return [a ? u : void 0, await Nn(u)];
        }
      };
    });
    ee = E(() => {
      "use strict";
      Be();
      ot = false, Me = false, nn = false, Fn = () => {
        if (typeof SharedArrayBuffer > "u") return false;
        try {
          return typeof MessageChannel < "u" && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11]));
        } catch {
          return false;
        }
      }, kn = () => {
        try {
          return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0, 65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 186, 1, 26, 11]));
        } catch {
          return false;
        }
      }, Wn = () => {
        try {
          return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 19, 1, 17, 0, 65, 1, 253, 15, 65, 2, 253, 15, 65, 3, 253, 15, 253, 147, 2, 11]));
        } catch {
          return false;
        }
      }, Oe = async (e) => {
        if (ot) return Promise.resolve();
        if (Me) throw new Error("multiple calls to 'initializeWebAssembly()' detected.");
        if (nn) throw new Error("previous call to 'initializeWebAssembly()' failed.");
        Me = true;
        let t = e.initTimeout, n = e.numThreads;
        if (e.simd !== false) {
          if (e.simd === "relaxed") {
            if (!Wn()) throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.");
          } else if (!kn()) throw new Error("WebAssembly SIMD is not supported in the current environment.");
        }
        let o = Fn();
        n > 1 && !o && (typeof self < "u" && !self.crossOriginIsolated && console.warn("env.wasm.numThreads is set to " + n + ", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."), console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."), e.numThreads = n = 1);
        let r = e.wasmPaths, i = typeof r == "string" ? r : void 0, s = r?.mjs, a = s?.href ?? s, u = r?.wasm, f = u?.href ?? u, l = e.wasmBinary, [c, d] = await tn(a, i, n > 1, !!l || !!f), p = false, h = [];
        if (t > 0 && h.push(new Promise((b) => {
          setTimeout(() => {
            p = true, b();
          }, t);
        })), h.push(new Promise((b, A) => {
          let m = { numThreads: n };
          if (l) m.wasmBinary = l, m.locateFile = (w) => w;
          else if (f || i) m.locateFile = (w) => f ?? i + w;
          else if (a && a.indexOf("blob:") !== 0) m.locateFile = (w) => new URL(w, a).href;
          else if (c) {
            let w = Ce();
            w && (m.locateFile = (O) => w + O);
          }
          d(m).then((w) => {
            Me = false, ot = true, rt = w, b(), c && URL.revokeObjectURL(c);
          }, (w) => {
            Me = false, nn = true, A(w);
          });
        })), await Promise.race(h), p) throw new Error(`WebAssembly backend initializing failed due to timeout: ${t}ms`);
      }, I = () => {
        if (ot && rt) return rt;
        throw new Error("WebAssembly is not initialized yet.");
      };
    });
    Re = E(() => {
      "use strict";
      ee();
      N = (e, t) => {
        let n = I(), o = n.lengthBytesUTF8(e) + 1, r = n._malloc(o);
        return n.stringToUTF8(e, r, o), t.push(r), r;
      }, he = (e, t, n, o) => {
        if (typeof e == "object" && e !== null) {
          if (n.has(e)) throw new Error("Circular reference in options");
          n.add(e);
        }
        Object.entries(e).forEach(([r, i]) => {
          let s = t ? t + r : r;
          if (typeof i == "object") he(i, s + ".", n, o);
          else if (typeof i == "string" || typeof i == "number") o(s, i.toString());
          else if (typeof i == "boolean") o(s, i ? "1" : "0");
          else throw new Error(`Can't handle extra config type: ${typeof i}`);
        });
      }, S = (e) => {
        let t = I(), n = t.stackSave();
        try {
          let o = t.PTR_SIZE, r = t.stackAlloc(2 * o);
          t._OrtGetLastError(r, r + o);
          let i = Number(t.getValue(r, o === 4 ? "i32" : "i64")), s = t.getValue(r + o, "*"), a = s ? t.UTF8ToString(s) : "";
          throw new Error(`${e} ERROR_CODE: ${i}, ERROR_MESSAGE: ${a}`);
        } finally {
          t.stackRestore(n);
        }
      };
    });
    on = E(() => {
      "use strict";
      ee();
      Re();
      rn = (e) => {
        let t = I(), n = 0, o = [], r = e || {};
        try {
          if (e?.logSeverityLevel === void 0) r.logSeverityLevel = 2;
          else if (typeof e.logSeverityLevel != "number" || !Number.isInteger(e.logSeverityLevel) || e.logSeverityLevel < 0 || e.logSeverityLevel > 4) throw new Error(`log severity level is not valid: ${e.logSeverityLevel}`);
          if (e?.logVerbosityLevel === void 0) r.logVerbosityLevel = 0;
          else if (typeof e.logVerbosityLevel != "number" || !Number.isInteger(e.logVerbosityLevel)) throw new Error(`log verbosity level is not valid: ${e.logVerbosityLevel}`);
          e?.terminate === void 0 && (r.terminate = false);
          let i = 0;
          return e?.tag !== void 0 && (i = N(e.tag, o)), n = t._OrtCreateRunOptions(r.logSeverityLevel, r.logVerbosityLevel, !!r.terminate, i), n === 0 && S("Can't create run options."), e?.extra !== void 0 && he(e.extra, "", /* @__PURE__ */ new WeakSet(), (s, a) => {
            let u = N(s, o), f = N(a, o);
            t._OrtAddRunConfigEntry(n, u, f) !== 0 && S(`Can't set a run config entry: ${s} - ${a}.`);
          }), [n, o];
        } catch (i) {
          throw n !== 0 && t._OrtReleaseRunOptions(n), o.forEach((s) => t._free(s)), i;
        }
      };
    });
    an = E(() => {
      "use strict";
      ee();
      Re();
      Gn = (e) => {
        switch (e) {
          case "disabled":
            return 0;
          case "basic":
            return 1;
          case "extended":
            return 2;
          case "layout":
            return 3;
          case "all":
            return 99;
          default:
            throw new Error(`unsupported graph optimization level: ${e}`);
        }
      }, $n = (e) => {
        switch (e) {
          case "sequential":
            return 0;
          case "parallel":
            return 1;
          default:
            throw new Error(`unsupported execution mode: ${e}`);
        }
      }, zn = (e) => {
        e.extra || (e.extra = {}), e.extra.session || (e.extra.session = {});
        let t = e.extra.session;
        t.use_ort_model_bytes_directly || (t.use_ort_model_bytes_directly = "1"), e.executionProviders && e.executionProviders.some((n) => (typeof n == "string" ? n : n.name) === "webgpu") && (e.enableMemPattern = false);
      }, se = (e, t, n, o) => {
        let r = N(t, o), i = N(n, o);
        I()._OrtAddSessionConfigEntry(e, r, i) !== 0 && S(`Can't set a session config entry: ${t} - ${n}.`);
      }, Hn = async (e, t, n) => {
        let o = t.executionProviders;
        for (let r of o) {
          let i = typeof r == "string" ? r : r.name, s = [];
          switch (i) {
            case "webnn":
              if (i = "WEBNN", se(e, "session.disable_quant_qdq", "1", n), se(e, "session.disable_qdq_constant_folding", "1", n), typeof r != "string") {
                let d = r?.deviceType;
                d && se(e, "deviceType", d, n);
              }
              break;
            case "webgpu":
              if (i = "JS", typeof r != "string") {
                let c = r;
                if (c?.preferredLayout) {
                  if (c.preferredLayout !== "NCHW" && c.preferredLayout !== "NHWC") throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${c.preferredLayout}`);
                  se(e, "preferredLayout", c.preferredLayout, n);
                }
              }
              break;
            case "wasm":
            case "cpu":
              continue;
            default:
              throw new Error(`not supported execution provider: ${i}`);
          }
          let a = N(i, n), u = s.length, f = 0, l = 0;
          if (u > 0) {
            f = I()._malloc(u * I().PTR_SIZE), n.push(f), l = I()._malloc(u * I().PTR_SIZE), n.push(l);
            for (let c = 0; c < u; c++) I().setValue(f + c * I().PTR_SIZE, s[c][0], "*"), I().setValue(l + c * I().PTR_SIZE, s[c][1], "*");
          }
          await I()._OrtAppendExecutionProvider(e, a, f, l, u) !== 0 && S(`Can't append execution provider: ${i}.`);
        }
      }, sn = async (e) => {
        let t = I(), n = 0, o = [], r = e || {};
        zn(r);
        try {
          let i = Gn(r.graphOptimizationLevel ?? "all"), s = $n(r.executionMode ?? "sequential"), a = typeof r.logId == "string" ? N(r.logId, o) : 0, u = r.logSeverityLevel ?? 2;
          if (!Number.isInteger(u) || u < 0 || u > 4) throw new Error(`log severity level is not valid: ${u}`);
          let f = r.logVerbosityLevel ?? 0;
          if (!Number.isInteger(f) || f < 0 || f > 4) throw new Error(`log verbosity level is not valid: ${f}`);
          let l = typeof r.optimizedModelFilePath == "string" ? N(r.optimizedModelFilePath, o) : 0;
          if (n = t._OrtCreateSessionOptions(i, !!r.enableCpuMemArena, !!r.enableMemPattern, s, !!r.enableProfiling, 0, a, u, f, l), n === 0 && S("Can't create session options."), r.executionProviders && await Hn(n, r, o), r.enableGraphCapture !== void 0) {
            if (typeof r.enableGraphCapture != "boolean") throw new Error(`enableGraphCapture must be a boolean value: ${r.enableGraphCapture}`);
            se(n, "enableGraphCapture", r.enableGraphCapture.toString(), o);
          }
          if (r.freeDimensionOverrides) for (let [c, d] of Object.entries(r.freeDimensionOverrides)) {
            if (typeof c != "string") throw new Error(`free dimension override name must be a string: ${c}`);
            if (typeof d != "number" || !Number.isInteger(d) || d < 0) throw new Error(`free dimension override value must be a non-negative integer: ${d}`);
            let p = N(c, o);
            t._OrtAddFreeDimensionOverride(n, p, d) !== 0 && S(`Can't set a free dimension override: ${c} - ${d}.`);
          }
          return r.extra !== void 0 && he(r.extra, "", /* @__PURE__ */ new WeakSet(), (c, d) => {
            se(n, c, d, o);
          }), [n, o];
        } catch (i) {
          throw n !== 0 && t._OrtReleaseSessionOptions(n) !== 0 && S("Can't release session options."), o.forEach((s) => t._free(s)), i;
        }
      };
    });
    st = E(() => {
      "use strict";
      ie = (e) => {
        switch (e) {
          case "int8":
            return 3;
          case "uint8":
            return 2;
          case "bool":
            return 9;
          case "int16":
            return 5;
          case "uint16":
            return 4;
          case "int32":
            return 6;
          case "uint32":
            return 12;
          case "float16":
            return 10;
          case "float32":
            return 1;
          case "float64":
            return 11;
          case "string":
            return 8;
          case "int64":
            return 7;
          case "uint64":
            return 13;
          case "int4":
            return 22;
          case "uint4":
            return 21;
          default:
            throw new Error(`unsupported data type: ${e}`);
        }
      }, Ne = (e) => {
        switch (e) {
          case 3:
            return "int8";
          case 2:
            return "uint8";
          case 9:
            return "bool";
          case 5:
            return "int16";
          case 4:
            return "uint16";
          case 6:
            return "int32";
          case 12:
            return "uint32";
          case 10:
            return "float16";
          case 1:
            return "float32";
          case 11:
            return "float64";
          case 8:
            return "string";
          case 7:
            return "int64";
          case 13:
            return "uint64";
          case 22:
            return "int4";
          case 21:
            return "uint4";
          default:
            throw new Error(`unsupported data type: ${e}`);
        }
      }, ae = (e, t) => {
        let n = [-1, 4, 1, 1, 2, 2, 4, 8, -1, 1, 2, 8, 4, 8, -1, -1, -1, -1, -1, -1, -1, 0.5, 0.5][e], o = typeof t == "number" ? t : t.reduce((r, i) => r * i, 1);
        return n > 0 ? Math.ceil(o * n) : void 0;
      }, un = (e) => {
        switch (e) {
          case "float16":
            return typeof Float16Array < "u" ? Float16Array : Uint16Array;
          case "float32":
            return Float32Array;
          case "uint8":
            return Uint8Array;
          case "int8":
            return Int8Array;
          case "uint16":
            return Uint16Array;
          case "int16":
            return Int16Array;
          case "int32":
            return Int32Array;
          case "bool":
            return Uint8Array;
          case "float64":
            return Float64Array;
          case "uint32":
            return Uint32Array;
          case "int64":
            return BigInt64Array;
          case "uint64":
            return BigUint64Array;
          default:
            throw new Error(`unsupported type: ${e}`);
        }
      }, fn = (e) => {
        switch (e) {
          case "verbose":
            return 0;
          case "info":
            return 1;
          case "warning":
            return 2;
          case "error":
            return 3;
          case "fatal":
            return 4;
          default:
            throw new Error(`unsupported logging level: ${e}`);
        }
      }, Fe = (e) => e === "float32" || e === "float16" || e === "int32" || e === "int64" || e === "uint32" || e === "uint8" || e === "bool" || e === "uint4" || e === "int4", ke = (e) => e === "float32" || e === "float16" || e === "int32" || e === "int64" || e === "uint32" || e === "uint64" || e === "int8" || e === "uint8" || e === "bool" || e === "uint4" || e === "int4", cn = (e) => {
        switch (e) {
          case "none":
            return 0;
          case "cpu":
            return 1;
          case "cpu-pinned":
            return 2;
          case "texture":
            return 3;
          case "gpu-buffer":
            return 4;
          case "ml-tensor":
            return 5;
          default:
            throw new Error(`unsupported data location: ${e}`);
        }
      };
    });
    it = E(() => {
      "use strict";
      Ae();
      be = async (e) => {
        if (typeof e == "string") if (false) try {
          let { readFile: t } = Je("node:fs/promises");
          return new Uint8Array(await t(e));
        } catch (t) {
          if (t.code === "ERR_FS_FILE_TOO_LARGE") {
            let { createReadStream: n } = Je("node:fs"), o = n(e), r = [];
            for await (let i of o) r.push(i);
            return new Uint8Array(Buffer.concat(r));
          }
          throw t;
        }
        else {
          let t = await fetch(e);
          if (!t.ok) throw new Error(`failed to load external data file: ${e}`);
          let n = t.headers.get("Content-Length"), o = n ? parseInt(n, 10) : 0;
          if (o < 1073741824) return new Uint8Array(await t.arrayBuffer());
          {
            if (!t.body) throw new Error(`failed to load external data file: ${e}, no response body.`);
            let r = t.body.getReader(), i;
            try {
              i = new ArrayBuffer(o);
            } catch (a) {
              if (a instanceof RangeError) {
                let u = Math.ceil(o / 65536);
                i = new WebAssembly.Memory({ initial: u, maximum: u }).buffer;
              } else throw a;
            }
            let s = 0;
            for (; ; ) {
              let { done: a, value: u } = await r.read();
              if (a) break;
              let f = u.byteLength;
              new Uint8Array(i, s, f).set(u), s += f;
            }
            return new Uint8Array(i, 0, o);
          }
        }
        else return e instanceof Blob ? new Uint8Array(await e.arrayBuffer()) : e instanceof Uint8Array ? e : new Uint8Array(e);
      };
    });
    tt = E(() => {
      "use strict";
      J();
      on();
      an();
      st();
      ee();
      Re();
      it();
      jn = (e, t) => {
        I()._OrtInit(e, t) !== 0 && S("Can't initialize onnxruntime.");
      }, Le = async (e) => {
        jn(e.wasm.numThreads, fn(e.logLevel));
      }, Pe = async (e, t) => {
        I().asyncInit?.();
        let n = e.webgpu.adapter;
        if (t === "webgpu") {
          if (typeof navigator > "u" || !navigator.gpu) throw new Error("WebGPU is not supported in current environment");
          if (n) {
            if (typeof n.limits != "object" || typeof n.features != "object" || typeof n.requestDevice != "function") throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.");
          } else {
            let o = e.webgpu.powerPreference;
            if (o !== void 0 && o !== "low-power" && o !== "high-performance") throw new Error(`Invalid powerPreference setting: "${o}"`);
            let r = e.webgpu.forceFallbackAdapter;
            if (r !== void 0 && typeof r != "boolean") throw new Error(`Invalid forceFallbackAdapter setting: "${r}"`);
            if (n = await navigator.gpu.requestAdapter({ powerPreference: o, forceFallbackAdapter: r }), !n) throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.');
          }
        }
        if (t === "webnn" && (typeof navigator > "u" || !navigator.ml)) throw new Error("WebNN is not supported in current environment");
      }, ue = /* @__PURE__ */ new Map(), Vn = (e) => {
        let t = I(), n = t.stackSave();
        try {
          let o = t.PTR_SIZE, r = t.stackAlloc(2 * o);
          t._OrtGetInputOutputCount(e, r, r + o) !== 0 && S("Can't get session input/output count.");
          let s = o === 4 ? "i32" : "i64";
          return [Number(t.getValue(r, s)), Number(t.getValue(r + o, s))];
        } finally {
          t.stackRestore(n);
        }
      }, dn = (e, t) => {
        let n = I(), o = n.stackSave(), r = 0;
        try {
          let i = n.PTR_SIZE, s = n.stackAlloc(2 * i);
          n._OrtGetInputOutputMetadata(e, t, s, s + i) !== 0 && S("Can't get session input/output metadata.");
          let u = Number(n.getValue(s, "*"));
          r = Number(n.getValue(s + i, "*"));
          let f = n.HEAP32[r / 4];
          if (f === 0) return [u, 0];
          let l = n.HEAPU32[r / 4 + 1], c = [];
          for (let d = 0; d < l; d++) {
            let p = Number(n.getValue(r + 8 + d * i, "*"));
            c.push(p !== 0 ? n.UTF8ToString(p) : Number(n.getValue(r + 8 + (d + l) * i, "*")));
          }
          return [u, f, c];
        } finally {
          n.stackRestore(o), r !== 0 && n._OrtFree(r);
        }
      }, we = (e) => {
        let t = I(), n = t._malloc(e.byteLength);
        if (n === 0) throw new Error(`Can't create a session. failed to allocate a buffer of size ${e.byteLength}.`);
        return t.HEAPU8.set(e, n), [n, e.byteLength];
      }, De = async (e, t) => {
        let n, o, r = I();
        Array.isArray(e) ? [n, o] = e : e.buffer === r.HEAPU8.buffer ? [n, o] = [e.byteOffset, e.byteLength] : [n, o] = we(e);
        let i = 0, s = 0, a = 0, u = [], f = [], l = [];
        try {
          if ([s, u] = await sn(t), t?.externalData && r.mountExternalData) {
            let g = [];
            for (let T of t.externalData) {
              let x = typeof T == "string" ? T : T.path, M = typeof T == "string" ? T : T.data;
              g.push(be(M).then((_) => {
                r.mountExternalData(x, _);
              }));
            }
            await Promise.all(g);
          }
          for (let g of t?.executionProviders ?? []) if ((typeof g == "string" ? g : g.name) === "webnn") {
            if (r.shouldTransferToMLTensor = false, typeof g != "string") {
              let x = g, M = x?.context, _ = x?.gpuDevice, de = x?.deviceType, re = x?.powerPreference;
              M ? r.currentContext = M : _ ? r.currentContext = await r.webnnCreateMLContext(_) : r.currentContext = await r.webnnCreateMLContext({ deviceType: de, powerPreference: re });
            } else r.currentContext = await r.webnnCreateMLContext();
            break;
          }
          i = await r._OrtCreateSession(n, o, s), r.webgpuOnCreateSession?.(i), i === 0 && S("Can't create a session."), r.jsepOnCreateSession?.(), r.currentContext && (r.webnnRegisterMLContext(i, r.currentContext), r.currentContext = void 0, r.shouldTransferToMLTensor = true);
          let [c, d] = Vn(i), p = !!t?.enableGraphCapture, h = [], b = [], A = [], m = [], w = [];
          for (let g = 0; g < c; g++) {
            let [T, x, M] = dn(i, g);
            T === 0 && S("Can't get an input name."), f.push(T);
            let _ = r.UTF8ToString(T);
            h.push(_), A.push(x === 0 ? { name: _, isTensor: false } : { name: _, isTensor: true, type: Ne(x), shape: M });
          }
          for (let g = 0; g < d; g++) {
            let [T, x, M] = dn(i, g + c);
            T === 0 && S("Can't get an output name."), l.push(T);
            let _ = r.UTF8ToString(T);
            b.push(_), m.push(x === 0 ? { name: _, isTensor: false } : { name: _, isTensor: true, type: Ne(x), shape: M });
          }
          return ue.set(i, [i, f, l, null, p, false]), [i, h, b, A, m];
        } catch (c) {
          throw f.forEach((d) => r._OrtFree(d)), l.forEach((d) => r._OrtFree(d)), a !== 0 && r._OrtReleaseBinding(a) !== 0 && S("Can't release IO binding."), i !== 0 && r._OrtReleaseSession(i) !== 0 && S("Can't release session."), c;
        } finally {
          r._free(n), s !== 0 && r._OrtReleaseSessionOptions(s) !== 0 && S("Can't release session options."), u.forEach((c) => r._free(c)), r.unmountExternalData?.();
        }
      }, _e = (e) => {
        let t = I(), n = ue.get(e);
        if (!n) throw new Error(`cannot release session. invalid session id: ${e}`);
        let [o, r, i, s, a] = n;
        s && (a && t._OrtClearBoundOutputs(s.handle) !== 0 && S("Can't clear bound outputs."), t._OrtReleaseBinding(s.handle) !== 0 && S("Can't release IO binding.")), t.jsepOnReleaseSession?.(e), t.webnnOnReleaseSession?.(e), t.webgpuOnReleaseSession?.(e), r.forEach((u) => t._OrtFree(u)), i.forEach((u) => t._OrtFree(u)), t._OrtReleaseSession(o) !== 0 && S("Can't release session."), ue.delete(e);
      }, ln = async (e, t, n, o, r, i, s = false) => {
        if (!e) {
          t.push(0);
          return;
        }
        let a = I(), u = a.PTR_SIZE, f = e[0], l = e[1], c = e[3], d = c, p, h;
        if (f === "string" && (c === "gpu-buffer" || c === "ml-tensor")) throw new Error("String tensor is not supported on GPU.");
        if (s && c !== "gpu-buffer") throw new Error(`External buffer must be provided for input/output index ${i} when enableGraphCapture is true.`);
        if (c === "gpu-buffer") {
          let m = e[2].gpuBuffer;
          h = ae(ie(f), l);
          {
            let w = a.jsepRegisterBuffer;
            if (!w) throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');
            p = w(o, i, m, h);
          }
        } else if (c === "ml-tensor") {
          let m = e[2].mlTensor;
          h = ae(ie(f), l);
          let w = a.webnnRegisterMLTensor;
          if (!w) throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');
          p = w(o, m, ie(f), l);
        } else {
          let m = e[2];
          if (Array.isArray(m)) {
            h = u * m.length, p = a._malloc(h), n.push(p);
            for (let w = 0; w < m.length; w++) {
              if (typeof m[w] != "string") throw new TypeError(`tensor data at index ${w} is not a string`);
              a.setValue(p + w * u, N(m[w], n), "*");
            }
          } else {
            let w = a.webnnIsGraphInput, O = a.webnnIsGraphOutput;
            if (f !== "string" && w && O) {
              let g = a.UTF8ToString(r);
              if (w(o, g) || O(o, g)) {
                let T = ie(f);
                h = ae(T, l), d = "ml-tensor";
                let x = a.webnnCreateTemporaryTensor, M = a.webnnUploadTensor;
                if (!x || !M) throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');
                let _ = await x(o, T, l);
                M(_, new Uint8Array(m.buffer, m.byteOffset, m.byteLength)), p = _;
              } else h = m.byteLength, p = a._malloc(h), n.push(p), a.HEAPU8.set(new Uint8Array(m.buffer, m.byteOffset, h), p);
            } else h = m.byteLength, p = a._malloc(h), n.push(p), a.HEAPU8.set(new Uint8Array(m.buffer, m.byteOffset, h), p);
          }
        }
        let b = a.stackSave(), A = a.stackAlloc(4 * l.length);
        try {
          l.forEach((w, O) => a.setValue(A + O * u, w, u === 4 ? "i32" : "i64"));
          let m = a._OrtCreateTensor(ie(f), p, h, A, l.length, cn(d));
          m === 0 && S(`Can't create tensor for input/output. session=${o}, index=${i}.`), t.push(m);
        } finally {
          a.stackRestore(b);
        }
      }, Ue = async (e, t, n, o, r, i) => {
        let s = I(), a = s.PTR_SIZE, u = ue.get(e);
        if (!u) throw new Error(`cannot run inference. invalid session id: ${e}`);
        let f = u[0], l = u[1], c = u[2], d = u[3], p = u[4], h = u[5], b = t.length, A = o.length, m = 0, w = [], O = [], g = [], T = [], x = [], M = s.stackSave(), _ = s.stackAlloc(b * a), de = s.stackAlloc(b * a), re = s.stackAlloc(A * a), ct = s.stackAlloc(A * a);
        try {
          [m, w] = rn(i), K("wasm prepareInputOutputTensor");
          for (let y = 0; y < b; y++) await ln(n[y], O, T, e, l[t[y]], t[y], p);
          for (let y = 0; y < A; y++) await ln(r[y], g, T, e, c[o[y]], b + o[y], p);
          Q("wasm prepareInputOutputTensor");
          for (let y = 0; y < b; y++) s.setValue(_ + y * a, O[y], "*"), s.setValue(de + y * a, l[t[y]], "*");
          for (let y = 0; y < A; y++) s.setValue(re + y * a, g[y], "*"), s.setValue(ct + y * a, c[o[y]], "*");
          s.jsepOnRunStart?.(f), s.webnnOnRunStart?.(f);
          let F;
          F = await s._OrtRun(f, de, _, b, ct, A, re, m), F !== 0 && S("failed to call OrtRun().");
          let z = [], dt = [];
          K("wasm ProcessOutputTensor");
          for (let y = 0; y < A; y++) {
            let W = Number(s.getValue(re + y * a, "*"));
            if (W === g[y] || x.includes(g[y])) {
              z.push(r[y]), W !== g[y] && s._OrtReleaseTensor(W) !== 0 && S("Can't release tensor.");
              continue;
            }
            let lt = s.stackSave(), $ = s.stackAlloc(4 * a), oe = false, P, C = 0;
            try {
              s._OrtGetTensorData(W, $, $ + a, $ + 2 * a, $ + 3 * a) !== 0 && S(`Can't access output tensor data on index ${y}.`);
              let je = a === 4 ? "i32" : "i64", ge = Number(s.getValue($, je));
              C = s.getValue($ + a, "*");
              let pt = s.getValue($ + a * 2, "*"), Bn = Number(s.getValue($ + a * 3, je)), H = [];
              for (let U = 0; U < Bn; U++) H.push(Number(s.getValue(pt + U * a, je)));
              s._OrtFree(pt) !== 0 && S("Can't free memory for tensor dims.");
              let j = H.reduce((U, L) => U * L, 1);
              P = Ne(ge);
              let le = d?.outputPreferredLocations[o[y]];
              if (P === "string") {
                if (le === "gpu-buffer" || le === "ml-tensor") throw new Error("String tensor is not supported on GPU.");
                let U = [];
                for (let L = 0; L < j; L++) {
                  let V = s.getValue(C + L * a, "*"), Ee = s.getValue(C + (L + 1) * a, "*"), mt = L === j - 1 ? void 0 : Ee - V;
                  U.push(s.UTF8ToString(V, mt));
                }
                z.push([P, H, U, "cpu"]);
              } else if (le === "gpu-buffer" && j > 0) {
                let U = s.jsepGetBuffer;
                if (!U) throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');
                let L = U(C), V = ae(ge, j);
                if (V === void 0 || !Fe(P)) throw new Error(`Unsupported data type: ${P}`);
                oe = true, z.push([P, H, { gpuBuffer: L, download: s.jsepCreateDownloader(L, V, P), dispose: () => {
                  s._OrtReleaseTensor(W) !== 0 && S("Can't release tensor.");
                } }, "gpu-buffer"]);
              } else if (le === "ml-tensor" && j > 0) {
                let U = s.webnnEnsureTensor, L = s.webnnIsGraphInputOutputTypeSupported;
                if (!U || !L) throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');
                if (ae(ge, j) === void 0 || !ke(P)) throw new Error(`Unsupported data type: ${P}`);
                if (!L(e, P, false)) throw new Error(`preferredLocation "ml-tensor" for ${P} output is not supported by current WebNN Context.`);
                let Ee = await U(e, C, ge, H, false);
                oe = true, z.push([P, H, { mlTensor: Ee, download: s.webnnCreateMLTensorDownloader(C, P), dispose: () => {
                  s.webnnReleaseTensorId(C), s._OrtReleaseTensor(W);
                } }, "ml-tensor"]);
              } else if (le === "ml-tensor-cpu-output" && j > 0) {
                let U = s.webnnCreateMLTensorDownloader(C, P)(), L = z.length;
                oe = true, dt.push((async () => {
                  let V = [L, await U];
                  return s.webnnReleaseTensorId(C), s._OrtReleaseTensor(W), V;
                })()), z.push([P, H, [], "cpu"]);
              } else {
                let U = un(P), L = new U(j);
                new Uint8Array(L.buffer, L.byteOffset, L.byteLength).set(s.HEAPU8.subarray(C, C + L.byteLength)), z.push([P, H, L, "cpu"]);
              }
            } finally {
              s.stackRestore(lt), P === "string" && C && s._free(C), oe || s._OrtReleaseTensor(W);
            }
          }
          d && !p && (s._OrtClearBoundOutputs(d.handle) !== 0 && S("Can't clear bound outputs."), ue.set(e, [f, l, c, d, p, false]));
          for (let [y, W] of await Promise.all(dt)) z[y][2] = W;
          return Q("wasm ProcessOutputTensor"), z;
        } finally {
          s.webnnOnRunEnd?.(f), s.stackRestore(M), O.forEach((F) => s._OrtReleaseTensor(F)), g.forEach((F) => s._OrtReleaseTensor(F)), T.forEach((F) => s._free(F)), m !== 0 && s._OrtReleaseRunOptions(m), w.forEach((F) => s._free(F));
        }
      }, xe = (e) => {
        let t = I(), n = ue.get(e);
        if (!n) throw new Error("invalid session id");
        let o = n[0], r = t._OrtEndProfiling(o);
        r === 0 && S("Can't get an profile file name."), t._OrtFree(r);
      }, ve = (e) => {
        let t = [];
        for (let n of e) {
          let o = n[2];
          !Array.isArray(o) && "buffer" in o && t.push(o.buffer);
        }
        return t;
      };
    });
    ft = E(() => {
      "use strict";
      J();
      tt();
      ee();
      Be();
      ne = () => !!B.wasm.proxy && typeof document < "u", ye = false, Ge = false, $e = false, ut = /* @__PURE__ */ new Map(), fe = (e, t) => {
        let n = ut.get(e);
        n ? n.push(t) : ut.set(e, [t]);
      }, ce = () => {
        if (ye || !Ge || $e || !k) throw new Error("worker not ready");
      }, qn = (e) => {
        switch (e.data.type) {
          case "init-wasm":
            ye = false, e.data.err ? ($e = true, at[1](e.data.err)) : (Ge = true, at[0]()), We && (URL.revokeObjectURL(We), We = void 0);
            break;
          case "init-ep":
          case "copy-from":
          case "create":
          case "release":
          case "run":
          case "end-profiling": {
            let t = ut.get(e.data.type);
            e.data.err ? t.shift()[1](e.data.err) : t.shift()[0](e.data.out);
            break;
          }
          default:
        }
      }, pn = async () => {
        if (!Ge) {
          if (ye) throw new Error("multiple calls to 'initWasm()' detected.");
          if ($e) throw new Error("previous call to 'initWasm()' failed.");
          if (ye = true, ne()) return new Promise((e, t) => {
            k?.terminate(), en().then(([n, o]) => {
              try {
                k = o, k.onerror = (i) => t(i), k.onmessage = qn, at = [e, t];
                let r = { type: "init-wasm", in: B };
                if (!r.in.wasm.wasmPaths && n) {
                  let i = Ce();
                  i && (r.in.wasm.wasmPaths = i);
                }
                k.postMessage(r), We = n;
              } catch (r) {
                t(r);
              }
            }, t);
          });
          try {
            await Oe(B.wasm), await Le(B), Ge = true;
          } catch (e) {
            throw $e = true, e;
          } finally {
            ye = false;
          }
        }
      }, mn = async (e) => {
        if (ne()) return ce(), new Promise((t, n) => {
          fe("init-ep", [t, n]);
          let o = { type: "init-ep", in: { epName: e, env: B } };
          k.postMessage(o);
        });
        await Pe(B, e);
      }, wn = async (e) => ne() ? (ce(), new Promise((t, n) => {
        fe("copy-from", [t, n]);
        let o = { type: "copy-from", in: { buffer: e } };
        k.postMessage(o, [e.buffer]);
      })) : we(e), hn = async (e, t) => {
        if (ne()) {
          if (t?.preferredOutputLocation) throw new Error('session option "preferredOutputLocation" is not supported for proxy.');
          return ce(), new Promise((n, o) => {
            fe("create", [n, o]);
            let r = { type: "create", in: { model: e, options: { ...t } } }, i = [];
            e instanceof Uint8Array && i.push(e.buffer), k.postMessage(r, i);
          });
        } else return De(e, t);
      }, bn = async (e) => {
        if (ne()) return ce(), new Promise((t, n) => {
          fe("release", [t, n]);
          let o = { type: "release", in: e };
          k.postMessage(o);
        });
        _e(e);
      }, yn = async (e, t, n, o, r, i) => {
        if (ne()) {
          if (n.some((s) => s[3] !== "cpu")) throw new Error("input tensor on GPU is not supported for proxy.");
          if (r.some((s) => s)) throw new Error("pre-allocated output tensor is not supported for proxy.");
          return ce(), new Promise((s, a) => {
            fe("run", [s, a]);
            let u = n, f = { type: "run", in: { sessionId: e, inputIndices: t, inputs: u, outputIndices: o, options: i } };
            k.postMessage(f, ve(u));
          });
        } else return Ue(e, t, n, o, r, i);
      }, gn = async (e) => {
        if (ne()) return ce(), new Promise((t, n) => {
          fe("end-profiling", [t, n]);
          let o = { type: "end-profiling", in: e };
          k.postMessage(o);
        });
        xe(e);
      };
    });
    Sn = E(() => {
      "use strict";
      J();
      ft();
      st();
      Ae();
      it();
      En = (e, t) => {
        switch (e.location) {
          case "cpu":
            return [e.type, e.dims, e.data, "cpu"];
          case "gpu-buffer":
            return [e.type, e.dims, { gpuBuffer: e.gpuBuffer }, "gpu-buffer"];
          case "ml-tensor":
            return [e.type, e.dims, { mlTensor: e.mlTensor }, "ml-tensor"];
          default:
            throw new Error(`invalid data location: ${e.location} for ${t()}`);
        }
      }, Yn = (e) => {
        switch (e[3]) {
          case "cpu":
            return new G(e[0], e[2], e[1]);
          case "gpu-buffer": {
            let t = e[0];
            if (!Fe(t)) throw new Error(`not supported data type: ${t} for deserializing GPU tensor`);
            let { gpuBuffer: n, download: o, dispose: r } = e[2];
            return G.fromGpuBuffer(n, { dataType: t, dims: e[1], download: o, dispose: r });
          }
          case "ml-tensor": {
            let t = e[0];
            if (!ke(t)) throw new Error(`not supported data type: ${t} for deserializing MLTensor tensor`);
            let { mlTensor: n, download: o, dispose: r } = e[2];
            return G.fromMLTensor(n, { dataType: t, dims: e[1], download: o, dispose: r });
          }
          default:
            throw new Error(`invalid data location: ${e[3]}`);
        }
      }, ze = class {
        async fetchModelAndCopyToWasmMemory(t) {
          return wn(await be(t));
        }
        async loadModel(t, n) {
          Z();
          let o;
          typeof t == "string" ? o = await this.fetchModelAndCopyToWasmMemory(t) : o = t, [this.sessionId, this.inputNames, this.outputNames, this.inputMetadata, this.outputMetadata] = await hn(o, n), X();
        }
        async dispose() {
          return bn(this.sessionId);
        }
        async run(t, n, o) {
          Z();
          let r = [], i = [];
          Object.entries(t).forEach((d) => {
            let p = d[0], h = d[1], b = this.inputNames.indexOf(p);
            if (b === -1) throw new Error(`invalid input '${p}'`);
            r.push(h), i.push(b);
          });
          let s = [], a = [];
          Object.entries(n).forEach((d) => {
            let p = d[0], h = d[1], b = this.outputNames.indexOf(p);
            if (b === -1) throw new Error(`invalid output '${p}'`);
            s.push(h), a.push(b);
          });
          let u = r.map((d, p) => En(d, () => `input "${this.inputNames[i[p]]}"`)), f = s.map((d, p) => d ? En(d, () => `output "${this.outputNames[a[p]]}"`) : null), l = await yn(this.sessionId, i, u, a, f, o), c = {};
          for (let d = 0; d < l.length; d++) c[this.outputNames[a[d]]] = s[d] ?? Yn(l[d]);
          return X(), c;
        }
        startProfiling() {
        }
        endProfiling() {
          gn(this.sessionId);
        }
      };
    });
    In = {};
    qe(In, { OnnxruntimeWebAssemblyBackend: () => He, initializeFlags: () => Tn, wasmBackend: () => Zn });
    An = E(() => {
      "use strict";
      J();
      ft();
      Sn();
      Tn = () => {
        (typeof B.wasm.initTimeout != "number" || B.wasm.initTimeout < 0) && (B.wasm.initTimeout = 0);
        let e = B.wasm.simd;
        if (typeof e != "boolean" && e !== void 0 && e !== "fixed" && e !== "relaxed" && (console.warn(`Property "env.wasm.simd" is set to unknown value "${e}". Reset it to \`false\` and ignore SIMD feature checking.`), B.wasm.simd = false), typeof B.wasm.proxy != "boolean" && (B.wasm.proxy = false), typeof B.wasm.trace != "boolean" && (B.wasm.trace = false), typeof B.wasm.numThreads != "number" || !Number.isInteger(B.wasm.numThreads) || B.wasm.numThreads <= 0) if (typeof self < "u" && !self.crossOriginIsolated) B.wasm.numThreads = 1;
        else {
          let t = typeof navigator > "u" ? Je("node:os").cpus().length : navigator.hardwareConcurrency;
          B.wasm.numThreads = Math.min(4, Math.ceil((t || 1) / 2));
        }
      }, He = class {
        async init(t) {
          Tn(), await pn(), await mn(t);
        }
        async createInferenceSessionHandler(t, n) {
          let o = new ze();
          return await o.loadModel(t, n), o;
        }
      }, Zn = new He();
    });
    J();
    J();
    J();
    jt = "1.30.0";
    Ro = et;
    {
      let e = (An(), wt(In)).wasmBackend;
      pe("cpu", e, 10), pe("wasm", e, 10);
    }
    Object.defineProperty(B.versions, "web", { value: jt, enumerable: true });
  }
});

// src/engine-worker.js
init_benchmark_policy();

// src/benchmark-quality.js
init_storage();
async function benchmarkQuality(outputs, references = []) {
  const rows = [];
  for (const o of outputs) {
    const f = await readFile(o.key, true), reference = references.find((r) => r.stem === o.stem), rf = reference ? await readFile(reference.key, true) : null;
    if (f.size !== 44 + o.frames * 4 || rf && rf.size !== f.size) throw Error("\u6BD4\u8F03WAV\u306E\u30B5\u30A4\u30BA/\u9577\u3055\u304C\u4E00\u81F4\u3057\u307E\u305B\u3093");
    const size = f.size - 44, n = size / 2;
    let sum = 0, sq = 0, peak = 0, clipping = 0, rsum = 0, rsq = 0, cross = 0, diffSq = 0, maxDiff = 0, exact = true;
    for (let p = 44; p < f.size; p += 65536) {
      const b = await f.slice(p, Math.min(f.size, p + 65536)).arrayBuffer(), v2 = new DataView(b), rb = rf && rf.size === f.size ? await rf.slice(p, Math.min(f.size, p + 65536)).arrayBuffer() : null, rv = rb ? new DataView(rb) : null;
      for (let j = 0; j < b.byteLength; j += 2) {
        const x = v2.getInt16(j, true) / 32768;
        sum += x;
        sq += x * x;
        peak = Math.max(peak, Math.abs(x));
        if (Math.abs(x) >= 32767 / 32768) clipping++;
        if (rv) {
          const y = rv.getInt16(j, true) / 32768;
          rsum += y;
          rsq += y * y;
          cross += x * y;
          diffSq += (x - y) ** 2;
          maxDiff = Math.max(maxDiff, Math.abs(x - y));
          if (x !== y) exact = false;
        }
      }
    }
    const comparable = !!rf && rf.size === f.size;
    rows.push({ stem: o.stem, duration: o.frames / o.rate, rate: o.rate, channels: 2, peak, rms: Math.sqrt(sq / n), clipping, NaN: 0, Inf: 0, finiteScope: "PCM16 output; inference and PCM encode also reject nonfinite floats", referenceAvailable: comparable, referenceRun: reference?.runId ?? null, bitExact: comparable ? exact : null, maxAbsoluteDifference: comparable ? maxDiff : null, differenceRMS: comparable ? Math.sqrt(diffSq / n) : null, correlation: comparable ? (cross - sum * rsum / n) / Math.sqrt(Math.max(1e-30, (sq - sum * sum / n) * (rsq - rsum * rsum / n))) : null, alignment: "same sample index, no gain or lag correction" });
  }
  return rows;
}

// src/engine-worker.js
init_performance();
init_load_trace();
init_catalog();
init_dsp();

// src/onnx-shape.js
function readVar(b, p) {
  let n = 0, m = 1;
  while (p < b.length) {
    const v2 = b[p++];
    n += (v2 & 127) * m;
    if (!(v2 & 128)) return [n, p];
    m *= 128;
    if (m > 2 ** 49) throw Error("Invalid protobuf");
  }
  throw Error("Truncated protobuf");
}
function fields(b, start, end, fn2) {
  let p = start;
  while (p < end) {
    let tag;
    [tag, p] = readVar(b, p);
    const id = Math.floor(tag / 8), wire = tag % 8;
    if (wire === 2) {
      let n;
      [n, p] = readVar(b, p);
      if (p + n > end) throw Error("Truncated ONNX field");
      fn2(id, wire, p, p + n);
      p += n;
    } else if (wire === 0) {
      const valueStart = p;
      let value;
      [value, p] = readVar(b, p);
      fn2(id, wire, valueStart, p, value);
    } else if (wire === 1) p += 8;
    else if (wire === 5) p += 4;
    else throw Error("Unsupported ONNX field");
  }
}
function follow(b, start, end, path, fn2) {
  fields(b, start, end, (id, wire, a, z) => {
    if (id === path[0] && wire === 2) {
      if (path.length === 1) fn2(a, z);
      else follow(b, a, z, path.slice(1), fn2);
    }
  });
}
function setFrames(model, frames) {
  if (![32, 64, 128, 256, 512].includes(frames)) throw Error("Invalid MDX frames");
  const b = model instanceof Uint8Array ? model : new Uint8Array(model), positions = [];
  for (const field of [11, 12]) follow(b, 0, b.length, [7, field, 2, 1, 2], (a, z) => {
    let axis = 0;
    fields(b, a, z, (id, wire, d, e) => {
      if (id !== 1 || wire !== 2) return;
      const current = axis++;
      if (current !== 3) return;
      fields(b, d, e, (id2, wire2, p, q2, value) => {
        if (id2 !== 1 || wire2 !== 0 || q2 - p !== 2 || ![32, 64, 128, 256, 512].includes(value)) throw Error("Unexpected MDX time dimension");
        positions.push(p);
      });
    });
  });
  if (positions.length !== 2) throw Error("Unexpected ONNX contract");
  for (const p of positions) {
    b[p] = frames & 127 | 128;
    b[p + 1] = Math.floor(frames / 128);
  }
  return b;
}

// src/engine-worker.js
init_storage();
init_models();
init_audio();
var sampleWASM = observeWASM();
var cpuOrt;
var stop = false;
var ort;
var gpuOrt = null;
var running = false;
var terminal = null;
function configure(job) {
  ort.env.wasm.wasmPaths = new URL("runtime/", location.href).href;
  ort.env.wasm.numThreads = benchmarkThreads(job);
  ort.env.wasm.proxy = false;
}
var send = (d) => {
  if (d.complete || d.paused || d.nextStage) {
    terminal = d;
    return;
  }
  if (d.processedSeconds != null) updateTrace({ currentChunk: d.processedSeconds, backend: d.backend });
  const tick = performance.now();
  postMessage(d);
  addTime("workerPostMessage", performance.now() - tick);
};
function diff(a, b) {
  let sq = 0, ref = 0, max = 0;
  for (let j = 0; j < a.length; j += Math.max(1, Math.floor(a.length / 2e4))) {
    if (!Number.isFinite(a[j])) return Infinity;
    const d = a[j] - b[j];
    sq += d * d;
    ref += b[j] ** 2;
    max = Math.max(max, Math.abs(d));
  }
  return ref > 1e-10 ? Math.sqrt(sq / ref) : max;
}
function waveformUpdate(w, channels, start, total) {
  for (let j = 0; j < channels[0].length; j++) {
    const bin = Math.min(w.length - 1, Math.floor((start + j) * w.length / total));
    w[bin] = Math.max(w[bin], Math.abs(channels[0][j]), Math.abs(channels[1][j]));
  }
}
async function execute(id) {
  let job = await get("jobs", id);
  if (!job) throw Error("\u51E6\u7406\u5C65\u6B74\u304C\u3042\u308A\u307E\u305B\u3093");
  if (job.model === "lead-backing" && job.pipeline?.phase === "vocals") return (await Promise.resolve().then(() => (init_scnet(), scnet_exports))).executeSCNet(job, { cpuOrt, send, isStopped: () => stop });
  if (MODELS.find((m) => m.id === job.model)?.architecture === "htdemucs") return (await Promise.resolve().then(() => (init_htdemucs(), htdemucs_exports))).executeHTDemucs(job, { cpuOrt, send, isStopped: () => stop });
  if (MODELS.find((m) => m.id === job.model)?.architecture === "bs-roformer") return (await Promise.resolve().then(() => (init_bs_roformer(), bs_roformer_exports))).executeBS(job, { cpuOrt, send, isStopped: () => stop });
  if (MODELS.find((m) => m.id === job.model)?.architecture === "scnet") return (await Promise.resolve().then(() => (init_scnet(), scnet_exports))).executeSCNet(job, { cpuOrt, send, isStopped: () => stop });
  globalThis.__STEMLIGHT_NO_OPFS__ = job.caps.opfs === false;
  ort = cpuOrt;
  configure(job);
  const model = MODELS.find((m) => m.id === job.model), mode = MODES[job.mode], reader = await AudioReader.open(job.pipeline?.intermediate?.key || job.input, job.pipeline?.intermediate?.audio || job.audio), total = reader.length, frames = job.frames || (job.current ? 128 : framesFor(job.mode, job.caps));
  job.frames = frames;
  job.status = "running";
  job.startedAt = job.startedAt || Date.now();
  job.outputs = job.outputs || [];
  await put("jobs", id, job);
  const plans = job.model === "lead-backing" ? ["karaoke2"] : weightsFor(model, job.selected);
  let allSteps = 0;
  for (const w of plans) {
    const core = 1024 * (frames - 1) - WEIGHTS[w].fft;
    allSteps += Math.ceil(total / Math.floor(core * (1 - mode.overlap))) * (mode.denoise ? 2 : 1);
  }
  let finishedSteps = job.finishedSteps || 0;
  const started = performance.now();
  for (let pi = job.planIndex || 0; pi < plans.length; pi++) {
    if (stop) break;
    const weight = plans[pi], spec = WEIGHTS[weight], label = spec.output, labels = [spec.output, spec.residual].filter((s) => s && job.selected.includes(s));
    const L = 1024 * (frames - 1), trim = spec.fft / 2, core = L - spec.fft, step = Math.floor(core * (1 - mode.overlap)), dsp = new Spectral(spec.fft, spec.bins, frames);
    await updateTrace({ executingModel: weight, pipelinePhase: job.pipeline?.phase || null });
    send({ stage: "\u30E2\u30C7\u30EB\u3092\u8AAD\u307F\u8FBC\u307F", stem: label, percent: finishedSteps / allSteps * 100 });
    const loaded = performance.now();
    let bytes = setFrames(await loadModel(weight), frames), session, backend = "wasm", first = true;
    let carry = job.current?.weight === weight ? job.current : null;
    let acc = carry?.acc || [new Float32Array(core), new Float32Array(core)], divider = carry?.divider || new Float32Array(core), next = carry?.next || 0, offsets = carry?.offsets || {}, waves = carry?.waves || Object.fromEntries(labels.map((s) => [s, new Float32Array(160)]));
    const sinks = {};
    try {
      for (const s of labels) {
        const key = `out-${id}-${s.toLowerCase()}`;
        sinks[s] = await Sink.open(key, offsets[s]?.offset || 0, offsets[s]?.blocks || 0);
        if (!offsets[s]) await sinks[s].write(wavHeader(total));
      }
      async function create(provider) {
        return ort.InferenceSession.create(bytes, { executionProviders: [provider], graphOptimizationLevel: "all", enableMemPattern: provider === "wasm" });
      }
      if ((job.model !== "lead-backing" || job.benchmark) && job.caps.webgpu && job.backend !== "wasm") {
        try {
          if (!navigator.gpu || !await navigator.gpu.requestAdapter()) throw Error("Worker\u3067GPU Adapter\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093");
          gpuOrt = trackedOrt(await import(new URL("runtime/ort.webgpu.min.mjs", location.href).href));
          ort = gpuOrt;
          configure(job);
          session = await create("webgpu");
          backend = "webgpu";
        } catch (e) {
          if (job.benchmark) throw e;
          ort = cpuOrt;
          configure(job);
          send({ notice: "WebGPU\u3092\u958B\u59CB\u3067\u304D\u306A\u3044\u305F\u3081WASM\u3078\u5207\u308A\u66FF\u3048\u307E\u3059", detail: String(e.message) });
        }
      }
      if (!session) session = await create("wasm");
      if (backend === "wasm") {
        bytes = null;
        await updateTrace({ arrayBufferBytes: 0 });
      }
      job.metrics = job.metrics || {};
      job.metrics.modelLoadMs = (job.metrics.modelLoadMs || 0) + performance.now() - loaded;
      for (let start = next; start < total; start += step) {
        if (stop) break;
        const chunk = await reader.read(start - trim, L);
        let tensorData = dsp.stft(chunk);
        const run = async (input) => {
          const t = await stage("tensor allocation", async () => new ort.Tensor("float32", input, [1, 4, spec.bins, frames]));
          let out;
          try {
            out = await stage("inference", () => session.run({ input: t }));
            const b = measure("outputTensorAccess", () => ownedCPUOutput(out.output));
            if (b.length !== tensorData.length || !b.every(Number.isFinite)) throw Error("\u63A8\u8AD6\u51FA\u529B\u304C\u4E0D\u6B63\u3067\u3059");
            return b;
          } finally {
            t.dispose();
            if (out) for (const t2 of Object.values(out)) t2.dispose();
          }
        };
        let prediction;
        const infer = performance.now();
        try {
          prediction = await run(tensorData);
        } catch (e) {
          if (job.benchmark || backend !== "webgpu") throw e;
          await session.release();
          ort = cpuOrt;
          configure(job);
          session = await create("wasm");
          backend = "wasm";
          send({ notice: "GPU\u63A8\u8AD6\u306B\u5931\u6557\u3057\u305F\u305F\u3081\u3001\u3053\u306E\u30C1\u30E3\u30F3\u30AF\u3092WASM\u3067\u518D\u51E6\u7406\u3057\u307E\u3059" });
          prediction = await run(tensorData);
        }
        if (!job.benchmark && first && backend === "webgpu") {
          await session.release();
          ort = cpuOrt;
          configure(job);
          session = await create("wasm");
          const cpu = await run(tensorData), error = diff(prediction, cpu);
          job.metrics.gpuParity = error;
          if (error > 5e-3) {
            backend = "wasm";
            prediction = cpu;
            send({ notice: "GPU\u306E\u6570\u5024\u691C\u8A3C\u3092\u901A\u904E\u3057\u306A\u304B\u3063\u305F\u305F\u3081WASM\u3092\u4F7F\u7528\u3057\u307E\u3059" });
          } else {
            await session.release();
            ort = gpuOrt;
            configure(job);
            session = await create("webgpu");
            send({ notice: "\u3053\u306E\u30E2\u30C7\u30EB\u306EGPU\u51FA\u529B\u3092WASM\u3068\u6BD4\u8F03\u3057\u3001\u6570\u5024\u691C\u8A3C\u3092\u901A\u904E\u3057\u307E\u3057\u305F" });
          }
        }
        first = false;
        if (mode.denoise) {
          const negative = tensorData.map((x) => -x), other = await run(negative);
          for (let j = 0; j < prediction.length; j++) prediction[j] = (prediction[j] - other[j]) * 0.5;
        }
        job.metrics.inferenceMs = (job.metrics.inferenceMs || 0) + performance.now() - infer;
        job.metrics.backend = backend;
        const output = dsp.istft(prediction);
        tensorData = null;
        prediction = null;
        const overlapTick = performance.now();
        for (let j = 0; j < core; j++) {
          const a = Math.max(1e-4, Math.sin(Math.PI * (j + 0.5) / core) ** 2);
          divider[j] += a;
          acc[0][j] += output[0][j + trim] * a;
          acc[1][j] += output[1][j + trim] * a;
        }
        addTime("overlapAdd", performance.now() - overlapTick);
        const postTick = performance.now();
        const emitCount = Math.min(step, total - start), emit = [new Float32Array(emitCount), new Float32Array(emitCount)];
        for (let j = 0; j < emitCount; j++) for (let c = 0; c < 2; c++) emit[c][j] = acc[c][j] / Math.max(divider[j], 1e-12);
        addTime("postprocessing", performance.now() - postTick);
        let original;
        if (spec.residual && labels.includes(spec.residual)) original = await reader.read(start, emitCount);
        for (const s of labels) {
          const ch = s === spec.residual ? original.map((a, c) => a.map((x, j) => x - emit[c][j] * spec.compensate)) : emit;
          waveformUpdate(waves[s], ch, start, total);
          const { bytes: pcm, clipped } = pcm16(ch);
          job.metrics.clippedSamples = (job.metrics.clippedSamples || 0) + clipped;
          await sinks[s].write(pcm);
          offsets[s] = { offset: sinks[s].offset, blocks: sinks[s].blocks || 0 };
        }
        for (const a of [...acc, divider]) {
          a.copyWithin(0, step);
          a.fill(0, core - step);
        }
        finishedSteps += mode.denoise ? 2 : 1;
        job.finishedSteps = finishedSteps;
        job.planIndex = pi;
        job.current = { weight, next: start + step, acc, divider, offsets, waves };
        job.status = stop ? "paused" : "running";
        await put("jobs", id, job);
        send({ stage: "\u30B9\u30C6\u30E0\u3092\u5206\u96E2", stem: label, percent: Math.min(99, finishedSteps / allSteps * 100), backend, elapsed: performance.now() - started, processedSeconds: Math.min(total, start + emitCount) / 44100, inferenceMs: job.metrics.inferenceMs });
        await new Promise((r) => setTimeout(r, 0));
      }
      if (stop) {
        job.status = "paused";
        await put("jobs", id, job);
        send({ paused: true, id });
        return;
      }
      for (const s of labels) {
        const key = `out-${id}-${s.toLowerCase()}`;
        job.outputs = job.outputs.filter((o) => o.stem !== s);
        job.outputs.push({ stem: s, key, frames: total, rate: 44100, waveform: Array.from(waves[s]), bytes: 44 + total * 4 });
      }
      job.current = null;
      job.planIndex = pi + 1;
      await put("jobs", id, job);
    } finally {
      for (const sink of Object.values(sinks)) sink.close();
      await session?.release().catch(() => {
      });
      bytes = null;
    }
  }
  if (stop) {
    job.status = "paused";
    await put("jobs", id, job);
    send({ paused: true, id });
    return;
  }
  job.status = "complete";
  job.completedAt = Date.now();
  job.metrics.wallMs = job.completedAt - job.startedAt;
  if (job.pipeline) {
    job.pipeline.karaokeMetrics = { backend: job.metrics.backend, frames, overlap: mode.overlap, passes: mode.denoise ? 2 : 1, inferenceMs: job.metrics.inferenceMs - (job.pipeline.scnetMetrics?.inferenceMs || 0), modelLoadMs: job.metrics.modelLoadMs - (job.pipeline.scnetMetrics?.modelLoadMs || 0) };
  }
  await put("jobs", id, job);
  send({ complete: true, id, outputs: job.outputs, metrics: job.metrics });
}
onmessage = async ({ data: d }) => {
  if (d.type === "pause") {
    stop = true;
    return;
  }
  if (d.type !== "start" || running) return;
  running = true;
  stop = false;
  terminal = null;
  try {
    const job = await get("jobs", d.id);
    beginPerformance(job);
    if (job.benchmark) {
      globalThis.__benchmarkHelperWorkers = 0;
      if (typeof Worker === "function") {
        const W = Worker;
        globalThis.Worker = new Proxy(W, { construct(target, args) {
          globalThis.__benchmarkHelperWorkers++;
          return Reflect.construct(target, args);
        } });
      }
      globalThis.__benchmarkWarnings = [];
      for (const name of ["warn", "error"]) {
        const original = console[name].bind(console);
        console[name] = (...args) => {
          const message = args.map((x) => typeof x === "string" ? x.slice(0, 800) : typeof x === "number" || typeof x === "boolean" ? String(x) : Object.prototype.toString.call(x)).join(" ").slice(0, 1200);
          if (globalThis.__benchmarkWarnings.length < 20) globalThis.__benchmarkWarnings.push({ level: name, message });
          original(...args);
        };
      }
      globalThis.__benchmarkGPUCalls = 0;
      if (typeof GPUComputePassEncoder !== "undefined") {
        const original = GPUComputePassEncoder.prototype.dispatchWorkgroups;
        GPUComputePassEncoder.prototype.dispatchWorkgroups = function(...args) {
          if (globalThis.__benchmarkInference) globalThis.__benchmarkGPUCalls++;
          return original.apply(this, args);
        };
      }
    }
    if (Number.isFinite(d.postedAt)) addTime("workerStartDeliveryLatency", Math.max(0, performance.timeOrigin + performance.now() - d.postedAt));
    await resumeTrace(job?.model, (t) => postMessage({ loadTrace: t }));
    await updateTrace({ activeWorkers: 1 });
    cpuOrt = trackedOrt(await stage("ORT module initialization", () => Promise.resolve().then(() => (init_ort_wasm_min(), ort_wasm_min_exports))));
    await execute(d.id);
  } catch (e) {
    const job = await get("jobs", d.id);
    if (job) {
      job.status = "paused";
      job.error = String(e.message);
      await put("jobs", d.id, job);
    }
    terminal = { error: String(e.message || e), detail: String(e.stack || ""), id: d.id };
    await updateTrace({ exception: { stage: e._stemlightStage || "Worker execution", message: String(e.message || e), stack: String(e.stack || "") } });
  } finally {
    await updateTrace(sampleWASM());
    await cleanupSessions();
    await flush();
    running = false;
    if (terminal) {
      const job = await get("jobs", d.id);
      if (job?.benchmark) {
        terminal.benchmark = { sessionCleanup: await get("settings", "load-trace"), gpuInferenceDispatches: globalThis.__benchmarkGPUCalls ?? null, warnings: globalThis.__benchmarkWarnings || [], helperWorkersCreated: globalThis.__benchmarkHelperWorkers ?? null };
        if (terminal.complete) {
          const tick = performance.now();
          try {
            terminal.benchmark.quality = await benchmarkQuality(job.outputs, job.benchmark.references);
            terminal.benchmark.qualityMs = performance.now() - tick;
          } catch (e) {
            terminal.benchmark.qualityError = String(e.message);
          }
        }
      }
      postMessage(terminal);
    }
  }
};
/*! Bundled license information:

onnxruntime-web/dist/ort.wasm.min.mjs:
  (*!
   * ONNX Runtime Web v1.30.0
   * Copyright (c) Microsoft Corporation. All rights reserved.
   * Licensed under the MIT License.
   *)
*/
//# sourceMappingURL=engine-worker.js.map
