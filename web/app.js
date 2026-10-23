/* ============ SCUM 日志查看器 前端 ============ */

const ROW_H = 34;      // 必须与 style.css 的 --row-h 一致
const PAGE = 3000;

/* ---------------- 各类型的表格列定义 ----------------
   k: 字段名（数组表示按顺序取第一个非空）
   w: 列宽（px 或 1fr）
   cls: 单元格样式
*/
const SCHEMAS = {
  login: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "act", l: "动作", w: "60px", cls: "act" },
      { k: "name", l: "玩家昵称", w: "120px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "ip", l: "IP 地址", w: "128px", cls: "mono" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  kill: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
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
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "name", l: "玩家昵称", w: "130px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "channel", l: "频道", w: "66px", cls: "tagcell" },
      { k: "text", l: "内容", w: "1fr" },
    ],
  },
  admin: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "name", l: "玩家昵称", w: "124px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "cmd", l: "指令 / 内容", w: "1fr", cls: "mono" },
    ],
  },
  vehicle_destruction: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "evt", l: "事件", w: "110px", cls: "tagcell" },
      { k: "veh", l: "载具", w: "170px", cls: "strong" },
      { k: "veh_id", l: "载具 ID", w: "86px", cls: "mono" },
      { k: "owner", l: "车主", w: "120px" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  economy: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "act", l: "行为", w: "80px", cls: "econact" },
      { k: "name", l: "玩家昵称", w: "96px", cls: "strong" },
      { k: "item_txt", l: "交易物品", w: "1.3fr", ph: "—", tip: "这一笔交易里所有物品；一次卖很多件时显示前三种，「等 N 种」表示总数，鼠标悬停或点开行看完整清单" },
      { k: "amount", l: "金额", w: "84px", cls: "econmoney", ph: "—", tip: "这一笔交易的总金额，+ 表示卖出进账、− 表示买入或服务支出" },
      { k: "target", l: "交易对象", w: "1fr", ph: "—", tip: "交易商 / 银行 / 本人账户" },
      { k: "cash", l: "现金", w: "80px", cls: "num dim", ph: "—", tip: "交易完成后玩家身上的现金（钞票）。带 ≈ 的是日志没直接打印、用上一条余额和本次金额算出来的" },
      { k: "bank", l: "银行存款", w: "92px", cls: "num dim", ph: "—", tip: "交易完成后 ATM 卡里的存款，单位 credits，就是存在银行的那部分现金。带 ≈ 的是推算值" },
      { k: "gold", l: "金条", w: "64px", cls: "num dim", ph: "—", tip: "交易完成后身上的金条，日志里写的是 gold。留空的表示这条日志没打印金条" },
    ],
  },
  famepoints: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
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
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "chest", l: "箱子 ID", w: "86px", cls: "mono" },
      { k: "name", l: "归属玩家", w: "124px", cls: "strong" },
      { k: "steam", l: "玩家ID", w: "152px", cls: "mono copy" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  violations: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "evt", l: "事件", w: "140px", cls: "tagcell" },
      { k: "action", l: "违规动作", w: "200px", cls: "mono" },
      { k: "desc", l: "描述", w: "1fr" },
      { k: "pos", l: "位置", w: "190px", cls: "mono dim" },
    ],
  },
  gameplay: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "target", l: "对象", w: "140px", cls: "strong" },
      { k: "state", l: "状态", w: "96px", cls: "tagcell" },
      { k: "ago", l: "发生于", w: "128px", cls: "dim" },
      { k: "pos", l: "位置（X, Y, Z）", w: "1fr", cls: "mono dim" },
    ],
  },
  loot: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "raw", l: "内容", w: "1fr", cls: "mono" },
    ],
  },
  all: {
    cols: [
      { k: "time", l: "时间", w: "142px", cls: "dim" },
      { k: "tag", l: "类型", w: "82px", cls: "tagcell" },
      { k: "evt", l: "事件", w: "110px", cls: "tagcell" },
      { k: "name", l: "玩家", w: "120px", cls: "strong" },
      { k: "raw", l: "内容", w: "1fr" },
    ],
  },
};

// 经济交易：行为配色（钱出去偏红、钱进来偏绿，其余保持中性）
const ECON_OUT = new Set(["购买", "维修服务", "支出", "罚金", "销毁卡片", "销毁物品", "删除卡片", "锁定卡片"]);
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

