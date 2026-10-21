# -*- coding: utf-8 -*-
"""
SCUM 服务器日志查看器 —— 本地版后端（零第三方依赖）

特点：
  * 自动识别 UTF-16LE（无 BOM）/ UTF-16 BOM / UTF-8
  * 按文件名类型分组，把同类型不同日期的日志合并成一条时间线
  * 单文件与合并视图共用一套查询/筛选

用法：
    python app.py                 # 自动探测日志目录并打开浏览器
    python app.py --path "D:\\SCUM\\Saved\\SaveFiles\\Logs"
    python app.py --port 9000 --no-browser
"""

import argparse
import calendar
import json
import os
import re
import socket
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

VERSION = "0.1.7"

BASE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(BASE, "web")


def _cfg_dir():
    """配置放在用户目录，跟着人走、不跟着程序目录走。

    换版本时程序会解压到新的文件夹，如果配置写在程序目录里，
    上次打开的日志目录就跟着旧目录一起被丢下了，每次都得重新选。
    """
    for env in ("LOCALAPPDATA", "APPDATA"):
        d = os.environ.get(env)
        if d and os.path.isdir(d):
            return os.path.join(d, "SCUMLogViewer")
    return os.path.join(os.path.expanduser("~"), ".scum-log-viewer")


CFG = os.path.join(_cfg_dir(), "config.json")
CFG_OLD = os.path.join(BASE, "config.json")        # 老版本把配置写在程序目录里

MAX_BYTES = 120 * 1024 * 1024      # 单文件最多读取 120MB（超出取尾部）
MAX_LINES = 400000                 # 合并后最多保留 40 万行（超出取最新的）
TAIL_BYTES = 3 * 1024 * 1024       # 大文件先只读尾部 3MB 秒开
MAX_CACHE = 6                      # 最多缓存几组解析结果

# ---------------------------------------------------------------- 日志类型

LOG_TYPES = {
    "admin": "管理员指令",
    "login": "登录登出",
    "chat": "聊天",
    "kill": "击杀",
    "event_kill": "活动击杀",
    "violations": "违规检测",
    "violation": "违规检测",
    "economy": "经济交易",
    "famepoints": "声望变动",
    "fame": "声望变动",
    "loot": "物资刷新",
    "quests": "任务",
    "quest": "任务",
    "raid_protection": "抄家保护",
    "raid": "抄家保护",
    "vehicle_destruction": "载具销毁",
    "vehicle": "载具",
    "vehicles": "载具",
    "base_building_destruction": "建筑被拆",
    "building": "建筑",
    "buildings": "建筑",
    "chest_ownership": "箱子归属",
    "chest": "箱子归属",
    "armor_absorption": "护甲吸收",
    "sentry": "哨戒炮",
    "gameplay": "玩法记录",
    "network_objects": "网络对象",
    "server_notifications": "服务器公告",
    "scum": "引擎输出",
    "init": "引擎输出",
    "log": "其他",
}

# 侧栏排序：常看的类型排前面
TYPE_ORDER = [
    "login", "kill", "chat", "admin", "violations", "economy",
    "vehicle_destruction", "base_building_destruction", "raid_protection",
    "quests", "famepoints", "loot", "chest_ownership", "sentry",
    "armor_absorption", "gameplay", "server_notifications", "network_objects",
    "event_kill", "log",
]

_PREFIX_LIST = sorted(LOG_TYPES.keys(), key=len, reverse=True)


def guess_type(filename):
    """从文件名猜日志类型，如 login_20261018100021.log -> login"""
    stem = os.path.splitext(os.path.basename(filename))[0].lower()
    stem = re.sub(r"[^a-z0-9_\-]", "_", stem)
    for key in _PREFIX_LIST:
        if stem == key or stem.startswith(key + "_") or stem.startswith(key + "-"):
            return key
    for key in _PREFIX_LIST:
        if key in stem:
            return key
    return "log"


ALL_TYPE = "all"          # 虚拟类型：所有日志合成一条时间线


def type_name(t):
    if t == ALL_TYPE:
        return "全部日志"
    return LOG_TYPES.get(t, t)


def file_stamp(name, fallback=0):
    """从文件名里的 14 位时间戳（滚动起始时间）算出毫秒时间"""
    m = re.search(r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})", name)
    if m:
        y, mo, d, h, mi, s = (int(x) for x in m.groups())
        try:
            return calendar.timegm((y, mo, d, h, mi, s, 0, 0, 0)) * 1000 - LOG_TZ_OFFSET * 60000
        except (ValueError, OverflowError):
            return fallback
    return fallback


# ---------------------------------------------------------------- 目录探测

def guess_log_dir(path):
    """把任意路径（服务器根 / Saved / SaveFiles / Logs / 某日志文件）规整到日志目录"""
    path = os.path.abspath(path)
    if os.path.isfile(path):
        return os.path.dirname(path)
    cands = [
        path,
        os.path.join(path, "Logs"),
        os.path.join(path, "SaveFiles", "Logs"),
        os.path.join(path, "Saved", "SaveFiles", "Logs"),
    ]
    for c in cands:
        if os.path.isdir(c):
            return c
    return path


