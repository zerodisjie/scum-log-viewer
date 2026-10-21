/* ============ SCUM 日志查看器 前端 ============ */

const ROW_H = 28;
const PAGE = 3000;

/* ---------------- 各类型的表格列定义 ----------------
   k: 字段名（数组表示按顺序取第一个非空）
   w: 列宽（px 或 1fr）
   cls: 单元格样式
*/
const SCHEMAS = {
  login: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "act", l: "动作", w: "60px", cls: "act" },
      { k: "name", l: "玩家昵称", w: "120px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "ip", l: "IP 地址", w: "128px", cls: "mono" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  kill: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "victim", l: "受害者", w: "116px", cls: "strong" },
      { k: "victim_id", l: "受害者 ID", w: "152px", cls: "mono copy" },
      { k: "killer", l: "击杀者", w: "206px" },
      { k: "killer_id", l: "击杀者 ID", w: "110px", cls: "mono dim" },
      { k: "weapon", l: "武器", w: "1fr", cls: "mono dim" },
      { k: "dist", l: "距离", w: "76px", cls: "num" },
    ],
  },
  chat: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "name", l: "玩家昵称", w: "130px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "channel", l: "频道", w: "66px", cls: "tagcell" },
      { k: "text", l: "内容", w: "1fr" },
    ],
  },
  admin: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "name", l: "玩家昵称", w: "124px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "cmd", l: "指令 / 内容", w: "1fr", cls: "mono" },
    ],
  },
  vehicle_destruction: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "evt", l: "事件", w: "110px", cls: "tagcell" },
      { k: "veh", l: "载具", w: "170px", cls: "strong" },
      { k: "veh_id", l: "载具 ID", w: "86px", cls: "mono" },
      { k: "owner", l: "车主", w: "120px" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  economy: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "act", l: "行为", w: "96px", cls: "econact" },
      { k: "name", l: "玩家昵称", w: "120px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "account", l: "银行账号", w: "128px", cls: "mono dim copy" },
      { k: "amount", l: "金额", w: "88px", cls: "num" },
      { k: "what", l: "说明", w: "1fr" },
    ],
  },
  famepoints: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "name", l: "玩家昵称", w: "116px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: ["fame", "value"], l: "声望", w: "104px", cls: "num" },
      { k: "period", l: "统计周期", w: "100px", cls: "dim" },
      { k: "total", l: "累计", w: "104px", cls: "num dim" },
      { k: "detail", l: "明细项", w: "1fr", cls: "mono dim" },
    ],
  },
  chest_ownership: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "chest", l: "箱子 ID", w: "86px", cls: "mono" },
      { k: "name", l: "归属玩家", w: "124px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  violations: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "evt", l: "事件", w: "140px", cls: "tagcell" },
      { k: "action", l: "违规动作", w: "200px", cls: "mono" },
      { k: "desc", l: "描述", w: "1fr" },
      { k: "pos", l: "位置", w: "190px", cls: "mono dim" },
    ],
  },
  gameplay: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "target", l: "对象", w: "140px", cls: "strong" },
      { k: "state", l: "状态", w: "96px", cls: "tagcell" },
      { k: "ago", l: "发生于", w: "128px", cls: "dim" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  loot: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "raw", l: "内容", w: "1fr", cls: "mono" },
    ],
  },
  all: {
    cols: [
      { k: "time", l: "时间", w: "126px", cls: "dim" },
      { k: "tag", l: "类型", w: "82px", cls: "tagcell" },
      { k: "evt", l: "事件", w: "110px", cls: "tagcell" },
      { k: "name", l: "玩家", w: "120px", cls: "strong" },
      { k: "raw", l: "内容", w: "1fr" },
    ],
  },
};

// 经济交易：行为配色（钱出去偏红、钱进来偏绿，其余保持中性）
const ECON_OUT = new Set(["购买", "支出", "罚金", "销毁卡片", "销毁物品", "删除卡片"]);
const ECON_IN = new Set(["收入", "奖励", "退款", "出售", "取款"]);