// 金额千分位：383 -> 383，4711 -> 4,711
function num(v) {
  const n = Number(v);
  if (!isFinite(n)) return v == null ? "" : String(v);
  return n.toLocaleString("en-US");
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
  const qs = new URLSearchParams(location.search);
  // 主题：URL 上带 ?theme=light / dark 时以它为准，否则用上次记住的
  const theme = qs.get("theme") || localStorage.getItem("scumlog-theme") || "dark";
  document.documentElement.dataset.theme = theme;

  bindUI();
  const init = await api("/api/init");
  if (init.version) $("appVer").textContent = "v" + init.version;
  if (init.root) setRoot(init.root, init.groups, qs.get("type") || init.lastType);
  else $("emptyText").textContent = "没找到 SCUM 日志目录，点「打开目录」手动指定";
  if (init.missing) {
    $("emptyText").textContent = "上次打开的目录不在了：" + init.missing + " —— 点「打开目录」重新指定";
  }
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
    if (t === DASH) return openDash();
    const g = t === "all" ? null : S.groups.find((x) => x.type.toLowerCase() === t);
    if (g) return openGroup(g);
  }
  openGroup({ type: ALL, typeName: "全部日志" });
}

/* ---------------- 侧栏：类型按钮（不再列文件） ---------------- */
const ALL = "all";
const DASH = "__dash__";          // 服务器总览大屏（不是一种日志类型）

function dashBtn() {
  const on = S.cur && S.cur.type === DASH;
  const b = el("button", "typebtn all" + (on ? " active" : ""));
  b.style.setProperty("--tc", "var(--cyan)");
  b.innerHTML = `
    <span class="dot" style="background:var(--cyan)"></span>
    <span class="tname">服务器总览</span>
    <span class="trange"></span>
    <span class="tcount">看板</span>`;
  b.title = "一屏看清这台服务器的整体状况";
  b.onclick = () => openDash();
  return b;
}