def steam_roots():
    """尝试找常见的 SCUM 日志目录（Steam 安装位置）"""
    roots = []
    steam = None
    try:
        import winreg
        for hive, key, val in ((winreg.HKEY_CURRENT_USER, r"Software\Valve\Steam", "SteamPath"),
                               (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam", "InstallPath")):
            try:
                with winreg.OpenKey(hive, key) as k:
                    v, _ = winreg.QueryValueEx(k, val)
                    if v:
                        steam = v
                        break
            except OSError:
                continue
    except Exception:
        pass

    libs = []
    if steam:
        libs.append(steam)
        vdf = os.path.join(steam, "steamapps", "libraryfolders.vdf")
        if os.path.isfile(vdf):
            try:
                with open(vdf, "r", encoding="utf-8", errors="replace") as f:
                    for m in re.finditer(r'"path"\s+"([^"]+)"', f.read()):
                        libs.append(m.group(1).replace("\\\\", "\\"))
            except OSError:
                pass

    for d in "CDEFGH":
        for sub in ("Program Files (x86)\\Steam", "Program Files\\Steam", "Steam", "SteamLibrary"):
            libs.append(f"{d}:\\{sub}")

    for lib in libs:
        p = os.path.join(lib, "steamapps", "common", "SCUM", "SCUM", "Saved", "SaveFiles", "Logs")
        if os.path.isdir(p) and p not in roots:
            roots.append(p)
    return roots


def load_cfg():
    """先读用户目录的配置；没有就找老版本留在程序目录里的，顺手搬过来"""
    for path in (CFG, CFG_OLD):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        if path == CFG_OLD and not os.path.exists(CFG):
            save_cfg(data)
        return data
    return {}


def save_cfg(data):
    try:
        d = os.path.dirname(CFG)
        if d:
            os.makedirs(d, exist_ok=True)
        tmp = CFG + ".tmp"          # 先写临时文件再替换，断电不会留下半截配置
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, CFG)
    except OSError:
        pass


def remember(**kw):
    """记住这次的打开位置，下次启动直接用"""
    cfg = load_cfg()
    cfg.update({k: v for k, v in kw.items() if v is not None})
    save_cfg(cfg)


def default_candidates():
    out = []

    def add(p):
        if p and os.path.isdir(p) and p not in out:
            out.append(p)

    add(load_cfg().get("last_root"))
    add(BASE)
    for p in steam_roots():
        add(p)
    return out


# ---------------------------------------------------------------- 编码与读取

# SCUM 的日志时间戳（行首时间、文件名里的滚动起始时间）都是 UTC，且不带时区标记。
# 这里统一按 UTC 换算成 epoch 毫秒，前端 new Date() 再显示成本机时区的时间。
# 实测依据：文件最后一条记录 22:00:49 时，文件的修改时间是次日 06:00:49（东八区），恰好差 8 小时。
# 万一将来某版日志改成本地时间，把这里改成对应分钟偏移即可（东八区 = 480）。
LOG_TZ_OFFSET = 0


def detect_enc(head):
    """识别编码：SCUM 的日志是无 BOM 的 UTF-16LE，也兼容别的写法"""
    if len(head) >= 2:
        if head[:2] == b"\xff\xfe":
            return "utf-16"
        if head[:2] == b"\xfe\xff":
            return "utf-16"
    if head[:3] == b"\xef\xbb\xbf":
        return "utf-8-sig"
    if len(head) >= 4:
        nul = head.count(0)
        if nul > len(head) * 0.25:
            return "utf-16-be" if head[0] == 0 else "utf-16-le"
    return "utf-8"


def _nl(enc):
    return {"utf-16-le": b"\n\x00", "utf-16-be": b"\x00\n", "utf-16": b"\n\x00"}.get(enc, b"\n")


def read_file_text(path, limit=None):
    """读取整个文件（大文件取尾部），返回 (text, truncated)"""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        enc = detect_enc(f.read(4096))
        truncated = False
        if limit and size > limit:
            off = size - limit
            if enc.startswith("utf-16") and off % 2:
                off += 1
            f.seek(off)
            data = f.read()
            truncated = True
            nl = data.find(_nl(enc))
            if nl >= 0:                      # 丢掉被切断的第一行残片
                data = data[nl + len(_nl(enc)):]
        else:
            f.seek(0)
            data = f.read()
    if enc.startswith("utf-16") and len(data) % 2:
        data = data[:-1]
    return data.decode(enc, errors="replace"), truncated


# ---------------------------------------------------------------- 行解析

# 例：2026.10.18-11.59.09: '203.0.113.45 7656...:Player01(1)' logged in at: X=..
# 兼容：2026-10-18 11:59:09.123 [ 9936]LogSCUM: ...
RE_TS = re.compile(
    r"^\[?(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})[-_ T](\d{1,2})[.:](\d{2})[.:](\d{2})(?:[.:](\d{1,3}))?"
    r"\s*\]?(.*)$"
)
RE_FRAME = re.compile(r"^\s*\[\s*\d+\s*\]\s*")
RE_CAT = re.compile(r"^(?:\[([A-Za-z][A-Za-z0-9_ ]{1,40})\]|(Log[A-Za-z0-9_]{1,30}))\s*[:：]?\s*")
RE_IP = re.compile(r"(?<![\d.])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\d.])")
RE_STEAM = re.compile(r"(?<!\d)(7656\d{13})(?!\d)")
RE_NAME_AFTER = re.compile(r"7656\d{13}\s*:\s*([^\s()':,]{1,32})\s*\(")
RE_NAME_BEFORE = re.compile(r"([^\s,()':]{1,32})\s*\(\s*(?:ID\s*:\s*)?7656\d{13}\s*\)")
RE_NAME_PAREN = re.compile(r"7656\d{13}\s*\(\s*(?:\d+\s*,\s*)?([^()]{1,32})\)")

# 纯噪声：每个文件开头都会重复一遍
RE_HEADER = re.compile(r"^(Game version\s*:|-{5,}\s*$)")
RE_SEP = re.compile(r"^-{5,}\s*$")

_EPOCH = {}
_SYM = {}
_ERR_WORDS = ("error", "exception", "fail", "crash", "fatal", "critical", "traceback")


def _sym(v):
    if not v:
        return ""
    got = _SYM.get(v)
    if got is None:
        _SYM[v] = v
        return v
    return got


def _epoch(y, mo, d, h, mi, s):
    key = (y, mo, d, h, mi, s)
    v = _EPOCH.get(key)
    if v is None:
        try:
            v = calendar.timegm((y, mo, d, h, mi, s, 0, 0, 0)) - LOG_TZ_OFFSET * 60
        except (ValueError, OverflowError):
            return None
        if len(_EPOCH) < 500000:
            _EPOCH[key] = v
    return v


def _valid_ip(s):
    parts = s.split(".")
    if len(parts) != 4:
        return False
    for p in parts:
        if not p.isdigit() or len(p) > 3 or int(p) > 255:
            return False
    return True


def _extract_ip(msg, steam):
    """登录日志里 IP 紧挨在 SteamID 前面；其它情况找 'IP:' 标签"""
    if steam:
        k = msg.find(steam)
        if k > 0:
            m = RE_IP.search(msg[max(0, k - 24):k])
            if m and _valid_ip(m.group(1)):
                return m.group(1)
    for key in ("IP:", "IP ", "ip:", "ip="):
        k = msg.find(key)
        if k < 0:
            continue
        seg = msg[k + len(key):k + len(key) + 34].lstrip(": =[]")
        cand = seg.split(" ")[0].split(",")[0].split(";")[0].split(":")[0]
        if _valid_ip(cand):
            return cand
    return ""


def parse_line(line):
    """解析一行 -> (ts, level, cat, msg, steam, name, ip)，空行/噪声返回 None"""
    raw = line.strip()
    if not raw:
        return None

    ts = None
    rest = raw
    m = RE_TS.match(raw)
    if m:
        y, mo, d, h, mi, s, ms = m.groups()[:7]
        rest = m.group(8)
        sec = _epoch(int(y), int(mo), int(d), int(h), int(mi), int(s))
        if sec is not None:
            ts = sec * 1000 + (int(ms) * (10 ** (3 - len(ms))) if ms else 0)
        rest = rest.lstrip("]").lstrip()
        rest = RE_FRAME.sub("", rest)
        rest = rest.lstrip(":：").lstrip()

    if not rest:
        return None
    if RE_HEADER.match(rest):
        # 纯噪声，但时间戳要留作续行锚点；分隔线表示下一条是新记录
        return ("SKIP", ts, bool(RE_SEP.match(rest)))

    cat = ""
    cm = RE_CAT.match(rest)
    if cm:
        cat = cm.group(1) or cm.group(2) or ""
        rest = rest[cm.end():].lstrip()
    # 引擎日志里大量 "Log: xxx"，这个前缀没有信息量
    if rest[:4] == "Log:":
        rest = rest[4:].lstrip()
    if not rest:
        rest = cat
        cat = ""

    low = rest.lower()
    if ("error" in low or "exception" in low or "fail" in low or "crash" in low
            or "fatal" in low or "critical" in low or "traceback" in low):
        lvl = "error"
    elif "warn" in low:
        lvl = "warn"
    else:
        lvl = "info"

    steam = ""
    k = rest.find("7656")
    if k >= 0:
        seg = rest[k:k + 17]
        if len(seg) == 17 and seg.isdigit():
            steam = seg

    name = ""
    if steam:
        nm = RE_NAME_AFTER.search(rest) or RE_NAME_BEFORE.search(rest) or RE_NAME_PAREN.search(rest)
        if nm:
            name = nm.group(1).strip()

    ip = _extract_ip(rest, steam)
    return (ts, _sym(lvl), _sym(cat), rest, steam, _sym(name), ip)


# ---------------------------------------------------------------- 结构化字段（表格化）
# 行里已有 tag / msg / steam / name / ip，这里按类型再拆出可成列的信息

RE_LOGIN_LINE = re.compile(
    r"^'?(\d{1,3}(?:\.\d{1,3}){3})\s+(7656\d{13}):([^(]*)\((\d+)\)'?\s+logged\s+(in|out)", re.I)
RE_CHAT_LINE = re.compile(r"^'?(\d{17}):([^(]*)\((\d+)\)'?\s*'([^:']{1,12}):\s*(.*?)'?$")
RE_ADMIN_LINE = re.compile(r"^'?(\d{17}):([^(]*)\((\d+)\)'?\s+Command:\s*'?(.*?)'?$")
RE_XYZ = re.compile(r"X=(-?\d+(?:\.\d+)?)\s*Y=(-?\d+(?:\.\d+)?)\s*Z=(-?\d+(?:\.\d+)?)")
RE_VEH_LINE = re.compile(
    r"^([A-Za-z0-9_]+)\.\s*VehicleId:\s*(\d+)\.\s*Owner:\s*([^.]+)\.\s*Location:\s*(.+)$")
RE_FAME_LINE = re.compile(
    r"^Player\s+(.+?)\((\d{17})\)\s+was awarded\s+(-?[\d.]+)\s+fame points in\s+(.+?)\s+for a total of\s+(-?[\d.]+)")
RE_FAME_DETAIL = re.compile(r"^([A-Za-z][A-Za-z0-9_ ]+):\s*(-?[\d.]+)$")
RE_CHEST_LINE = re.compile(
    r"entity id:\s*(\d+).*?Owner:\s*(7656\d{13})\s*\(\s*\d*\s*,?\s*([^)]*)\)")
# ---------------------------------------------------------------- 经济交易
# 一次「找交易商卖一背包货」在原始日志里会刷出几十行：每件物品一行，
# 末尾再补两行 Before / After 给出现金和银行余额：
#   [Trade] Tradeable (Drill (health: 70.66, uses: 1)) sold by 玩家(7656…) for 383 … to trader Z_3_Trader …
#   [Trade] Before selling tradeables to trader Z_3_Trader, player 玩家(7656…) had 0 cash, -250 account balance …
#   [Trade] After tradeable sale to trader Z_3_Trader, player 玩家(7656…) has 383 cash, -250 account balance …
# 所以这里不按“一行一条”展示，而是把同一笔交易的若干行合成一行。

RE_ECON_TRADE = re.compile(
    r"Tradeable\s+\((?P<what>.+?)\)\s+(?P<way>sold\s+by|purchased\s+by)\s+"
    r"(?P<name>.+?)\s*\((?:ID:)?(?P<steam>\d{17})\)\s+for\s+(?P<price>-?\d[\d,]*)", re.I)
RE_ECON_TRADER = re.compile(r"\b(?:to|from)\s+trader\s+(?P<t>[A-Za-z0-9_]+)", re.I)
RE_ECON_STATE = re.compile(
    r"player\s+(?P<name>.+?)\s*\((?:ID:)?(?P<steam>\d{17})\)\s+(?:had|has)\s+"
    r"(?P<cash>-?\d[\d,]*)\s+cash,\s*(?P<bank>-?\d[\d,]*)\s+(?:(?:bank\s+)?account\s+)?balance\s+and\s+"
    r"(?P<gold>-?\d[\d,]*)\s+gold\s+and\s+trader\s+(?:had|has)\s+(?P<funds>-?\d[\d,]*)",
    re.I)
RE_ECON_SVC = re.compile(
    r"Service\s+\((?P<what>.+?)\)\s+purchased\s+by\s+(?P<name>.+?)\s*"
    r"\((?:ID:)?(?P<steam>\d{17})\)\s+for\s+(?P<price>-?\d[\d,]*)", re.I)
RE_ECON_DEP = re.compile(
    r"\bdeposited\s+(?P<amt>-?\d[\d,]*)\s*(?:\(\s*(?P<real>-?\d[\d,]*)\s+was\s+added\s*\))?",
    re.I)
RE_ECON_WD = re.compile(r"\bwithdr[ae]w\w*\s+(?P<amt>-?\d[\d,]*)", re.I)
RE_ECON_NEWBAL = re.compile(r"new\s+account\s+balance\s+is\s+(?P<b>-?\d[\d,]*)", re.I)
RE_ECON_CARD = re.compile(
    r"\b(?P<op>purchased|created|issued|destroyed|deleted|locked|unlocked)\s+"
    r"(?:a|an|the)?\s*(?P<card>[A-Za-z]{2,12}\s+card)\b", re.I)
RE_ECON_ACCNO = re.compile(r"Account\s*Number\s*:?\s*(?P<acc>\d{6,})", re.I)
RE_ECON_BAL = re.compile(r"\bbalance\b[^0-9\-]{0,12}(-?\d[\d,]*)", re.I)
RE_ECON_AMT = re.compile(
    r"\b(?:for|amount|value|price|sum|cost|fee|total|paid|received|spent|earned|"
    r"gained|reward|bonus|refund|fine)\b\s*[:=]?\s*(-?\d[\d,]*)", re.I)

# 认不出的经济行按关键词粗归一类，从上到下第一条命中即用
ECON_RULES = (
    (re.compile(r"\bwithdr[ae]w\w*", re.I), "取款"),
    (re.compile(r"\btransferr?\w*", re.I), "转账"),
    (re.compile(r"\b(paid\s+off|repay\w*)", re.I), "还款"),
    (re.compile(r"\b(loan|borrow)\w*", re.I), "贷款"),
    (re.compile(r"\bpurchas\w*|\bbought\b", re.I), "购买"),
    (re.compile(r"\b(fine|penalt)\w*", re.I), "罚金"),
    (re.compile(r"\b(reward|bonus)\w*", re.I), "奖励"),
    (re.compile(r"\b(refund|reimburse)\w*", re.I), "退款"),
    (re.compile(r"\b(destroy|remov|delet)\w*", re.I), "销毁物品"),
)

# 交易商编号 -> 中文：A_0_Armory -> A0 军械商
TRADER_KIND = {
    "trader": "杂货商", "general": "杂货商", "armory": "军械商", "mechanic": "技工",
    "saloon": "酒保", "doctor": "医生", "hunter": "猎人", "fisherman": "渔夫",
    "barber": "理发师", "bank": "银行", "airdrop": "空投商",
}

# 物品内部名 -> 中文。表里没有的把下划线换成空格原样显示，不硬翻
ITEM_ZH = {
    # 工具 / 杂物
    "Drill": "电钻",
    "Rebar_Cutter": "钢筋剪",
    "Bolt_Cutter": "断线钳",
    "Screwdriver": "螺丝刀",
    "Wrench": "扳手",
    "Hammer": "锤子",
    "Sledgehammer": "大锤",
    "Shovel": "铲子",
    "Pickaxe": "镐",
    "Axe": "斧头",
    "1H_Cleaver": "剁骨刀",
    "1H_Scalpel": "解剖刀",
    "1H_Kitchen_Knife": "菜刀",
    "1H_Military_Survival_Knife": "军用求生刀",
    "2H_Machete": "开山刀",
    "GasLantern": "煤油灯",
    "GasMask": "防毒面具",
    "Radio": "收音机",
    "Smartphone": "手机",
    "Smartphone_Battery": "手机电池",
    "Geiger_Counter_Analogue": "指针盖革计数器",
    "Geiger_Counter_Digital": "数字盖革计数器",
    "Thread": "线",
    "Wire": "铁丝",
    "Rope": "绳子",
    "Duct_Tape": "胶带",
    "Mine_01": "地雷",
    "CD_Player": "音乐 CD",
    # 弹药
    "Cal_9mm": "9mm 子弹",
    "Cal_9mm_TR": "9mm 训练弹",
    "Cal_22": ".22 子弹",
    "Cal_38": ".38 子弹",
    "Cal_38_TR": ".38 训练弹",
    "Cal_357_Viper": ".357 Viper 子弹",
    "Cal_44_Viper": ".44 Viper 子弹",
    "Cal_338": ".338 子弹",
    "Cal_338_TR": ".338 训练弹",
    "Cal_5_45x39mm": "5.45×39mm 子弹",
    "Cal_7_62x39mm": "7.62×39mm 子弹",
    "Cal_7_62x39mm_Ammobox": "7.62×39mm 弹药盒",
    "12_Gauge_Buckshot": "12 号霰弹",
    "12_Gauge_Slug": "12 号独头弹",
    "12_Gauge_Slug_Ammobox": "12 号独头弹盒",
    # 弹匣 / 枪械配件
    "Magazine_AK47": "AK47 弹匣",
    "Magazine_M16": "M16 弹匣",
    "Magazine_M1911": "M1911 弹匣",
    "Magazine_Block21": "Block21 弹匣",
    "WeaponSuppressor_AK15": "AK15 消音器",
    "WeaponScope_ACOG_01": "ACOG 瞄准镜",
    "WeaponScope_Hunter_35": "猎人 35 瞄准镜",
    "WeaponFlashlight_DesertEagle": "沙鹰手电",
    "Police_Handgun_Holster": "警用手枪枪套",
    # 装备 / 载具件
    "Armor_Police_Vest_01": "警用防弹衣",
    "Military_Helmet_01_02": "军用头盔",
    "Military_Goggles_01": "军用护目镜",
    "Military_Boots_01": "军靴",
    "Dirtbike_Body_Item": "越野摩托 车架",
    "Cruiser_Seat_Rear_Item": "巡航摩托 后座",
    "Rager_Lights_RearRight": "Rager 后右车灯",
    "Rager_Lights_RearLeft": "Rager 后左车灯",
    "Rager_Bumper_Front_C": "Rager 前保险杠",
    "BPC_Rager_Bumper_Front_C": "Rager 前保险杠 C",
    "BPC_Rager_Body_Front_C": "Rager 前车身 C",
    # 吃喝
    "Whiskey": "威士忌",
    "Can01": "罐头",
    "Can04": "罐头",
    "Water": "水",
    "Apple": "苹果",
    "Potato": "土豆",
}

CARD_ZH = {
    "starter": "新手卡", "classic": "经典卡", "bronze": "铜卡", "silver": "银卡",
    "gold": "金卡", "platinum": "铂金卡", "banker": "银行家卡", "black": "黑卡",
}

CARD_ACT = {
    "purchased": "开卡", "created": "开卡", "issued": "开卡",
    "destroyed": "销毁卡片", "deleted": "删除卡片",
    "locked": "锁定卡片", "unlocked": "解锁卡片",
}

# 动作 -> 交易对象兜底说明（不编造具体对象）
CARD_OBJ = {
    "开卡": "本人账户", "销毁卡片": "原账户", "删除卡片": "原账户",
    "锁定卡片": "本人账户", "解锁卡片": "本人账户",
}

# 开卡工本费：日志不打印，靠开卡前后的现金/余额差额反推得出
CARD_FEE = 100


def _int_of(raw):
    """'1,234' -> 1234；解析不了返回 None"""
    try:
        return int(float((raw or "").replace(",", "")))
    except (TypeError, ValueError):
        return None


def _money(v):
    if v is None:
        return ""
    return ("-" if v < 0 else "") + "{:,}".format(abs(int(v)))


def _trader_zh(raw):
    """A_0_Armory -> A0 军械商"""
    if not raw:
        return ""
    m = re.match(r"^([A-Za-z])_?(\d+)_([A-Za-z]+)$", raw)
    if m:
        kind = TRADER_KIND.get(m.group(3).lower(), m.group(3))
        return "%s%s %s" % (m.group(1).upper(), m.group(2), kind)
    return TRADER_KIND.get(raw.lower(), raw)


def _split_item(what):
    """'Drill (health: 70.66, uses: 1)' -> ('Drill', 'health: 70.66, uses: 1')"""
    what = (what or "").strip()
    k = what.rfind(" (")
    if k > 0 and what.endswith(")"):
        return what[:k].strip(), what[k + 2:-1]
    return what, ""


def _item_qc(attrs):
    """属性串里取数量和状态：stack count / xN / health / filled percentage"""
    qty, cond = 1, ""
    m = (re.search(r"stack\s*count\s*:\s*(\d+)", attrs, re.I)
         or re.match(r"\s*x\s*(\d+)\s*$", attrs, re.I))
    if m:
        qty = max(1, int(m.group(1)))
    m = re.search(r"health\s*:\s*([\d.]+)", attrs, re.I)
    if m:
        cond = "耐久 %g%%" % float(m.group(1))
    else:
        m = re.search(r"filled\s+percentage\s*:\s*([\d.]+)", attrs, re.I)
        if m:
            cond = "剩 %g%%" % float(m.group(1))
    return qty, cond


def _item_zh(raw):
    raw = (raw or "").strip()
    if not raw:
        return ""
    if raw in ITEM_ZH:
        return ITEM_ZH[raw]
    low = raw.lower()
    if low.startswith("repair attachment "):
        return _item_zh(raw[18:]) + " 维修件"
    if low.endswith(" card"):
        head = low[:-5].strip()
        if head in CARD_ZH:
            return CARD_ZH[head]
    return re.sub(r"_+", " ", raw).strip()


def _econ_trade_new(ev):
    """一笔交易的第一件物品：建行"""
    f = {
        "name": ev["name"], "steam": ev["steam"],
        "act": "出售" if ev["way"] == "sell" else "购买",
        "dir": "in" if ev["way"] == "sell" else "out",
        "target": ev["trader"] or "交易商",
        "items": [], "lines": [], "pos": ev["pos"],
    }
    _econ_trade_add(f, ev)
    return f


def _econ_trade_add(f, ev):
    """把同一笔交易里的下一件物品累加进来，顺带重算金额和物品文案"""
    raw, attrs = _split_item(ev["what"])
    qty, cond = _item_qc(attrs)
    price = ev["price"] or 0
    f["lines"].append(ev["txt"])
    for it in f["items"]:
        if it["raw"] == raw:
            it["q"] += qty
            it["p"] += price
            break
    else:
        f["items"].append({"raw": raw, "n": _item_zh(raw), "q": qty,
                           "p": price, "c": cond})

    total = sum(it["p"] for it in f["items"])
    f["amount_n"] = total
    f["amount"] = ("+" if f["dir"] == "in" else "-") + _money(total)

    labs = [it["n"] + ("×%d" % it["q"] if it["q"] > 1 else "") for it in f["items"]]
    if len(labs) <= 3:
        f["item_txt"] = "、".join(labs)
    else:
        f["item_txt"] = "、".join(labs[:3]) + " 等 %d 种" % len(labs)
    f["tip"] = ("共 %d 种物品，合计 %s\n" % (len(labs), _money(total)) +
                "；".join("%s%s %s" % (it["n"], ("×%d" % it["q"]) if it["q"] > 1 else "",
                                       _money(it["p"])) for it in f["items"]))[:600]


def _econ_trade_state(f, ev):
    """把 After 里的现金 / 银行存款 / 金条补到这笔交易上"""
    f["cash"] = _money(ev["cash"])
    f["bank"] = _money(ev["bank"])
    if ev.get("gold") is not None:      # 金条为 0 时也要显示，不能用真值判断
        f["gold"] = _money(ev["gold"])
    if ev.get("funds") is not None:
        f["funds"] = _money(ev["funds"])


def _econ_guess_after(f, state, cash=0, bank=0):
    """日志没打印余额时，拿上一次已知余额推算，前面加 ≈ 说明是算出来的"""
    key = f.get("steam") or ""
    cur = state.get(key)
    if not cur:
        return
    c, b, g = cur[0] + cash, cur[1] + bank, cur[2]
    f["cash"] = "≈" + _money(c)
    f["bank"] = "≈" + _money(b)
    if g is not None:
        f["gold"] = _money(g)
    state[key] = (c, b, g)


def _econ_parse(txt, steam, name, state=None):
    """一行经济日志 -> (kind, data)

    item  ：交易商买卖里的一件物品，要合进同一笔交易
    state ：交易前后的余额快照（Before / After），只补数据不出行
    row   ：自成一行的事件，data 就是表格字段
    """
    state = state if state is not None else {}
    body = re.sub(r"^\[[^\]]{1,24}\]\s*", "", txt).strip()
    pos = _pos(txt)

    m = RE_ECON_TRADE.search(body)
    if m:
        tr = RE_ECON_TRADER.search(body)
        return "item", {
            "name": m.group("name").strip(), "steam": m.group("steam"),
            "way": "sell" if m.group("way").lower().startswith("sold") else "buy",
            "what": m.group("what"), "price": _int_of(m.group("price")),
            "trader": _trader_zh(tr.group("t")) if tr else "",
            "txt": txt, "pos": pos,
        }

    m = RE_ECON_STATE.search(body)
    if m:
        return "state", {
            "steam": m.group("steam"), "name": m.group("name").strip(),
            "after": body[:16].lower().startswith("after"),
            "cash": _int_of(m.group("cash")), "bank": _int_of(m.group("bank")),
            "gold": _int_of(m.group("gold")), "funds": _int_of(m.group("funds")),
        }

    f = {"name": name or "", "steam": steam or "", "pos": pos, "detail": body}
    acc = RE_ECON_ACCNO.search(body)
    if acc:
        f["account"] = acc.group(1)

    # 修车 / 修配件这类服务
    m = RE_ECON_SVC.search(body)
    if m:
        raw, attrs = _split_item(m.group("what"))
        qty, cond = _item_qc(attrs)
        fee = _int_of(m.group("price")) or 0
        tr = RE_ECON_TRADER.search(body)
        f.update({
            "act": "维修服务", "dir": "out", "amount": "-" + _money(fee),
            "amount_n": fee, "name": m.group("name").strip(),
            "steam": m.group("steam"),
            "item_txt": _item_zh(raw) + ("×%d" % qty if qty > 1 else ""),
            "target": _trader_zh(tr.group("t")) if tr else "技工",
            "note": "服务费从现金或银行扣，日志没打印交易后余额",
        })
        return "row", f

    # 存款：deposited 283(277 was added)
    m = RE_ECON_DEP.search(body)
    if m:
        amt = _int_of(m.group("amt")) or 0
        real = _int_of(m.group("real"))
        real = amt if real is None else real
        f.update({"act": "存款", "dir": "move", "amount": _money(amt),
                  "amount_n": amt, "target": "本人账户"})
        if real != amt:
            f["note"] = "实际到账 %s，手续费 %s" % (_money(real), _money(amt - real))
        _econ_guess_after(f, state, cash=-amt, bank=real)
        return "row", f

    # 取款
    m = RE_ECON_WD.search(body)
    if m:
        amt = _int_of(m.group("amt")) or 0
        f.update({"act": "取款", "dir": "move", "amount": _money(amt),
                  "amount_n": amt, "target": "本人账户"})
        _econ_guess_after(f, state, cash=amt, bank=-amt)
        return "row", f

    # 银行卡：开卡 / 销卡 / 锁卡
    card = RE_ECON_CARD.search(body)
    if card:
        act = CARD_ACT.get(card.group("op").lower(), "银行卡")
        head = card.group("card").rsplit(" ", 1)[0].lower()
        f["act"] = act
        f["item_txt"] = CARD_ZH.get(head, card.group("card"))
        f["target"] = CARD_OBJ.get(act, "本人账户")
        if act in ("销毁卡片", "删除卡片") and f.get("account"):
            f["target"] = "账号 " + f["account"]
        nb = RE_ECON_NEWBAL.search(body)
        cur = state.get(f.get("steam") or "")
        if nb:
            bal = _int_of(nb.group("b"))
            f["bank"] = _money(bal)
            if cur:
                cash, gold = cur[0], cur[2]
                if act == "开卡":
                    # 开卡工本费 100，日志不打印；现金够就扣现金，不够由卡内余额补。
                    # 依据 10-20 三次开卡前后对照：383→283、1599-1499=100、5490→5390，全部吻合
                    pay = min(CARD_FEE, max(cash, 0))
                    cash -= pay
                    f["cash"] = "≈" + _money(cash)
                    f["note"] = ("开卡工本费 %d 从现金扣" % CARD_FEE) if pay == CARD_FEE else \
                        ("开卡工本费 %d，现金只有 %s，其余从卡内余额扣" % (CARD_FEE, _money(pay)))
                else:
                    f["cash"] = _money(cash)
                if gold is not None:
                    f["gold"] = _money(gold)
                state[f["steam"]] = (cash, bal, gold)
        elif cur:
            _econ_guess_after(f, state)
        return "row", f

    # 兜底：新写法只做粗归类，原文留给详情面板
    act = "其他"
    for rx, label in ECON_RULES:
        if rx.search(body):
            act = label
            break
    f["act"] = act
    am = RE_ECON_AMT.search(body)
    if am:
        v = _int_of(am.group(1))
        if v is not None:
            f["amount"] = _money(v)
            f["amount_n"] = v
    bal = RE_ECON_BAL.search(body)
    if bal:
        v = _int_of(bal.group(1))
        if v is not None:
            f["bank"] = _money(v)
    if not f.get("amount") and not f.get("item_txt"):
        f["msg"] = body
    return "row", f


def _f_econ(txt, steam, name):
    """兼容旧调用：单行直接出字段"""
    return _econ_parse(txt, steam, name, {})[1]


RE_VIOL_LINE = re.compile(r"Action:\s*([A-Za-z0-9_]+),?\s*Desc:\s*([^,]+)")
RE_GAME_LINE = re.compile(
    r"^([A-Za-z]\d+)\s+(Bunker|Cargo Drop|Supply Drop|.*?)\s+(is\s+Active|is\s+Locked|Activated)\b")
RE_AGO = re.compile(r"(\d+\s*h\s*\d+\s*m\s*\d+\s*s|\d+\s*[dhms](?:\s*\d+\s*[dhms])*)\s*ago")
RE_KILL_TXT = re.compile(
    r"^Died:\s*(.+?)\s*\((\d{17}|NPC)\),\s*Killer:\s*(.+?)\s*\((\d{17}|NPC)\)\s*Weapon:\s*(.+?)\s*(?:\[|S:\[\s*KillerLoc|$)")
RE_DIST = re.compile(r"Distance:\s*([\d.]+)\s*m")

# 引擎启动时打印的配置行：每个滚动文件都重复一遍，表格里没有信息量
NOISE_RX = re.compile(
    r"^(Initializing |No [a-z ]*?(?:overrides|found)\b|Cooldown groups|Coldown groups|"
    r"Filtered and sorted|Loaded from config|Parsing [a-z ]*?(?:presets|overrides)|"
    r"Found '\d+' |Spawning [a-z ]*?(?:presets|items)|No loot tree|No item spawning|"
    r"Building item |Built spawnable |'?[A-Za-z]:[\\/].*|.*does not exist$|"
    r"Deleting players that haven't logged in|Completed in [\d.]+s for \d+ player|"
    r"\d+:\s+\d+.*\s-\s)", re.I)


def _num(txt):
    """坐标显示：大的取整，小的留一位"""
    try:
        f = float(txt)
    except (TypeError, ValueError):
        return str(txt or "")
    if abs(f) >= 1000:
        return str(int(round(f)))
    out = ("%.1f" % f).rstrip("0").rstrip(".")
    return out or "0"


def _pos(msg):
    m = RE_XYZ.search(msg)
    if not m:
        return ""
    return "%s, %s, %s" % (_num(m.group(1)), _num(m.group(2)), _num(m.group(3)))


def _dist3(ax, ay, az, bx, by, bz):
    try:
        return "%.1f m" % ((((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2) ** 0.5) / 100.0)
    except (TypeError, ValueError):
        return ""


def _f_kill(msg, steam, name):
    """击杀：优先解 JSON，回退文本格式"""
    txt = msg.strip()
    if txt.startswith("{"):
        try:
            d = json.loads(txt)
            k = d.get("Killer") or {}
            v = d.get("Victim") or {}
            kl = k.get("ServerLocation") or {}
            vl = v.get("ServerLocation") or {}
            loc = "X=%s Y=%s Z=%s" % (vl.get("X"), vl.get("Y"), vl.get("Z")) if vl else ""
            return {
                "victim": v.get("ProfileName") or "",
                "victim_id": v.get("UserId") or "",
                "killer": k.get("ProfileName") or "",
                "killer_id": k.get("UserId") or "",
                "weapon": (d.get("Weapon") or "").replace(" [Projectile]", ""),
                "dist": _dist3(kl.get("X"), kl.get("Y"), kl.get("Z"),
                               vl.get("X"), vl.get("Y"), vl.get("Z")),
                "pos": _pos(loc),
            }
        except (ValueError, TypeError):
            pass

    m = RE_KILL_TXT.match(txt)
    if m:
        dm = RE_DIST.search(txt)
        return {
            "victim": m.group(1).strip(), "victim_id": m.group(2),
            "killer": m.group(3).strip(), "killer_id": m.group(4),
            "weapon": m.group(5).strip(),
            "dist": (dm.group(1) + " m") if dm else "",
            "pos": _pos(txt),
        }
    return {"msg": txt, "victim": name, "victim_id": steam}


def extract_fields(tag, msg, steam, name, ip, cat=""):
    """把一条日志拆成表格字段。解析不出来时退回 {'msg': 原文}"""
    txt = msg.strip()
    f = {}
    noise = 1 if NOISE_RX.match(txt) else 0
    # 行首的 [VehicleInactiveTimerReached] 这类事件分类，是区分同类记录的关键
    evt = (cat or "").strip()

    if tag in ("login", "logout"):
        m = RE_LOGIN_LINE.match(txt)
        f = {
            "act": "登出" if (tag == "logout" or "logged out" in txt.lower()) else "登录",
            "name": (m.group(3) if m else name) or "",
            "steam": (m.group(2) if m else steam) or "",
            "ip": (m.group(1) if m else ip) or "",
            "pos": _pos(txt),
        }
    elif tag == "chat":
        m = RE_CHAT_LINE.match(txt)
        if m:
            ch = m.group(4).strip()
            f = {
                "name": m.group(2), "steam": m.group(1),
                "channel": {"Global": "全局", "Local": "本地", "Squad": "小队"}.get(ch, ch),
                "text": m.group(5).strip(),
            }
        else:
            f = {"name": name, "steam": steam, "text": txt}
    elif tag == "admin":
        m = RE_ADMIN_LINE.match(txt)
        if m:
            f = {"name": m.group(2), "steam": m.group(1), "cmd": m.group(4).strip("'")}
        else:
            f = {"cmd": txt}
    elif tag == "kill":
        f = _f_kill(txt, steam, name)
    elif tag == "vehicle_destruction":
        m = RE_VEH_LINE.match(txt)
        if m:
            owner = m.group(3).strip()
            f = {"veh": m.group(1), "veh_id": m.group(2),
                 "owner": "" if owner in ("N/A", "-") else owner,
                 "pos": _pos(m.group(4))}
        else:
            f = {"msg": txt}
    elif tag == "economy":
        f = _f_econ(txt, steam, name)
    elif tag == "famepoints":
        m = RE_FAME_LINE.match(txt)
        if m:
            f = {"name": m.group(1), "steam": m.group(2), "fame": m.group(3),
                 "period": m.group(4), "total": m.group(5)}
        else:
            d = RE_FAME_DETAIL.match(txt)
            if d:
                f = {"detail": d.group(1), "value": d.group(2)}
            else:
                f = {"msg": txt}
    elif tag == "chest_ownership":
        m = RE_CHEST_LINE.search(txt)
        if m:
            f = {"chest": m.group(1), "steam": m.group(2), "name": m.group(3).strip(),
                 "pos": _pos(txt)}
        else:
            f = {"msg": txt}
    elif tag == "violations":
        m = RE_VIOL_LINE.search(txt)
        f = {"action": m.group(1) if m else "",
             "desc": m.group(2) if m else txt, "pos": _pos(txt)}
    elif tag == "gameplay":
        m = RE_GAME_LINE.match(txt)
        if m:
            ag = RE_AGO.search(txt)
            f = {"target": "%s %s" % (m.group(1), m.group(2).strip()),
                 "state": m.group(3).replace("is ", "").strip(),
                 "ago": ag.group(1) if ag else "", "pos": _pos(txt)}
        else:
            f = {"msg": txt}
    else:
        f = {"msg": txt, "pos": _pos(txt)}

    if evt and not evt.lower().startswith("log"):
        f["evt"] = evt
    if noise:
        f["noise"] = 1
    if not f:
        f = {"msg": txt}
    return f


# ---------------------------------------------------------------- 文件 / 分组

def list_logs(folder):
    out = []
    try:
        names = os.listdir(folder)
    except OSError:
        return out
    for name in names:
        fp = os.path.join(folder, name)
        if not os.path.isfile(fp) or not name.lower().endswith((".log", ".txt")):
            continue
        try:
            st = os.stat(fp)
        except OSError:
            continue
        t = guess_type(name)
        out.append({
            "path": fp, "name": name, "type": t, "typeName": type_name(t),
            "size": st.st_size, "mtime": int(st.st_mtime),
            "stamp": file_stamp(name, int(st.st_mtime * 1000)),
        })
    out.sort(key=lambda x: (x["stamp"], x["name"]))
    return out


def _peek_text(path, n, tail):
    """读文件头或尾的一小段，用于低成本探测"""
    size = os.path.getsize(path)
    with open(path, "rb") as f:
        enc = detect_enc(f.read(4096))
        if tail and size > n:
            off = size - n
            if enc.startswith("utf-16") and off % 2:
                off += 1
            f.seek(off)
        else:
            f.seek(0)
        data = f.read(n)
    if enc.startswith("utf-16") and len(data) % 2:
        data = data[:-1]
    return data.decode(enc, errors="replace")


def _has_content(files):
    """看这组文件里到底有没有真事件（很多滚动文件只有一行 Game version）"""
    probe = []
    if files:
        probe.append((files[0], False))                      # 最旧文件的头部
        probe.append((max(files, key=lambda x: x["size"]), True))  # 最大文件的尾部
    for f, tail in probe:
        if f["size"] == 0:
            continue
        try:
            text = _peek_text(f["path"], 8192, tail)
        except OSError:
            continue
        for ln in text.splitlines():
            p = parse_line(ln)
            if p is None:
                continue
            if isinstance(p[0], str) and p[0] == "SKIP":
                continue
            return True
    return False


def list_groups(folder, counts=None):
    """按类型分组：同类型不同日期/时段的文件归到一组

    counts: {type: 记录条数}，为 None 时不给条数（避免每次扫描都全量解析）
    """
    groups = {}
    for f in list_logs(folder):
        groups.setdefault(f["type"], []).append(f)

    counts = counts or {}
    out = []
    for t, fs in groups.items():
        fs.sort(key=lambda x: (x["stamp"], x["name"]))
        size = sum(x["size"] for x in fs)
        out.append({
            "type": t,
            "typeName": type_name(t),
            "fileCount": len(fs),
            "count": counts.get(t, 0),
            "size": size,
            "hasData": _has_content(fs),
            "mtime": max(x["mtime"] for x in fs),
            "stampFirst": fs[0]["stamp"],
            "stampLast": fs[-1]["stamp"],
            "files": fs,
        })
    out.sort(key=lambda g: (0 if g["hasData"] else 1,
                            TYPE_ORDER.index(g["type"]) if g["type"] in TYPE_ORDER else 99,
                            -g["size"]))
    return out


# ---------------------------------------------------------------- 解析 + 缓存

_CACHE = {}
_CACHE_LOCK = threading.Lock()


def _build(files, ftype, t0, truncated_flag):
    """把若干文件解析成一条按时间排序的时间线

    ftype 为 ALL_TYPE 时，每行保留自己文件的类型标签（真·混合时间线）
    """
    rows = []
    players = {}
    flist = []
    skipped = 0
    mixed = ftype == ALL_TYPE
    econ_open = None          # 还没收尾的那笔交易（一次卖多件物品合成一行）
    econ_state = {}           # steam -> (现金, 银行余额)，给没打印余额的行做推算

    for f in files:
        base_tag = (f.get("type") or guess_type(f["path"])) if mixed else ftype
        try:
            text, trunc = read_file_text(f["path"], MAX_BYTES)
        except OSError:
            continue
        src = len(flist)
        flist.append({"name": f["name"], "size": f["size"], "type": base_tag})
        prev_ts = None
        after_sep = False
        econ_open = None
        for ln_no, ln in enumerate(text.splitlines(), 1):
            p = parse_line(ln)
            if p is None:
                continue
            if isinstance(p[0], str) and p[0] == "SKIP":
                skipped += 1
                if p[1] is not None:
                    prev_ts = p[1]        # 分隔线/版本行也可能是后续续行的锚点
                if p[2]:
                    after_sep = True      # 分隔线之后的块首行算正式记录
                continue
            ts, lvl, cat, msg, steam, name, ip = p
            if ts is None:
                if prev_ts is None:           # 文件开头的续行，丢弃
                    continue
                ts = prev_ts                  # 续行沿用上一条时间，保证顺序
                tag = base_tag if after_sep else "cont"
                after_sep = False
            else:
                prev_ts = ts
                tag = base_tag
                after_sep = False
                # 登录文件里把下线单独标出来，方便区分
                if base_tag == "login" and "logged out" in msg:
                    tag = "logout"
            f = None
            if base_tag == "economy":
                kind, ev = _econ_parse(msg, steam, name, econ_state)
                if kind == "item":
                    key = (ev["steam"], ev["way"], ev["trader"])
                    if econ_open is not None and econ_open[0] == key:
                        _econ_trade_add(econ_open[1], ev)   # 同一笔交易，接着累加
                    else:
                        f = _econ_trade_new(ev)
                        econ_open = (key, f)
                elif kind == "state":
                    econ_state[ev["steam"]] = (ev["cash"], ev["bank"], ev["gold"])
                    if econ_open is not None and econ_open[1].get("steam") == ev["steam"]:
                        _econ_trade_state(econ_open[1], ev)
                        if ev["after"]:
                            econ_open = None        # After 之后这笔交易就结束了
                    continue
                else:
                    econ_open = None
                    f = ev
            else:
                econ_open = None
                f = extract_fields(base_tag, msg, steam, name, ip, cat)

            if steam:
                cur = players.get(steam)
                if cur is None:
                    players[steam] = [steam, name, 1, ts]
                else:
                    cur[2] += 1
                    if not cur[1] and name:
                        cur[1] = name
                    if ts > cur[3]:
                        cur[3] = ts
            if f is None:               # 已经合并进上一行
                continue
            rows.append((ts, _sym(tag), lvl, cat, msg, ln_no, steam, ip, src, f))

    # 最新在最前：时间戳相同的保持原始行序（续行仍跟在所属记录后面）
    rows.sort(key=lambda r: -(r[0] or 0))

    total = len(rows)
    if total > MAX_LINES:
        rows = rows[:MAX_LINES]               # 截断时丢掉最旧的
        truncated_flag = True

    st_types, st_levels, st_groups = {}, {}, {}
    first = last = None
    for r in rows:
        st_types[r[1]] = st_types.get(r[1], 0) + 1
        st_levels[r[2]] = st_levels.get(r[2], 0) + 1
        g = flist[r[8]]["type"] if mixed else ftype
        st_groups[g] = st_groups.get(g, 0) + 1
        ts = r[0]
        if first is None or ts < first:
            first = ts
        if last is None or ts > last:
            last = ts

    plist = [{"id": v[0], "name": v[1], "count": v[2], "last": v[3]} for v in players.values()]
    plist.sort(key=lambda x: (-x["count"], x["id"]))

    days = 0
    if first is not None and last is not None:
        days = int((last - first) // 86400000) + 1

    meta = {
        "type": ftype,
        "typeName": type_name(ftype),
        "fileCount": len(flist),
        "files": flist,
        "size": sum(x["size"] for x in files),
        "count": len(rows),
        "days": days,
        "dropped": max(0, total - len(rows)),
        "headerLines": skipped,
        "truncated": truncated_flag,
        "first": first,
        "last": last,
        "parseMs": int((time.time() - t0) * 1000),
        "players": plist[:80],
        "stats": {"types": st_types, "levels": st_levels, "groups": st_groups},
    }
    return {"lines": rows, "meta": meta}


def load_group(folder, ftype):
    """ftype 为 ALL_TYPE 时把目录下所有类型合并成一条总时间线"""
    allf = list_logs(folder)
    if ftype == ALL_TYPE:
        files = allf
    else:
        files = [f for f in allf if f["type"] == ftype]
    files.sort(key=lambda x: (x["stamp"], x["name"]))
    sig = (tuple((f["path"], f["mtime"], f["size"]) for f in files),)
    ck = "G|" + folder + "|" + ftype

    with _CACHE_LOCK:
        c = _CACHE.get(ck)
        if c and c["sig"] == sig:
            return c

    t0 = time.time()
    entry = _build(files, ftype, t0, False)
    entry["sig"] = sig
    entry["gen"] = t0
    with _CACHE_LOCK:
        _CACHE[ck] = entry
        if len(_CACHE) > MAX_CACHE:
            oldest = min(_CACHE.items(), key=lambda kv: kv[1].get("gen", 0))[0]
            if oldest != ck:
                _CACHE.pop(oldest, None)
    return entry


def type_counts(folder):
    """侧栏用：每个类型到底有多少条记录（一次全量解析，之后走缓存）"""
    e = load_group(folder, ALL_TYPE)
    return dict(e["meta"]["stats"].get("groups") or {})


def load_file(path):
    st = os.stat(path)
    sig = (int(st.st_mtime), int(st.st_size))
    ck = "F|" + path
    with _CACHE_LOCK:
        c = _CACHE.get(ck)
        if c and c["sig"] == sig:
            return c

    t0 = time.time()
    f = {
        "path": path, "name": os.path.basename(path),
        "size": st.st_size, "mtime": int(st.st_mtime),
        "stamp": file_stamp(os.path.basename(path), int(st.st_mtime * 1000)),
    }
    entry = _build([f], guess_type(path), t0, False)
    entry["sig"] = sig
    with _CACHE_LOCK:
        _CACHE[ck] = entry
        if len(_CACHE) > MAX_CACHE:
            oldest = next(iter(_CACHE))
            if oldest != ck:
                _CACHE.pop(oldest, None)
    return entry


# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    server_version = "SCUMLogViewer/" + VERSION

    def log_message(self, fmt, *args):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False, separators=(",", ":")),
                   "application/json; charset=utf-8")

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        p = u.path
        try:
            if p in ("/", "/index.html"):
                return self.serve_static("index.html")
            if p.startswith("/static/"):
                return self.serve_static(p[len("/static/"):])
            if p == "/api/init":
                return self._json(api_init(q))
            if p == "/api/scan":
                return self._json(api_scan(q))
            if p == "/api/open":
                return self._json(api_open(q))
            if p == "/api/query":
                return self._json(api_query(q))
            if p == "/api/remember":
                remember(type=_clean_type(q.get("type")))
                return self._json({"ok": True})
            if p == "/api/ping":
                return self._json({"ok": True})
            return self._send(404, "not found", "text/plain; charset=utf-8")
        except FileNotFoundError as e:
            return self._json({"error": f"文件不存在：{e.filename or ''}"}, 404)
        except PermissionError:
            return self._json({"error": "没有读取权限，请用管理员身份运行或换一个目录"}, 403)
        except Exception as e:  # noqa: BLE001
            import traceback
            traceback.print_exc()
            return self._json({"error": f"{type(e).__name__}: {e}"}, 500)

    def serve_static(self, rel):
        rel = rel.lstrip("/").replace("\\", "/")
        if ".." in rel:
            return self._send(403, "forbidden", "text/plain")
        fp = os.path.join(WEB, rel)
        if not os.path.isfile(fp):
            return self._send(404, "not found", "text/plain")
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
        }.get(os.path.splitext(fp)[1].lower(), "application/octet-stream")
        with open(fp, "rb") as f:
            self._send(200, f.read(), ctype)


