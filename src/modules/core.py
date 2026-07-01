"""Color/action parsing and device operations. No UI, no argparse."""

import drivers
import transport

ANIMATIONS = ("spectrum", "breathing", "wave", "reactive", "starlight")


def parse_color(s):
    named = {'red': (255, 0, 0), 'green': (0, 255, 0), 'blue': (0, 0, 255),
             'white': (255, 255, 255), 'off': (0, 0, 0), 'black': (0, 0, 0),
             'yellow': (255, 255, 0), 'cyan': (0, 255, 255), 'magenta': (255, 0, 255),
             'purple': (128, 0, 128), 'orange': (255, 80, 0)}
    t = s.strip().lstrip('#').lower()
    if t in named:
        return named[t]
    if ',' in s:
        parts = s.split(',')
        if len(parts) == 3 and all(p.strip().isdigit() and 0 <= int(p) <= 255 for p in parts):
            return tuple(int(p) for p in parts)
    if len(t) == 6 and all(ch in '0123456789abcdef' for ch in t):
        return tuple(int(t[i:i + 2], 16) for i in (0, 2, 4))
    raise ValueError(f"bad color {s!r} (use ff0000, '255,0,0', or a name)")


def resolve_action(what, color=None):
    """(action, rgb) from a positional that is either a color or an effect word."""
    lw = what.strip().lower()
    if lw in ('off', 'black'):
        return 'static', (0, 0, 0)                 # off == solid black, not the 'none' effect
    if lw in ANIMATIONS:
        return lw, (parse_color(color) if color else None)
    if lw == 'static':
        if not color:
            raise ValueError("'static' needs a color, e.g. static ff0000")
        return 'static', parse_color(color)
    return 'static', parse_color(what)             # plain color -> static


def describe(action, rgb):
    if action == 'static' or (action == 'breathing' and rgb):
        return f"#{''.join(f'{c:02x}' for c in rgb)}" + (" breathing" if action == 'breathing' else "")
    return action


def connected_list():
    """[(pid, name, control_found)] for connected devices, in list order."""
    out = []
    for pid, ok in sorted(transport.connected().items()):
        dev = drivers.get(pid)
        out.append((pid, dev.name if dev else "unknown model", ok))
    return out


_HZ = {0x01: 1000, 0x02: 500, 0x08: 125}        # standard polling-rate codes (openrazer)
_READ_TXNS = (0xFF, 0x1F, 0x3F)                 # GET fallback order when the device's txn is unknown


def _dedup(seq):
    out = []
    for x in seq:
        if x not in out:
            out.append(x)
    return out


def _query(pid, make_request):
    """Send a GET request and return the 90-byte reply with success status (0x02), or None.

    Tries the device's own transaction id first, then common fallbacks -- a GET only
    answers when the txn matches the device's bucket (0xff/0x1f/0x3f).
    """
    dev = drivers.get(pid)
    txns = _dedup(([dev.txn] if dev else []) + list(_READ_TXNS))
    for path in transport.control_paths(pid):
        for txn in txns:
            try:
                r = transport.get_response(path, make_request(txn))
            except OSError:
                break                       # this path is unusable -- move to the next
            if r and r[0] == 0x02:          # status success
                return r
    return None