function typeBtn(g, totalCount) {
  const on = S.cur && S.cur.type === g.type;
  const isAll = g.type === ALL;
  const b = el("button", "typebtn" + (on ? " active" : "") + (isAll ? " all" : "") + (g.hasData ? "" : " dim"));
  const color = isAll ? "var(--c-login)" : tagColor(g.type);
  b.style.setProperty("--tc", color);   // 侧栏左侧色条 / 选中发光用这个类型色
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

  box.appendChild(dashBtn());
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
  if (target.kind === "group" && target.type === DASH) return openDash();
  $("dash").hidden = true;
  $("logPane").hidden = false;
  setView("log");
  S.busy = true;
  S.cur = target;
  // 记住这次看的是哪一类，下次启动（包括换了新版本）直接回到这里
  if (target.kind === "group") {
    api("/api/remember?type=" + encodeURIComponent(target.type)).catch(() => {});
  }
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

/* ---------------- 服务器总览大屏 ---------------- */
async function openDash() {
  if (S.busy) return;
  S.busy = true;
  S.cur = { kind: "group", type: DASH, typeName: "服务器总览" };
  api("/api/remember?type=" + encodeURIComponent(DASH)).catch(() => {});
  renderGroups();
  setView("dash");
  $("logPane").hidden = true;
  $("dash").hidden = false;
  $("dash").innerHTML = '<div class="dash-note">正在汇总…</div>';
  try {
    const d = await api("/api/overview?root=" + encodeURIComponent(S.root) + "&type=" + encodeURIComponent(ALL));
    if (d.error) throw new Error(d.error);
    S.dash = d;
    renderDash(d);
  } catch (e) {
    $("dash").innerHTML = `<div class="dash-note">汇总失败：${esc(e.message)}</div>`;
  } finally {
    S.busy = false;
  }
}

/* 数字滚动：KPI / 指标带的数字从 0 跳到目标值（只动纯文本节点） */
const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

function countUp(root) {
  if (!root || REDUCED_MOTION) return;
  for (const n of root.querySelectorAll(".kv, .sv, .mv")) {
    if (n.children.length) continue;                 // 「12 / 8」这种带分隔符的不动
    const m = n.textContent.trim().match(/^([+\-−]?)([\d,]+)$/);
    if (!m) continue;
    const target = Number(m[2].replace(/,/g, ""));
    if (!isFinite(target) || target === 0) continue;
    const sign = m[1] || "";
    const t0 = performance.now();
    const fmt = (v) => sign + Math.round(v).toLocaleString();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / 850);
      n.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/* KPI 图标：24x24 线稿，跟随卡片主色 */
const KPI_ICON = {
  logs:  '<path d="M4 4h5l1.6 1.8H16v10.4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M7 10h7M7 13h4"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c0-3.2 2.5-5 5.5-5s5.5 1.8 5.5 5"/><path d="M16.5 6.2a3 3 0 0 1 0 5.6M17.5 14.4c1.5.6 2.5 1.9 2.5 3.6"/>',
  door:  '<path d="M13 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7"/><path d="M13 12h4.5l-2-2M17.5 12l-2 2"/><circle cx="14.5" cy="12" r="3.6"/>',
  money: '<path d="M12 3.5c3.6 0 6.5 1.4 6.5 3.2S15.6 10 12 10 5.5 8.5 5.5 6.7 8.4 3.5 12 3.5z"/><path d="M5.5 6.7v10.6c0 1.8 2.9 3.2 6.5 3.2s6.5-1.4 6.5-3.2V6.7"/><path d="M5.5 12c0 1.8 2.9 3.2 6.5 3.2s6.5-1.4 6.5-3.2"/>',
  kill:  '<circle cx="12" cy="12" r="7.2"/><path d="M12 3.4v3M12 17.6v3M3.4 12h3M17.6 12h3"/><circle cx="12" cy="12" r="2"/>',
  risk:  '<path d="M12 3.5 4.6 6.2v5.4c0 4.3 3.1 7.6 7.4 8.9 4.3-1.3 7.4-4.6 7.4-8.9V6.2z"/><path d="M12 9v4M12 15.6v.6"/>',
};

function kpiIcon(name) {
  const d = KPI_ICON[name];
  return d
    ? `<span class="kic"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg></span>`
    : "";
}

function kpi(cls, k, v, sub, unit, icon) {
  return `<div class="kpi ${cls || ""}">
    <span class="kglow"></span><span class="kspin"></span>
    ${kpiIcon(icon)}
    <div class="kb">
      <div class="kk">${esc(k)}</div>
      <div class="kv">${v}${unit ? `<small>${esc(unit)}</small>` : ""}</div>
      <div class="ks">${esc(sub || "")}</div>
    </div></div>`;
}

function rankRow(i, name, val, max, color) {
  const w = max ? Math.max(3, (val / max) * 100) : 0;
  return `<div class="rank-row">
    <span class="rank-i${i < 3 ? " top" : ""}">${i + 1}</span>
    <span class="rank-n" title="${esc(name)}">${esc(name)}</span>
    <span class="rank-bar"><span class="rank-fill" style="width:${w.toFixed(1)}%;background:${color}"></span></span>
    <span class="rank-v">${val.toLocaleString()}</span></div>`;
}

function sparkSvg(trend) {
  const bs = (trend && trend.buckets) || [];
  if (!bs.length) return '<div class="dash-note">没有带时间戳的记录</div>';
  const W = 800, H = 208, PL = 42, PR = 12, PT = 14, PB = 26;
  const iw = W - PL - PR, ih = H - PT - PB;
  const max = Math.max(...bs.map((b) => b.n), 1);
  const px = (i) => PL + (bs.length === 1 ? iw / 2 : (iw * i) / (bs.length - 1));
  const py = (v) => PT + ih * (1 - v / max);

  const line = bs.map((b, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(b.n).toFixed(1)}`).join(" ");
  const area = `${line} L${px(bs.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${px(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`;

  // 网格 + 左侧刻度
  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const v = (max / 3) * g;
    const y = py(v);
    grid += `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W - PR}" y2="${y.toFixed(1)}"/>`
         + `<text class="lbl" x="${PL - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v)}</text>`;
  }

  // X 轴：首 / 中 / 尾
  const pick = bs.length === 1 ? [0] : [0, Math.floor((bs.length - 1) / 2), bs.length - 1];
  let axis = "";
  for (const i of pick) {
    axis += `<text class="lbl" x="${px(i).toFixed(1)}" y="${H - 5}" text-anchor="${
      i === 0 ? "start" : i === bs.length - 1 ? "end" : "middle"}">${
      esc(trend.step === "hour" ? fmtTime(bs[i].t) : fmtDay(bs[i].t))}</text>`;
  }

  // 悬停热区
  const bw = bs.length > 1 ? iw / (bs.length - 1) : iw;
  let hits = "";
  for (let i = 0; i < bs.length; i++) {
    const t = bs[i].t;
    const lbl = trend.step === "hour" ? `${fmtDay(t)} ${fmtTime(t)}` : fmtDay(t);
    hits += `<rect class="hit" x="${(px(i) - bw / 2).toFixed(1)}" y="${PT}" width="${Math.max(bw, 2).toFixed(1)}" height="${ih}"><title>${esc(lbl)} · ${bs[i].n.toLocaleString()} 条</title></rect>`;
  }

  return `<svg class="spark" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--cyan)" stop-opacity=".42"/>
      <stop offset="55%" stop-color="var(--violet)" stop-opacity=".14"/>
      <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
    </linearGradient></defs>
    <g class="grid">${grid}</g>
    <path class="area" d="${area}"/>
    <path class="line" d="${line}" vector-effect="non-scaling-stroke"/>
    ${axis}
    ${hits}
  </svg>`;
}

function renderDash(d) {
  const lv = d.levels || {};
  const err = lv.error || 0;
  const warn = lv.warn || 0;
  const risk = (d.violations || 0) + err;
  const ec = d.economy || {};
  const sizeMb = (d.size || 0) / 1048576;

  const head = `<div class="dash-head">
    <div class="dash-title"><span class="dot"></span>服务器总览</div>
    <div class="dash-sub">${d.first ? `${fmtShort(d.first)} → ${fmtShort(d.last)}` : "无时间戳"}
      · 覆盖 ${d.days || 0} 天 · ${d.fileCount || 0} 个文件 · ${sizeMb.toFixed(1)} MB</div>
    <div class="spacer"></div>
    <button class="btn small" id="dashRefresh">重新汇总</button>
  </div>`;

  const kpis = `<div class="kpis">
    ${kpi("cy", "日志总量", d.logs.toLocaleString(), `${d.days || 0} 天 · ${d.fileCount || 0} 个文件`, "", "logs")}
    ${kpi("vi", "活跃玩家", (d.playerTotal || 0).toLocaleString(), `24 小时内 ${d.active24h || 0} 人活跃`, "人", "users")}
    ${kpi("", "登录 / 登出", `${d.logins || 0}<span class="kv-sep">/</span>${d.logouts || 0}`, "进服次数", "", "door")}
    ${kpi("up", "玩家收入", "+" + (ec.in || 0).toLocaleString(), `${ec.deals || 0} 笔交易 · 支出 ${(ec.out || 0).toLocaleString()}`, "", "money")}
    ${kpi("am", "击杀", (d.kills || 0).toLocaleString(), d.kills ? "有战斗记录" : "暂无击杀记录", "", "kill")}
    ${kpi("dn", "风险告警", risk.toLocaleString(), `违规 ${d.violations || 0} · 错误 ${err}`, "", "risk")}
  </div>`;

  // 类型分布
  const gs = (d.groups || []).slice(0, 8);
  const gmax = Math.max(...gs.map((g) => g.count), 1);
  const groups = `<div class="panel">
    <div class="panel-h"><span class="pt">类型分布</span><span class="ph">点一下跳到该类型</span></div>
    <div class="rank">${gs.map((g, i) => {
      const w = (g.count / gmax) * 100;
      return `<div class="rank-row" data-gtype="${esc(g.type)}" style="cursor:pointer">
        <span class="rank-i${i < 3 ? " top" : ""}">${i + 1}</span>
        <span class="rank-n" title="${esc(g.name)}">${esc(g.name)}</span>
        <span class="rank-bar"><span class="rank-fill" style="width:${w.toFixed(1)}%;background:${tagColor(g.type)}"></span></span>
        <span class="rank-v">${g.count.toLocaleString()}</span></div>`;
    }).join("") || '<div class="dash-note">没有数据</div>'}</div>
  </div>`;

  const trend = `<div class="panel">
    <div class="panel-h"><span class="pt">日志量趋势</span><span class="ph">按${(d.trend && d.trend.step) === "hour" ? "小时" : "天"}统计 · 悬停看具体条数</span></div>
    ${sparkSvg(d.trend)}
  </div>`;

  // 活跃玩家
  const ps = (d.players || []).slice(0, 8);
  const pmax = Math.max(...ps.map((p) => p.count), 1);
  const players = `<div class="panel">
    <div class="panel-h"><span class="pt">活跃玩家</span><span class="ph">按日志出现次数</span></div>
    <div class="rank">${ps.map((p, i) =>
      rankRow(i, p.name || p.id, p.count, pmax, "var(--c-login)")).join("") || '<div class="dash-note">没有数据</div>'}</div>
  </div>`;

  // 经济
  const econ = `<div class="panel">
    <div class="panel-h"><span class="pt">经济流水</span><span class="ph">${ec.deals || 0} 笔</span></div>
    <div class="money">
      <div class="money-cell"><div class="mk">卖出收入</div><div class="mv in">+${(ec.in || 0).toLocaleString()}</div></div>
      <div class="money-cell"><div class="mk">买入 / 服务支出</div><div class="mv out">-${(ec.out || 0).toLocaleString()}</div></div>
    </div>
    <div class="panel-h" style="margin:2px 0 7px"><span class="ph">交易商热度</span></div>
    <div class="rank">${(ec.top || []).map((t, i) =>
      rankRow(i, t.k, t.v, Math.max(...(ec.top || [{ v: 1 }]).map((x) => x.v), 1), "var(--c-economy)")).join("")
      || '<div class="dash-note">这段时间没有交易</div>'}</div>
  </div>`;

  // 交易物品
  const items = `<div class="panel">
    <div class="panel-h"><span class="pt">交易热点</span><span class="ph">按数量</span></div>
    <div class="tags">${(ec.items || []).map((t) =>
      `<span class="tagx">${esc(t.k)} <b>${t.v.toLocaleString()}</b></span>`).join("")
      || '<span class="dash-note">这段时间没有交易物品</span>'}</div>
    <div class="dash-note" style="margin-top:11px">
      现金、银行存款、金条是三笔独立的钱，详细的逐笔明细在左侧「经济交易」。
    </div>
  </div>`;

  $("dash").innerHTML = head + kpis +
    `<div class="panels">${trend}${groups}</div>` +
    `<div class="panels-3">${players}${econ}${items}</div>`;

  $("dashRefresh").onclick = () => openDash();
  countUp($("dash"));
  for (const row of $("dash").querySelectorAll("[data-gtype]")) {
    row.onclick = () => {
      const g = S.groups.find((x) => x.type === row.dataset.gtype);
      if (g) openGroup(g);
    };
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
  head.innerHTML = sc.cols.map((c) => `<span class="tc"${c.tip ? ` title="${esc(c.tip)}"` : ""}>${c.l}</span>`).join("");
  $("logView").style.setProperty("--cols", css);
}

function applyMeta(meta) {
  S.meta = meta;
  renderStatBar();
  renderTypeBars();
  renderPlayers();
  renderChips();
}

/* 看板独占整屏（收起右栏），日志页保留右栏做筛选和详情 */
function setView(v) {
  const m = document.querySelector("main");
  if (m) m.dataset.view = v;
}

/* ---------------- 日志页顶部指标带 ---------------- */
function renderStatBar() {
  const m = S.meta;
  const box = $("statBar");
  if (!m) { box.innerHTML = ""; return; }
  const lv = (m.stats && m.stats.levels) || {};
  const err = lv.error || 0;
  const warn = lv.warn || 0;
  const range = m.first ? `${fmtShort(m.first)} → ${fmtShort(m.last)}` : "无时间戳";
  const stat = (k, v, cls, wide) =>
    `<div class="stat${wide ? " wide" : ""}"><div class="sk">${esc(k)}</div><div class="sv ${cls || ""}">${v}</div></div>`;

  box.innerHTML =
    stat("当前视图", esc(m.typeName || "—"), "dim") +
    stat("记录条数", (m.count || 0).toLocaleString()) +
    stat("覆盖天数", (m.days || 0) + " 天") +
    stat("涉及玩家", (m.playerTotal || (m.players || []).length || 0).toLocaleString()) +
    stat("错误 / 警告", `${err} / ${warn}`, err ? "err" : "") +
    stat("时间范围", esc(range), "dim", true);

  countUp(box);
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
  const raw = cellVal(r, c.k);
  const v = raw || c.ph || "";
  const f = r[9] || {};
  let style = "";
  if (c.cls === "act") {
    style = ` style="color:${v === "登出" ? "var(--c-logout)" : "var(--c-login)"}"`;
  } else if (c.k === "tag") {
    style = ` style="color:${tagColor(r[1])}"`;
  }
  let cls = c.cls || "";
  if (c.k === "tag") cls = "tagpill";       // 类型列做成 pill，跟着类型色走
  if (cls === "econact") cls = ECON_OUT.has(v) ? "econout" : ECON_IN.has(v) ? "econin" : "";
  if (cls === "econmoney") {
    const d = f.dir;
    cls = d === "in" ? "econin" : d === "out" ? "econout" : "num";
  }
  // 物品列悬停时给出完整清单，比列宽里那几个字有用
  const tipTxt = c.k === "item_txt" && f.tip ? f.tip : (raw && raw.length > 8 ? raw : "");
  const tip = tipTxt ? ` title="${esc(tipTxt)}"` : "";
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
  if (S.cur && S.cur.type === "economy") {
    // 表格里省掉的账号、物品原名放到这里，既不挤列宽也不丢信息
    if (f.account) {
      lines.push(`<div class="dr"><span class="dk">银行账号</span><span class="dv cp" data-copy="${esc(f.account)}">${esc(f.account)}</span></div>`);
    }
    if (f.items && f.items.length) {
      const li = f.items.map((it) =>
        `${esc(it.n)}${it.q > 1 ? ` ×${it.q}` : ""}${it.c ? `<span class="econdim">（${esc(it.c)}）</span>` : ""}` +
        `<span class="econdim"> — ${esc(num(it.p))}</span>`).join("<br>");
      lines.push(`<div class="dr"><span class="dk">物品明细</span><span class="dv">${li}</span></div>`);
      lines.push(`<div class="dr"><span class="dk">合计</span><span class="dv">${f.items.length} 种 · ${esc(f.amount || "")}</span></div>`);
    } else if (f.item && f.item !== f.item_txt) {
      const q = f.qty ? ` ×${esc(f.qty)}` : "";
      lines.push(`<div class="dr"><span class="dk">物品原名</span><span class="dv" style="font-family:ui-monospace,Consolas,monospace">${esc(f.item)}${q}</span></div>`);
    }
    if (f.note) {
      lines.push(`<div class="dr"><span class="dk">备注</span><span class="dv" style="color:var(--muted)">${esc(f.note)}</span></div>`);
    }
    if (f.funds) {
      lines.push(`<div class="dr"><span class="dk">交易商资金</span><span class="dv">${esc(f.funds)}</span></div>`);
    }
    if (f.gold !== undefined && f.gold !== null && f.gold !== "") {
      lines.push(`<div class="dr"><span class="dk">金条</span><span class="dv">${esc(f.gold)}</span></div>`);
    }
    if (f.peer_steam) {
      lines.push(`<div class="dr"><span class="dk">对方 SteamID</span><span class="dv cp" data-copy="${esc(f.peer_steam)}">${esc(f.peer_steam)}</span></div>`);
    }
    if (!f.cash && !f.bank) {
      lines.push(`<div class="dr"><span class="dk">余额</span><span class="dv" style="color:var(--muted)">这条日志没打印交易后余额</span></div>`);
    }
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
  if (f.lines && f.lines.length > 1) {
    lines.push(`<div class="dr"><span class="dk">原始日志</span><span class="dv" style="color:var(--muted)">这一笔交易合并了 ${f.lines.length} 行原始记录</span></div>`);
    lines.push(`<div class="dmsg">${f.lines.map((x) => esc(x)).join("<br>")}</div>`);
  } else {
    lines.push(`<div class="dmsg">${esc(msg)}</div>`);
  }
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

  /* 鼠标跟随光晕：光标在卡片里移动时，把位置写进 CSS 变量给光晕用 */
  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest && e.target.closest(".kpi, .panel, .stat");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
    card.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
  }, { passive: true });

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