def _target(q):
    """统一解析目标：合并视图用 root+type，单文件用 path"""
    ftype = q.get("type", "")
    root = unquote(q.get("root", ""))
    if ftype and root:
        return ("group", root, ftype)
    path = unquote(q.get("path", ""))
    if path:
        return ("file", path, "")
    return (None, None, None)


def _counts_or_none(root):
    """目录不大时顺手把每类条数算出来（侧栏直接显示条数）"""
    try:
        total = sum(f["size"] for f in list_logs(root))
    except OSError:
        return None
    if total > 24 * 1024 * 1024:       # 太大就先不算，免得开页面卡住
        return None
    try:
        return type_counts(root)
    except Exception:
        return None


def _clean_type(t):
    """只收已知的日志类型名，别把乱七八糟的字符串写进配置"""
    return t if t and (t == ALL_TYPE or t in LOG_TYPES) else None


def api_init(q):
    cfg = load_cfg()
    cands = default_candidates()
    last = cfg.get("last_root") or ""
    root = None
    missing = None
    if last:
        d = guess_log_dir(last)
        if os.path.isdir(d):
            root = d
        else:
            missing = last            # 上次的目录没了，告诉前端别默默换一个
    if not root and cands:
        root = guess_log_dir(cands[0])
    return {
        "version": VERSION,
        "root": root,
        "lastRoot": last,
        "missing": missing,
        "lastType": _clean_type(cfg.get("type")),
        "candidates": cands,
        "groups": list_groups(root, _counts_or_none(root)) if root else [],
        "home": os.path.expanduser("~"),
    }


