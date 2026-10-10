// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i2 = 0; i2 < 31; ++i2) {
    b[i2] = start += 1 << eb[i2 - 1];
  }
  var r = new i32(b[30]);
  for (var i2 = 1; i2 < 30; ++i2) {
    for (var j = b[i2]; j < b[i2 + 1]; ++j) {
      r[j] = j - b[i2] << 5 | i2;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var et = /* @__PURE__ */ new u8(0);
var crct = /* @__PURE__ */ (function() {
  var t = new Int32Array(256);
  for (var i2 = 0; i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
})();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i2 = 0; i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wbytes = function(d, b, v) {
  for (; v; ++b)
    d[b] = v, v >>>= 8;
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0; i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0; i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
var ZipPassThrough = /* @__PURE__ */ (function() {
  function ZipPassThrough2(filename) {
    this.filename = filename;
    this.c = crc();
    this.size = 0;
    this.compression = 0;
  }
  ZipPassThrough2.prototype.process = function(chunk, final) {
    this.ondata(null, chunk, final);
  };
  ZipPassThrough2.prototype.push = function(chunk, final) {
    if (!this.ondata)
      err(5);
    this.c.p(chunk);
    this.size += chunk.length;
    if (final)
      this.crc = this.c.d();
    this.process(chunk, final || false);
  };
  return ZipPassThrough2;
})();
var Zip = /* @__PURE__ */ (function() {
  function Zip2(cb) {
    this.ondata = cb;
    this.u = [];
    this.d = 1;
  }
  Zip2.prototype.add = function(file) {
    var _this = this;
    if (!this.ondata)
      err(5);
    if (this.d & 2)
      this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, false);
    else {
      var f = strToU8(file.filename), fl_1 = f.length;
      var com = file.comment, o = com && strToU8(com);
      var u = fl_1 != file.filename.length || o && com.length != o.length;
      var hl_1 = fl_1 + exfl(file.extra) + 30;
      if (fl_1 > 65535)
        this.ondata(err(11, 0, 1), null, false);
      var header = new u8(hl_1);
      wzh(header, 0, file, f, u, -1);
      var chks_1 = [header];
      var pAll_1 = function() {
        for (var _i = 0, chks_2 = chks_1; _i < chks_2.length; _i++) {
          var chk = chks_2[_i];
          _this.ondata(null, chk, false);
        }
        chks_1 = [];
      };
      var tr_1 = this.d;
      this.d = 0;
      var ind_1 = this.u.length;
      var uf_1 = mrg(file, {
        f,
        u,
        o,
        t: function() {
          if (file.terminate)
            file.terminate();
        },
        r: function() {
          pAll_1();
          if (tr_1) {
            var nxt = _this.u[ind_1 + 1];
            if (nxt)
              nxt.r();
            else
              _this.d = 1;
          }
          tr_1 = 1;
        }
      });
      var cl_1 = 0;
      file.ondata = function(err2, dat, final) {
        if (err2) {
          _this.ondata(err2, dat, final);
          _this.terminate();
        } else {
          cl_1 += dat.length;
          chks_1.push(dat);
          if (final) {
            var dd = new u8(16);
            wbytes(dd, 0, 134695760);
            wbytes(dd, 4, file.crc);
            wbytes(dd, 8, cl_1);
            wbytes(dd, 12, file.size);
            chks_1.push(dd);
            uf_1.c = cl_1, uf_1.b = hl_1 + cl_1 + 16, uf_1.crc = file.crc, uf_1.size = file.size;
            if (tr_1)
              uf_1.r();
            tr_1 = 1;
          } else if (tr_1)
            pAll_1();
        }
      };
      this.u.push(uf_1);
    }
  };
  Zip2.prototype.end = function() {
    var _this = this;
    if (this.d & 2) {
      this.ondata(err(4 + (this.d & 1) * 8, 0, 1), null, true);
      return;
    }
    if (this.d)
      this.e();
    else
      this.u.push({
        r: function() {
          if (!(_this.d & 1))
            return;
          _this.u.splice(-1, 1);
          _this.e();
        },
        t: function() {
        }
      });
    this.d = 3;
  };
  Zip2.prototype.e = function() {
    var bt = 0, l = 0, tl = 0;
    for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
      var f = _a2[_i];
      tl += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0);
    }
    var out = new u8(tl + 22);
    for (var _b2 = 0, _c = this.u; _b2 < _c.length; _b2++) {
      var f = _c[_b2];
      wzh(out, bt, f, f.f, f.u, -f.c - 2, l, f.o);
      bt += 46 + f.f.length + exfl(f.extra) + (f.o ? f.o.length : 0), l += f.b;
    }
    wzf(out, bt, this.u.length, tl, l);
    this.ondata(null, out, true);
    this.d = 2;
  };
  Zip2.prototype.terminate = function() {
    for (var _i = 0, _a2 = this.u; _i < _a2.length; _i++) {
      var f = _a2[_i];
      f.t();
    }
    this.d = 2;
  };
  return Zip2;
})();

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
          for (let i2 = 0; i2 < meta.blocks && position < end; i2++) {
            const size = meta.sizes?.[i2] || Math.min(4 * 1024 ** 2, meta.size - position);
            if (position + size > start) {
              const b = await get("blocks", `${key}:${i2}`);
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
    for (let i2 = 0; i2 < meta.blocks; i2++) {
      const b = await get("blocks", `${key}:${i2}`);
      if (!b) throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u306E\u30D6\u30ED\u30C3\u30AF\u304C\u3042\u308A\u307E\u305B\u3093");
      blobs.push(b);
    }
    return new Blob(blobs, { type: meta.type || "audio/wav" });
  }
  throw Error("\u4FDD\u5B58\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093");
}
async function removeFile(key) {
  const meta = await get("files", key);
  if (meta?.opfs) await (await root())?.removeEntry(key).catch(() => {
  });
  if (meta?.blocks) for (let i2 = 0; i2 < meta.blocks; i2++) await del("blocks", `${key}:${i2}`);
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

// src/export-worker.js
onmessage = async ({ data: d }) => {
  const key = `zip-${d.id}`;
  let sink;
  const tick = performance.now(), timing = { readMs: 0, zipMs: 0, writeMs: 0 };
  const time = async (k, fn) => {
    const t = performance.now();
    try {
      return await fn();
    } finally {
      timing[k] += performance.now() - t;
    }
  };
  try {
    const job = await get("jobs", d.id);
    globalThis.__STEMLIGHT_NO_OPFS__ = job?.caps.opfs === false;
    sink = await Sink.open(key);
    let queue = Promise.resolve(), error;
    const zip = new Zip((e, chunk, final) => {
      if (e) {
        error = e;
        return;
      }
      const copy = chunk.slice();
      queue = queue.then(() => time("writeMs", () => sink.write(copy)));
    });
    for (const [index, o] of d.outputs.entries()) {
      const file = await readFile(o.key, true), entry = new ZipPassThrough(`${o.stem}.wav`);
      zip.add(entry);
      const reader = file.stream().getReader();
      while (true) {
        const r = await time("readMs", () => reader.read());
        if (r.done) break;
        const zipTick = performance.now();
        entry.push(r.value, false);
        timing.zipMs += performance.now() - zipTick;
        await queue;
        if (error) throw error;
      }
      entry.push(new Uint8Array(0), true);
      await queue;
      postMessage({ progress: (index + 1) / d.outputs.length });
    }
    zip.end();
    await queue;
    if (error) throw error;
    sink.close();
    job.metrics ||= {};
    job.metrics.export = { ...timing, totalMs: performance.now() - tick, format: "ZIP stored WAV, no lossy recompression", scope: "Worker ZIP creation; excludes browser download/save time" };
    await put("jobs", job.id, job);
    postMessage({ complete: true, key });
  } catch (e) {
    sink?.close();
    await removeFile(key).catch(() => {
    });
    postMessage({ error: String(e.message) });
  }
};