def read_hz(pid):
    """Polling rate in Hz read from the device, or None if it can't be read."""
    r = _query(pid, drivers.protocol.q_poll)
    if not r or not r[8]:
        return None
    code = r[8]
    return _HZ.get(code) or (1000 // code if 1 <= code <= 8 else None)


def read_firmware(pid):
    r = _query(pid, drivers.protocol.q_firmware)
    return f"{r[8]}.{r[9]}" if r else None


def read_serial(pid):
    r = _query(pid, drivers.protocol.q_serial)
    if not r:
        return None
    s = bytes(r[8:30]).split(b"\x00", 1)[0].decode("ascii", "ignore").strip()
    return s or None


def read_battery(pid):
    """Battery charge 0-100, or None (wired/unsupported)."""
    r = _query(pid, drivers.protocol.q_battery)
    return round(r[9] * 100 / 255) if r else None


def read_charging(pid):
    r = _query(pid, drivers.protocol.q_charging)
    return bool(r[9]) if r else None


def read_dpi(pid):
    """(x, y) DPI read from the device, or None."""
    r = _query(pid, drivers.protocol.q_dpi)
    return ((r[9] << 8) | r[10], (r[11] << 8) | r[12]) if r else None


def read_status(pid):
    """Everything readable from the device (each value None if unavailable)."""
    return {"hz": read_hz(pid), "dpi": read_dpi(pid), "battery": read_battery(pid),
            "charging": read_charging(pid), "firmware": read_firmware(pid),
            "serial": read_serial(pid)}


def select_targets(selector=None):
    """Resolve which device pids to act on from one -d value.

    selector: None=auto, 'all'=every connected, a list number ('2'), or a pid hex ('008a').
    Auto-pick = the default device if present, else the sole connected one, else ask.
    """
    devs = connected_list()
    conn = [d[0] for d in devs]
    if selector is None:
        if drivers.DEFAULT_PID in conn:
            return [drivers.DEFAULT_PID]
        if len(conn) == 1:
            return conn
        if not conn:
            return [drivers.DEFAULT_PID]    # apply() will give the friendly "not found"
        listing = "\n".join(f"  {i}. {n}  (1532:{p:04x})" for i, (p, n, _ok) in enumerate(devs, 1))
        raise SystemExit("multiple devices connected -- pick one with -d N (or -d all):\n" + listing)
    s = selector.strip().lower()
    if s == 'all':
        if not conn:
            raise SystemExit("no Razer devices connected")
        return conn
    if len(s) <= 2 and s.isdigit():         # short decimal -> list number
        i = int(s)
        if not 1 <= i <= len(devs):
            raise SystemExit(f"-d {selector}: only {len(devs)} device(s) connected")
        return [devs[i - 1][0]]
    try:                                     # otherwise a pid in hex
        return [int(s, 16)]
    except ValueError:
        raise SystemExit(f"bad -d {selector!r} (use a list number, a pid like 008a, or 'all')")


def _meta(pid, method=None, txn=None, led=None):
    """(method, txn, led, label) for a pid, honoring overrides; unknown -> custom/0x3f/0x00."""
    dev = drivers.get(pid)
    if dev:
        return (method or dev.method, dev.txn if txn is None else txn,
                dev.led if led is None else led, dev.name)
    return (method or 'custom', 0x3F if txn is None else txn,
            0x00 if led is None else led, f"unknown 1532:{pid:04x}")


def _send(pid, label, reports):
    """Push a report sequence to the device's control collection (tries each)."""
    paths = transport.control_paths(pid)
    if not paths:
        raise SystemExit(f"{label}: no 1532:{pid:04x} device found (plugged in?)")
    last = None
    for path in paths:
        try:
            for rep in reports:
                transport.set_feature(path, rep)
            return
        except OSError as e:
            last = e
    raise SystemExit(f"{label}: every candidate collection rejected the report (last: {last})")


def apply(pid, action, rgb, save=True, method=None, txn=None, led=None, **opts):
    """Run a lighting `action` on the device with this pid. Returns (label, method).

    opts may carry rgb2 / speed / direction for breathing-dual / reactive / wave.
    """
    method, txn, led, label = _meta(pid, method, txn, led)
    try:
        reports = drivers.build(method, action, rgb, txn, led, save, **opts)
    except NotImplementedError as e:
        raise SystemExit(f"{label}: {e}")
    _send(pid, label, reports)
    return label, method


def set_brightness(pid, pct, save=True, txn=None, led=None):
    """Set brightness 0-100%. Returns the device label."""
    method, txn, led, label = _meta(pid, txn=txn, led=led)
    level = round(max(0, min(100, pct)) * 255 / 100)
    _send(pid, label, drivers.protocol.brightness(method, level, txn, led, store=save))
    return label


def _multi_txn(pid, label, build_one, txn):
    """Send a write under every likely txn (writes can't be confirmed, so the device
    honors whichever matches and ignores the rest). If txn is given, use only that."""
    _, dtxn, _l, _lab = _meta(pid, txn=txn)
    txns = [txn] if txn is not None else _dedup([dtxn, 0xFF, 0x1F, 0x3F])
    reports = []
    for t in txns:
        reports += build_one(t)
    _send(pid, label, reports)


def set_dpi(pid, x, y=None, txn=None):
    """Set DPI (x, or x and y). Returns (label, (x, y))."""
    _, _t, _l, label = _meta(pid, txn=txn)
    y = x if y is None else y
    _multi_txn(pid, label, lambda t: drivers.protocol.set_dpi(x, y, t), txn)
    return label, (x, y)


def set_poll(pid, hz, txn=None):
    """Set polling rate. 1000/500/125 use the v1 report; 8000/4000/2000/250
    use HyperPolling (v2). Returns the device label."""
    _, _t, _l, label = _meta(pid, txn=txn)
    build = drivers.protocol.set_poll if int(hz) in (1000, 500, 125) else drivers.protocol.set_poll2
    build(hz, 0)                                   # validate hz early (raises ValueError)
    _multi_txn(pid, label, lambda t: build(hz, t), txn)
    return label