def api_scan(q):
    path = guess_log_dir(unquote(q.get("path", ""))) if q.get("path") else ""
    if not path or not os.path.isdir(path):
        return {"error": "目录不存在", "path": path}
    dirs = []
    parent = os.path.dirname(path)
    for name in sorted(os.listdir(path)):
        fp = os.path.join(path, name)
        if os.path.isdir(fp):
            dirs.append({"name": name, "path": fp})
    cfg = load_cfg()
    cfg["last_root"] = path
    save_cfg(cfg)
    files = list_logs(path)
    return {"path": path, "parent": parent if parent != path else None,
            "dirs": dirs, "groups": list_groups(path, _counts_or_none(path)),
            "fileCount": len(files)}


def api_open(q):
    kind, a, b = _target(q)
    if kind == "group":
        if not os.path.isdir(a):
            return {"error": "日志目录不存在"}
        return load_group(a, b)["meta"]
    if kind == "file":
        if not os.path.isfile(a):
            return {"error": "日志文件不存在"}
        return load_file(a)["meta"]
    return {"error": "缺少参数"}


def api_query(q):
    kind, a, b = _target(q)
    if kind == "group":
        if not os.path.isdir(a):
            return {"error": "日志目录不存在"}
        lines = load_group(a, b)["lines"]
    elif kind == "file":
        if not os.path.isfile(a):
            return {"error": "日志文件不存在"}
        lines = load_file(a)["lines"]
    else:
        return {"error": "缺少参数"}

    cats = set(filter(None, q.get("cats", "").split(",")))
    level = q.get("level", "")
    kw = q.get("q", "").strip().lower()
    t1 = int(q.get("from") or 0)
    t2 = int(q.get("to") or 0)
    only = q.get("only", "")
    want_src = q.get("src", "")
    no_noise = q.get("noise") == "0"
    offset = max(0, int(q.get("offset") or 0))
    limit = min(3000, max(1, int(q.get("limit") or 500)))

    def match(r):
        if no_noise and len(r) > 9 and r[9].get("noise"):
            return False
        if cats and r[1] not in cats:
            return False
        if level and level != "all" and r[2] != level:
            return False
        if t1 and (r[0] or 0) < t1:
            return False
        if t2 and (r[0] or 0) > t2:
            return False
        if want_src and str(r[8]) != want_src:
            return False
        if only and only != r[6] and only != r[7] and only.lower() not in r[4].lower():
            return False
        if kw and kw not in r[4].lower() and kw not in (r[3] or "").lower():
            return False
        return True

    hit = [r for r in lines if match(r)]
    total = len(hit)
    page = hit[offset:offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "rows": page}