const EVT_NAME = {
  VehicleInactiveTimerReached: "超时回收",
  Disappeared: "已消失",
  Destroyed: "被摧毁",
  DestroyWithExplosion: "被炸毁",
  Bank: "银行",
  OutOfInteractionRange: "超出交互距离",
  BankTrader: "银行交易",
};

const STATE_NAME = {
  Activated: "已触发",
  Active: "激活中",
  Locked: "已锁定",
};

function curSchema() {
  const t = S.cur ? S.cur.type : "all";
  return SCHEMAS[t] || SCHEMAS.all;
}

const colsCss = (sc) => sc.cols.map((c) => c.w).join(" ");

function cellVal(r, key) {
  if (key === "time") return `${fmtDay(r[0])} ${fmtTime(r[0])}`;
  if (key === "tag") return TAG_NAME[r[1]] || r[1];
  if (key === "raw") return r[4];
  const f = r[9] || {};
  const keys = Array.isArray(key) ? key : [key];
  for (const k of keys) {
    const v = f[k];
    if (v === undefined || v === null || v === "") continue;
    if (k === "evt") return EVT_NAME[v] || v;
    if (k === "state") return STATE_NAME[v] || v;
    return String(v);
  }
  return "";
}

const TAG_NAME = {
  admin: "管理员", login: "登录", logout: "登出", chat: "聊天", kill: "击杀",
  violation: "违规", violations: "违规", economy: "经济", building: "建筑",
  base_building_destruction: "建筑被拆", vehicle: "载具", vehicle_destruction: "载具销毁",
  loot: "物资", quest: "任务", quests: "任务", raid: "抄家", raid_protection: "抄家保护",
  fame: "声望", famepoints: "声望", chest: "箱子", chest_ownership: "箱子归属",
  sentry: "哨戒炮", armor_absorption: "护甲吸收", gameplay: "玩法记录",
  network_objects: "网络对象", server_notifications: "服务器公告",
  event_kill: "活动击杀", cont: "续行", other: "其他",
};