# ---------------------------------------------------------------- 启动

def port_free(port, host="127.0.0.1"):
    """Windows 上 SO_REUSEADDR 不能用来判断占用，先试连再试绑"""
    probe = "127.0.0.1" if host in ("0.0.0.0", "::", "") else host
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.25)
        if s.connect_ex((probe, port)) == 0:
            return False
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False


def free_port(preferred, host="127.0.0.1"):
    for port in [preferred] + list(range(preferred + 1, preferred + 30)):
        if port_free(port, host):
            return port
    return 0


def lan_addrs():
    """列出本机可被外部访问的 IPv4，方便在服务器上访问"""
    out = []
    try:
        for nic in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not nic.startswith("127.") and nic not in out:
                out.append(nic)
    except OSError:
        pass
    return out


def main():
    try:                       # 重定向到文件时也能实时看到启动信息
        sys.stdout.reconfigure(line_buffering=True)
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="SCUM 服务器日志查看器")
    ap.add_argument("--path", help="日志目录（SCUM/Saved/SaveFiles/Logs）")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--host", default="127.0.0.1",
                    help="监听地址：127.0.0.1 只本机可访问；0.0.0.0 允许局域网/远程访问")
    ap.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = ap.parse_args()

    if args.path:
        d = guess_log_dir(args.path)
        if os.path.isdir(d):
            remember(last_root=d)

    port = free_port(args.port, args.host)
    if not port:
        print("找不到可用端口，换一个 --port 试试")
        sys.exit(1)
    local_url = f"http://127.0.0.1:{port}/"

    class Server(ThreadingHTTPServer):
        allow_reuse_address = False
        daemon_threads = True

    try:
        srv = Server((args.host, port), Handler)
    except OSError as e:
        print(f"监听 {args.host}:{port} 失败：{e}")
        sys.exit(1)

    print("=" * 56)
    print(f"  SCUM 服务器日志查看器  v{VERSION}")
    print(f"  地址：{local_url}")
    cfg_now = load_cfg()
    kept = cfg_now.get("last_root") or ""
    if kept and os.path.isdir(guess_log_dir(kept)):
        print(f"  日志目录：{guess_log_dir(kept)}")
    else:
        print("  日志目录：还没指定，页面里点「打开目录」选一次就行")
    print(f"  配置：{CFG}")
    if args.host not in ("127.0.0.1", "localhost"):
        for ip in lan_addrs():
            print(f"  远程：http://{ip}:{port}/")
        print("  注意：远程访问需放行防火墙该端口")
    print("  关闭这个窗口即停止服务（Ctrl+C 也可）")
    print("=" * 56)
    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(local_url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