const S = {
  root: "",
  groups: [],
  cur: null,          // {kind:'group', type, typeName} | {kind:'file', path, name, type}
  meta: null,
  rows: [],
  total: 0,
  cats: new Set(),
  only: "",
  selIdx: -1,
  busy: false,
  hideNoise: true,
  followTimer: null,
  reqSeq: 0,
};

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* ---------------- 工具 ---------------- */
const pad = (n, w = 2) => String(n).padStart(w, "0");

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function hl(s, kw) {
  const t = esc(s);
  if (!kw) return t;
  try {
    const re = new RegExp("(" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
    return t.replace(re, "<mark>$1</mark>");
  } catch { return t; }
}

const d2 = (ms) => new Date(ms);

function fmtTime(ms) {
  if (!ms) return "—";
  const d = d2(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtTimeMs(ms) {
  if (!ms) return "—";
  return `${fmtTime(ms)}.${pad(d2(ms).getMilliseconds(), 3)}`;
}

function fmtDay(ms) {
  if (!ms) return "";
  const d = d2(ms);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtFull(ms) {
  if (!ms) return "—";
  const d = d2(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${fmtTimeMs(ms)}`;
}

function fmtShort(ms) {
  if (!ms) return "—";
  const d = d2(ms);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 日志原文里记的是 UTC，和表格里显示的本机时间会差出时区偏移，
// 详情里附一份原始 UTC 时间，方便对着日志文件核对。
function fmtUTC(ms) {
  if (!ms) return "";
  const d = d2(ms);
  if (d.getTimezoneOffset() === 0) return "";
  return `UTC ${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function fmtSize(b) {
  if (!b) return "0 B";
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function fmtAgo(sec) {
  const d = Date.now() / 1000 - sec;
  if (d < 60) return "刚刚";
  if (d < 3600) return Math.floor(d / 60) + " 分钟前";
  if (d < 86400) return Math.floor(d / 3600) + " 小时前";
  return Math.floor(d / 86400) + " 天前";
}

const KNOWN_COLOR = new Set([
  "admin", "login", "logout", "chat", "kill", "violation", "violations", "economy",
  "building", "base_building_destruction", "vehicle", "vehicle_destruction", "loot",
  "quest", "quests", "raid", "raid_protection", "fame", "famepoints", "chest",
  "chest_ownership", "sentry", "armor_absorption", "gameplay", "network_objects",
  "server_notifications", "event_kill", "cont", "other",
]);

function tagColor(t) {
  return KNOWN_COLOR.has(t) ? `var(--c-${t})` : "var(--c-other)";
}

async function api(path) {
  const r = await fetch(path);
  return r.json();
}

/* ---------------- 初始化 ---------------- */
async function boot() {
  const theme = localStorage.getItem("scumlog-theme") || "dark";
  document.documentElement.dataset.theme = theme;

  bindUI();
  const init = await api("/api/init");
  if (init.version) $("appVer").textContent = "v" + init.version;
  const qs = new URLSearchParams(location.search);
  if (init.root) setRoot(init.root, init.groups, qs.get("type"));
  else $("emptyText").textContent = "没找到 SCUM 日志目录，点「打开目录」手动指定";
  if (init.candidates) renderQuickRoots(init.candidates);
}

function setRoot(path, groups, wantType) {
  const segs = String(path).split(/[\\/]/).filter(Boolean);
  $("pathText").textContent = segs.length > 1 ? "…\\" + segs[segs.length - 1] : path;
  $("pathBox").title = path;
  S.root = path;
  S.groups = groups || [];
  const alive = S.groups.filter((g) => g.hasData);
  $("fileCount").textContent = alive.length;
  renderGroups();
  if (!S.groups.length) {
    $("empty").style.display = "flex";
    $("emptyText").textContent = "这个目录里没有 .log 文件";
    return;
  }

  // 指定了类型就打开它，否则直接进「全部日志」总时间线
  if (wantType) {
    const t = wantType.toLowerCase();
    const g = t === "all" ? null : S.groups.find((x) => x.type.toLowerCase() === t);
    if (g) return openGroup(g);
  }
  openGroup({ type: ALL, typeName: "全部日志" });
}

/* ---------------- 侧栏：类型按钮（不再列文件） ---------------- */
const ALL = "all";

function typeBtn(g, totalCount) {
  const on = S.cur && S.cur.type === g.type;
  const isAll = g.type === ALL;
  const b = el("button", "typebtn" + (on ? " active" : "") + (isAll ? " all" : "") + (g.hasData ? "" : " dim"));
  const color = isAll ? "var(--c-login)" : tagColor(g.type);
  const cnt = isAll ? totalCount : g.count;
  const range = g.stampFirst ? `${fmtDay(g.stampFirst)}~${fmtDay(g.stampLast)}` : "";
  const shown = g.hasData ? (cnt != null ? cnt.toLocaleString() : "—") : "空";
  b.innerHTML = `
    <span class="dot" style="background:${color}"></span>
    <span class="tname" title="${esc(g.typeName)}">${esc(g.typeName)}</span>
    <span class="trange">${isAll ? "" : range}</span>
    <span class="tcount">${shown}</span>`;
  b.title = isAll
    ? "全部日志：所有类型的记录合并成一条时间线"
    : `${g.typeName}${range ? " · " + range : ""}`;
  b.onclick = () => openGroup(g);
  return b;
}

function renderGroups() {
  const box = $("fileList");
  box.innerHTML = "";
  if (!S.groups.length) {
    box.appendChild(el("div", "file-meta", "此目录没有 .log 文件"));
    return;
  }

  const alive = S.groups.filter((g) => g.hasData);
  const mute = S.groups.filter((g) => !g.hasData);
  const totalCount = alive.reduce((s, g) => s + (g.count || 0), 0);
  const allRange = {
    type: ALL, typeName: "全部日志", hasData: alive.length > 0,
    count: totalCount,
    stampFirst: alive.length ? Math.min(...alive.map((g) => g.stampFirst)) : 0,
    stampLast: alive.length ? Math.max(...alive.map((g) => g.stampLast)) : 0,
  };

  box.appendChild(typeBtn(allRange, totalCount));

  if (alive.length) {
    box.appendChild(el("div", "side-sep", `分为 ${alive.length} 类`));
    for (const g of alive) box.appendChild(typeBtn(g));
  }
  if (mute.length) {
    box.appendChild(el("div", "side-sep", `${mute.length} 类无记录`));
    for (const g of mute) box.appendChild(typeBtn(g));
  }
}

/* ---------------- 打开目标 ---------------- */
function openGroup(g) {
  if (S.busy) return;
  open({ kind: "group", type: g.type, typeName: g.typeName || "全部日志" });
}

async function open(target) {
  S.busy = true;
  S.cur = target;
  S.only = "";
  S.cats.clear();
  S.selIdx = -1;
  $("detail").hidden = true;
  $("detailHead").hidden = true;
  $("empty").style.display = "none";
  $("emptyText").textContent = "正在解析…";
  $("logView").innerHTML = "";
  $("logSpacer").style.height = "0px";
  renderGroups();
  $("count").textContent = "解析中…";
  setLogHead();

  try {
    const meta = await api("/api/open?" + openParams());
    if (meta.error) throw new Error(meta.error);
    applyMeta(meta);
    await query(true);
  } catch (e) {
    $("empty").style.display = "flex";
    $("emptyText").textContent = "打开失败：" + e.message;
    $("count").textContent = "—";
  } finally {
    S.busy = false;
  }
}

function openParams() {
  if (!S.cur) return "";
  if (S.cur.kind === "group") {
    return `root=${encodeURIComponent(S.root)}&type=${encodeURIComponent(S.cur.type)}`;
  }
  return `path=${encodeURIComponent(S.cur.path)}`;
}

const isMerged = () => !!(S.cur && S.cur.kind === "group");

function setLogHead() {
  const sc = curSchema();
  const css = colsCss(sc);
  const head = $("logHead");
  head.style.gridTemplateColumns = css;
  head.innerHTML = sc.cols.map((c) => `<span class="tc">${c.l}</span>`).join("");
  $("logView").style.setProperty("--cols", css);
}

function applyMeta(meta) {
  S.meta = meta;
  renderCards();
  renderTypeBars();
  renderPlayers();
  renderChips();
}

/* ---------------- 查询 ---------------- */
function buildParams(offset) {
  const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset || 0) });
  if (S.cur.kind === "group") {
    p.set("root", S.root);
    p.set("type", S.cur.type);
  } else {
    p.set("path", S.cur.path);
  }
  if (S.cats.size) p.set("cats", [...S.cats].join(","));
  const lv = $("level").value;
  if (lv !== "all") p.set("level", lv);
  const kw = $("q").value.trim();
  if (kw) p.set("q", kw);
  const hr = Number($("range").value);
  if (hr) p.set("from", String(Date.now() - hr * 3600 * 1000));
  if (S.only) p.set("only", S.only);
  if (S.hideNoise) p.set("noise", "0");
  return p;
}

async function query(reset, offset) {
  if (!S.cur) return;
  const seq = ++S.reqSeq;
  const data = await api("/api/query?" + buildParams(offset || 0).toString());
  if (seq !== S.reqSeq) return;
  if (data.error) {
    $("count").textContent = data.error;
    return;
  }
  if (reset) {
    S.rows = data.rows;
    $("logWrap").scrollTop = 0;
  } else {
    S.rows = S.rows.concat(data.rows);
  }
  S.total = data.total;

  const shown = S.rows.length;
  let label = S.total.toLocaleString() + " 条";
  if (S.total > shown) label = `显示 ${shown.toLocaleString()} / ${S.total.toLocaleString()} 条`;
  if (S.only) label += " · 已按玩家筛选";
  if (S.hideNoise) label += " · 已隐藏噪声";
  $("count").textContent = label;

  $("empty").style.display = S.total ? "none" : "flex";
  if (!S.total) {
    const raw = (S.meta && S.meta.count) || 0;
    if (S.hideNoise && raw > 0 && !S.only && !$("q").value.trim() && !S.cats.size) {
      $("emptyText").textContent =
        `这一类 ${raw.toLocaleString()} 条记录都是引擎启动时打印的配置行，没有真实事件。取消勾选「隐藏噪声」可以看原文。`;
    } else {
      $("emptyText").textContent = "没有匹配的日志，试试放宽筛选条件";
    }
  }
  $("loadMore").hidden = shown >= S.total;
  paint();
}

/* ---------------- 虚拟滚动 ---------------- */
function cellHtml(c, r, kw) {
  const v = cellVal(r, c.k);
  let style = "";
  if (c.cls === "act") {
    style = ` style="color:${v === "登出" ? "var(--c-logout)" : "var(--c-login)"}"`;
  } else if (c.k === "tag") {
    style = ` style="color:${tagColor(r[1])}"`;
  }
  const tip = v && v.length > 8 ? ` title="${esc(v)}"` : "";
  let cls = c.cls || "";
  if (cls === "econact") cls = ECON_OUT.has(v) ? "econout" : ECON_IN.has(v) ? "econin" : "";
  return `<span class="tc ${cls}"${style}${tip}>${hl(v, kw)}</span>`;
}

function rowHtml(r, i, kw, sc) {
  const f = r[9] || {};
  const cls = ["trow"];
  if (r[2] === "error") cls.push("lv-error");
  else if (r[2] === "warn") cls.push("lv-warn");
  if (r[1] === "cont") cls.push("cont");
  if (f.noise) cls.push("noise");
  if (i === S.selIdx) cls.push("sel");

  let cells;
  if (f.msg && sc !== SCHEMAS.all) {
    // 这一行拆不出字段，原文横跨剩余所有列
    cells = cellHtml(sc.cols[0], r, kw) +
      `<span class="tc raw" style="grid-column:2 / -1">${hl(f.msg, kw)}</span>`;
  } else {
    cells = sc.cols.map((c) => cellHtml(c, r, kw)).join("");
  }
  const title = `${fmtFull(r[0])}\n${r[4]}`;
  return `<div class="${cls.join(" ")}" data-i="${i}" title="${esc(title)}">${cells}</div>`;
}

function paint() {
  const wrap = $("logWrap");
  const spacer = $("logSpacer");
  const view = $("logView");
  const kw = $("q").value.trim();
  const total = S.rows.length;
  const sc = curSchema();

  spacer.style.height = total * ROW_H + ($("loadMore").hidden ? 0 : 34) + "px";
  if (!total) { view.innerHTML = ""; return; }

  const top = wrap.scrollTop;
  const h = wrap.clientHeight || 600;
  const start = Math.max(0, Math.floor(top / ROW_H) - 8);
  const end = Math.min(total, Math.ceil((top + h) / ROW_H) + 8);

  const buf = [];
  for (let i = start; i < end; i++) buf.push(rowHtml(S.rows[i], i, kw, sc));
  view.style.transform = `translateY(${start * ROW_H}px)`;
  view.innerHTML = buf.join("");
}

/* ---------------- 右栏 ---------------- */
function renderCards() {
  const m = S.meta;
  const err = (m.stats.levels && m.stats.levels.error) || 0;
  const warn = (m.stats.levels && m.stats.levels.warn) || 0;
  const isAll = m.type === ALL;
  const kinds = Object.keys(m.stats.types).length;
  const typeLine = isAll
    ? `全部日志 · ${kinds} 种类型合并`
    : `${esc(m.typeName)}`;

  $("cards").innerHTML = `
    <div class="card"><div class="k">日志条数</div><div class="v">${m.count.toLocaleString()}</div></div>
    <div class="card"><div class="k">覆盖天数</div><div class="v">${m.days ? m.days + " 天" : "—"}</div></div>
    <div class="card"><div class="k">错误</div><div class="v" style="color:var(--c-error)">${err.toLocaleString()}</div></div>
    <div class="card"><div class="k">警告</div><div class="v" style="color:var(--c-warn)">${warn.toLocaleString()}</div></div>
    <div class="card wide"><div class="k">时间范围</div><div class="v sm">${m.first ? `${fmtShort(m.first)} → ${fmtShort(m.last)}` : "无时间戳"}</div></div>
    <div class="card wide"><div class="k">范围</div><div class="v sm">${typeLine}</div></div>`;
}

function renderTypeBars() {
  const box = $("typeBars");
  const t = (S.meta && S.meta.stats.types) || {};
  const entries = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(...entries.map((e) => e[1]), 1);
  box.innerHTML = "";
  if (!entries.length) {
    box.appendChild(el("div", "file-meta", "没有内容"));
    return;
  }
  for (const [tag, n] of entries) {
    const color = tagColor(tag);
    const row = el("div", "tb");
    row.innerHTML = `
      <span class="tb-name">${esc(TAG_NAME[tag] || tag)}</span>
      <span class="tb-track"><span class="tb-fill" style="width:${(n / max * 100).toFixed(1)}%;background:${color}"></span></span>
      <span class="tb-n">${n.toLocaleString()}</span>`;
    row.onclick = () => {
      S.cats.size === 1 && S.cats.has(tag) ? S.cats.delete(tag) : (S.cats.clear(), S.cats.add(tag));
      renderChips();
      query(true);
    };
    box.appendChild(row);
  }
}

function renderPlayers() {
  const box = $("players");
  box.innerHTML = "";
  const ps = (S.meta && S.meta.players) || [];
  if (!ps.length) {
    box.appendChild(el("div", "file-meta", "这组日志里没有识别到玩家 ID"));
    return;
  }
  for (const p of ps.slice(0, 12)) {
    const row = el("div", "pl");
    row.innerHTML = `<span class="nm" title="${esc(p.id)}">${esc(p.name || "未知玩家")}</span><span class="ct">${p.count}</span>`;
    row.onclick = () => {
      S.only = p.id;
      $("q").value = "";
      S.cats.clear();
      renderChips();
      query(true);
    };
    box.appendChild(row);
  }
}

/* ---------------- 类型筛选 chips ---------------- */
function renderChips() {
  const box = $("chips");
  const t = (S.meta && S.meta.stats.types) || {};
  box.innerHTML = "";

  const all = el("button", "chip" + (S.cats.size === 0 && !S.only ? " on" : ""), "全部");
  all.onclick = () => { S.cats.clear(); S.only = ""; renderChips(); query(true); };
  box.appendChild(all);

  if (S.only) {
    const c = el("button", "chip on", `玩家 ${esc(S.only.slice(-6))} ×`);
    c.onclick = () => { S.only = ""; renderChips(); query(true); };
    box.appendChild(c);
  }

  Object.entries(t).sort((a, b) => b[1] - a[1]).forEach(([tag, n]) => {
    const on = S.cats.has(tag);
    const c = el("button", "chip" + (on ? " on" : ""),
      `<span class="dot" style="background:${tagColor(tag)}"></span>${esc(TAG_NAME[tag] || tag)}<span class="n">${n}</span>`);
    c.onclick = () => { on ? S.cats.delete(tag) : S.cats.add(tag); renderChips(); query(true); };
    box.appendChild(c);
  });
}

/* ---------------- 详情 ---------------- */
function showDetail(i) {
  const r = S.rows[i];
  if (!r) return;
  S.selIdx = i;
  const [ts, tag, lv, cat, msg, , steam, ip] = r;
  const f = r[9] || {};
  const sc = curSchema();

  $("detailHead").hidden = false;
  const d = $("detail");
  d.hidden = false;

  const utc = fmtUTC(ts);
  const lines = [`<div class="dr"><span class="dk">时间</span><span class="dv">${fmtFull(ts)}${utc ? `<span class="tznote" title="日志原文用的是 UTC 时间">${utc}</span>` : ""}</span></div>`];
  lines.push(`<div class="dr"><span class="dk">类型</span><span class="dv" style="color:${tagColor(tag)}">${esc(TAG_NAME[tag] || tag)}${cat ? " · " + esc(cat) : ""}</span></div>`);

  // 按当前表格的列，把拆出来的字段逐条列出来
  for (const c of sc.cols) {
    if (c.k === "time" || c.k === "tag" || c.k === "raw") continue;
    const v = cellVal(r, c.k);
    if (!v) continue;
    const copy = c.k === "steam" || c.k === "victim_id" || c.k === "killer_id" || c.k === "ip";
    lines.push(`<div class="dr"><span class="dk">${c.l}</span><span class="dv${copy ? " cp" : ""}"${copy ? ` data-copy="${esc(v)}"` : ""}>${esc(v)}</span></div>`);
  }
  if (f.pos && !sc.cols.some((c) => c.k === "pos")) {
    // 体积大的坐标不占表格宽度，放详情里看
    lines.push(`<div class="dr"><span class="dk">位置</span><span class="dv" style="font-family:ui-monospace,Consolas,monospace">${esc(f.pos)}</span></div>`);
  }
  if (steam && !lines.some((x) => x.includes(steam))) {
    lines.push(`<div class="dr"><span class="dk">SteamID</span><span class="dv cp" data-copy="${steam}">${steam}</span></div>`);
  }
  if (ip && !lines.some((x) => x.includes(ip))) {
    lines.push(`<div class="dr"><span class="dk">IP</span><span class="dv cp" data-copy="${esc(ip)}">${esc(ip)}</span></div>`);
  }
  if (f.noise) {
    lines.push(`<div class="dr"><span class="dk">标记</span><span class="dv" style="color:var(--muted)">引擎启动日志</span></div>`);
  }
  lines.push(`<div class="dmsg">${esc(msg)}</div>`);
  d.innerHTML = lines.join("");

  d.querySelectorAll("[data-copy]").forEach((n) => {
    n.onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(n.dataset.copy);
      const old = n.textContent;
      n.textContent = "已复制";
      setTimeout(() => (n.textContent = old), 700);
    };
  });
  paint();
}

/* ---------------- 实时跟随 ---------------- */
function setFollow(on) {
  clearInterval(S.followTimer);
  S.followTimer = null;
  if (!on) return;
  S.followTimer = setInterval(tick, 2000);
}

async function tick() {
  if (!S.cur || S.busy) return;
  try {
    const meta = await api("/api/open?" + openParams());
    if (meta.error || !S.meta) return;
    if (meta.count === S.meta.count) return;

    const wrap = $("logWrap");
    // 最新在最前：停在顶部说明正在看最新，刷新后继续贴顶；否则原地不动别打扰阅读
    const atTop = wrap.scrollTop <= 80;
    const keep = wrap.scrollTop;
    applyMeta(meta);
    await query(true);
    wrap.scrollTop = atTop ? 0 : keep;
  } catch { /* 文件正被写入时偶发失败，忽略 */ }
}

/* ---------------- 目录弹窗 ---------------- */
let modalPath = "";

async function openDirModal() {
  $("modal").hidden = false;
  await scanDir(S.root || "C:\\");
}

async function scanDir(path) {
  const d = await api("/api/scan?path=" + encodeURIComponent(path));
  if (d.error) { $("modalBody").innerHTML = `<div class="dir">无法打开：${esc(d.error)}</div>`; return; }
  modalPath = d.path;
  $("modalPath").textContent = d.path;
  const body = $("modalBody");
  body.innerHTML = "";

  if (d.parent) {
    const up = el("div", "dir up", `<span class="ico">↑</span> 返回上级`);
    up.onclick = () => scanDir(d.parent);
    body.appendChild(up);
  }
  for (const dir of d.dirs) {
    const n = el("div", "dir", `<span class="ico">▸</span> ${esc(dir.name)}`);
    n.onclick = () => scanDir(dir.path);
    body.appendChild(n);
  }
  const nf = d.fileCount || 0;
  body.appendChild(el("div", "dir", `<span class="ico">▤</span> <span style="color:var(--muted)">此目录含 ${nf} 个日志文件 / ${(d.groups || []).length} 种类型</span>`));
}

function renderQuickRoots(roots) {
  const box = $("quickRoots");
  box.innerHTML = "";
  roots.slice(0, 3).forEach((r) => {
    const b = el("button", "btn", esc(r.length > 26 ? "…" + r.slice(-24) : r));
    b.title = r;
    b.onclick = () => scanDir(r);
    box.appendChild(b);
  });
}

/* ---------------- 导出 ---------------- */
function exportRows() {
  if (!S.rows.length) return;
  const head = `# ${S.cur.typeName} · ${S.rows.length} 条（已按时间合并，最新在前）\r\n`;
  const text = head + S.rows.map((r) =>
    `${fmtFull(r[0])} [${TAG_NAME[r[1]] || r[1]}] ${r[4]}`).join("\r\n");
  const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  const base = `scum_${S.cur.type}_merged`;
  a.href = URL.createObjectURL(blob);
  a.download = `${base}_${S.rows.length}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ---------------- 事件绑定 ---------------- */
function bindUI() {
  const wrap = $("logWrap");
  wrap.addEventListener("scroll", () => requestAnimationFrame(paint), { passive: true });
  window.addEventListener("resize", () => paint());

  wrap.addEventListener("click", (e) => {
    const row = e.target.closest(".row");
    if (row) showDetail(Number(row.dataset.i));
  });

  let t = null;
  $("q").addEventListener("input", () => {
    $("qClear").hidden = !$("q").value;
    clearTimeout(t);
    t = setTimeout(() => query(true), 260);
  });

  $("qClear").onclick = () => { $("q").value = ""; $("qClear").hidden = true; query(true); };
  $("level").onchange = () => query(true);
  $("range").onchange = () => query(true);
  $("loadMore").onclick = () => query(false, S.rows.length);
  $("btnExport").onclick = exportRows;

  $("btnReload").onclick = () => { if (S.cur) open(S.cur); };
  $("btnDir").onclick = openDirModal;
  $("modalClose").onclick = () => ($("modal").hidden = true);
  $("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").hidden = true; });
  $("modalUse").onclick = async () => {
    const d = await api("/api/scan?path=" + encodeURIComponent(modalPath));
    if (d.error) return;
    $("modal").hidden = true;
    setRoot(d.path, d.groups);
  };

  $("chkFollow").onchange = (e) => setFollow(e.target.checked);

  const nz = $("chkNoise");
  if (nz) {
    nz.checked = S.hideNoise;
    nz.onchange = (e) => { S.hideNoise = e.target.checked; query(true); };
  }

  $("btnTheme").onclick = () => {
    const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = cur;
    localStorage.setItem("scumlog-theme", cur);
  };

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); $("q").focus(); }
    if (e.key === "Escape") {
      if (!$("modal").hidden) { $("modal").hidden = true; return; }
      if (document.activeElement === $("q")) { $("q").value = ""; query(true); $("q").blur(); }
    }
    if (e.key === "j" || e.key === "k") {
      if (document.activeElement.tagName === "INPUT") return;
      e.preventDefault();
      const step = e.key === "j" ? 1 : -1;
      const next = Math.min(S.rows.length - 1, Math.max(0, S.selIdx + step));
      if (next >= 0) {
        showDetail(next);
        const y = next * ROW_H;
        if (y < wrap.scrollTop + ROW_H) wrap.scrollTop = y - ROW_H;
        if (y > wrap.scrollTop + wrap.clientHeight - ROW_H * 2) wrap.scrollTop = y - wrap.clientHeight + ROW_H * 2;
      }
    }
  });
}

boot();
