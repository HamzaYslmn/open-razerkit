"""settings.txt persistence + register the app to run at startup.

settings.txt (one device per line, in docs/) records what to re-apply:
    <pid_hex> <action> [colorhex]     e.g.  008a static ff1e00  |  008a spectrum

`--startup apply` replays it (what the logon launcher runs); a normal run records
the applied setting back into it so "set once" survives reboots.
"""

import os
import sys

import drivers

_HEADER = (
    "# RazerKit startup settings -- replayed at logon with:  python src/main.py --startup apply\n"
    "# columns:  device | pid | action | color    (color = hex like ff1e00, or - for effects)\n"
)


# Everything is anchored to main.py so paths don't depend on the cwd.
def _main_py():
    here = os.path.dirname(os.path.abspath(__file__))      # <proj>/src/modules
    return os.path.join(os.path.dirname(here), 'main.py')   # <proj>/src/main.py


def _proj():
    return os.path.dirname(os.path.dirname(_main_py()))     # <proj>


def _docs(*parts):
    return os.path.join(_proj(), 'docs', *parts)


def path():
    return _docs('settings.txt')


def parse_row(s):
    """(pid, action, rgb_or_None) from one table row, or None if it isn't one.

    Accepts the aligned 'name | pid | action | color' table and the older
    whitespace 'pid action color' form. The name column is informational.
    """
    from modules.core import parse_color
    fields = [x.strip() for x in s.split('|')] if '|' in s else s.split()
    pidtok = fields[1] if '|' in s else fields[0]   # name|pid|...  vs  pid ...
    rest = fields[2:] if '|' in s else fields[1:]
    try:
        pid = int(pidtok, 16)
    except (ValueError, IndexError):
        return None
    action = rest[0] if rest and rest[0] else 'static'
    coltok = rest[1] if len(rest) > 1 else '-'
    rgb = None
    if coltok and coltok != '-':
        try:
            rgb = parse_color(coltok)
        except ValueError:
            rgb = None
    return (pid, action, rgb)


def load():
    """[(pid, action, rgb_or_None)] from settings.txt; [] if missing/empty."""
    p = path()
    if not os.path.exists(p):
        return []
    out = []
    with open(p, encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith('#'):
                continue
            r = parse_row(s)
            if r:
                out.append(r)
    return out


def _name(pid):
    d = drivers.get(pid)
    return d.name if d else f"Unknown 1532:{pid:04x}"


def _table_lines(rows):
    """Aligned 'device | pid | action | color' lines from {pid: (action, rgb)}."""
    namew = max([6] + [len(_name(p)) for p in rows])
    actw = max([6] + [len(a) for a, _ in rows.values()])
    lines = []
    for p in sorted(rows):
        a, c = rows[p]
        col = f"{c[0]:02x}{c[1]:02x}{c[2]:02x}" if (c and a in ('static', 'breathing')) else "-"
        lines.append(f"{_name(p):<{namew}} | {p:04x} | {a:<{actw}} | {col}\n")
    return lines


def save(pid, action, rgb):
    """Record/replace this device's setting in settings.txt as an aligned table."""
    rows = {p: (a, c) for p, a, c in load()}
    rows[pid] = (action, rgb)
    with open(path(), 'w', encoding='utf-8') as f:
        f.write("".join([_HEADER] + _table_lines(rows)))


# --- named profiles (profiles.txt) -------------------------------------------
# [name] sections holding the same rows as settings.txt. "default" is what the
# game watcher reverts to when no mapped game is running.
_PHEADER = (
    "# RazerKit profiles -- load with:  python src/main.py --profile load <name>\n"
    "# sections: [name]; rows like settings.txt:  device | pid | action | color\n"
)


def profiles_path():
    return _docs('profiles.txt')


def _norm_name(name):
    n = (name or "").strip().lower()
    if not n or any(c in n for c in '[]|'):
        raise SystemExit(f"bad profile name {name!r} (no [ ] | characters)")
    return n


def load_profiles():
    """{name: {pid: (action, rgb)}} from profiles.txt; {} if missing."""
    p = profiles_path()
    out = {}
    if not os.path.exists(p):
        return out
    cur = None
    with open(p, encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith('#'):
                continue
            if s.startswith('[') and s.endswith(']'):
                cur = s[1:-1].strip().lower()
                out.setdefault(cur, {})
                continue
            r = parse_row(s)
            if r and cur is not None:
                out[cur][r[0]] = (r[1], r[2])
    return out


def _write_profiles(profs):
    lines = [_PHEADER]
    for name in sorted(profs):
        lines.append(f"\n[{name}]\n")
        lines += _table_lines(profs[name])
    with open(profiles_path(), 'w', encoding='utf-8') as f:
        f.write("".join(lines))


def save_profile(name):
    """Snapshot the current settings.txt rows as profile `name`."""
    name = _norm_name(name)
    rows = {p: (a, c) for p, a, c in load()}
    if not rows:
        raise SystemExit("nothing to snapshot -- set a color first, then --profile save")
    profs = load_profiles()
    profs[name] = rows
    _write_profiles(profs)
    return name


def delete_profile(name):
    name = _norm_name(name)
    profs = load_profiles()
    if name not in profs:
        raise SystemExit(f"no profile {name!r} (have: {', '.join(sorted(profs)) or 'none'})")
    del profs[name]
    _write_profiles(profs)


def profile_rows(name):
    """[(pid, action, rgb)] for a profile; raises if unknown."""
    name = _norm_name(name)
    profs = load_profiles()
    if name not in profs:
        raise SystemExit(f"no profile {name!r} (have: {', '.join(sorted(profs)) or 'none'})")
    return [(p, a, c) for p, (a, c) in sorted(profs[name].items())]


def default_rows():
    """What the watcher reverts to: the 'default' profile if saved, else settings.txt."""
    profs = load_profiles()
    if 'default' in profs:
        return [(p, a, c) for p, (a, c) in sorted(profs['default'].items())]
    return load()


# --- game -> profile mapping (games.txt) --------------------------------------
_GHEADER = (
    "# RazerKit game profiles -- while <exe> is running, its profile is applied.\n"
    "# columns:  exe | profile      e.g.  cs2.exe | fps\n"
)


def games_path():
    return _docs('games.txt')


def load_games():
    """{exe_lower: profile} from games.txt; {} if missing."""
    p = games_path()
    out = {}
    if not os.path.exists(p):
        return out
    with open(p, encoding='utf-8') as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith('#') or '|' not in s:
                continue
            exe, _, prof = (x.strip() for x in s.partition('|'))
            if exe and prof:
                out[exe.lower()] = prof.lower()
    return out


def _write_games(games):
    w = max([3] + [len(e) for e in games])
    lines = [_GHEADER] + [f"{e:<{w}} | {games[e]}\n" for e in sorted(games)]
    with open(games_path(), 'w', encoding='utf-8') as f:
        f.write("".join(lines))


def set_game(exe, profile):
    profile = _norm_name(profile)
    if profile not in load_profiles():
        raise SystemExit(f"no profile {profile!r} -- save it first: --profile save {profile}")
    games = load_games()
    games[exe.strip().lower()] = profile
    _write_games(games)


def remove_game(exe):
    games = load_games()
    if games.pop(exe.strip().lower(), None) is None:
        raise SystemExit(f"no game mapping for {exe!r}")
    _write_games(games)


# --- run at logon ------------------------------------------------------------
def _launcher():
    """(exe, script) that runs --startup apply; prefer pythonw to hide the console."""
    exe = sys.executable
    if sys.platform == 'win32':
        pyw = exe.replace('python.exe', 'pythonw.exe')
        if os.path.exists(pyw):
            exe = pyw
    return exe, _main_py()


def _startup_dir():
    return os.path.join(os.environ.get('APPDATA', ''), 'Microsoft', 'Windows',
                        'Start Menu', 'Programs', 'Startup')


def _startup_vbs():
    return os.path.join(_startup_dir(), 'RazerRGB.vbs')


def _make_vbs(exe, script):
    """Hidden launcher (window style 0). A bare RazerRGB.vbs *directly* in the Startup
    folder makes Task Manager show the entry as "RazerRGB" -- Startup-folder files are
    labelled by filename, unlike shortcuts (which show their target program, e.g. pythonw)."""
    cmd = f'"{exe}" "{script}" --startup apply'
    with open(_startup_vbs(), 'w', encoding='utf-8') as f:
        f.write(f'CreateObject("Wscript.Shell").Run "{cmd.replace(chr(34), chr(34) * 2)}", 0, False\n')


def install_startup():
    """Run --startup apply at logon. Returns a status string. No admin needed.

    Windows: a hidden RazerRGB.vbs in the user's Startup folder (shows in Task Manager
    > Startup apps as "RazerRGB"). Linux: a ~/.config/autostart entry.
    """
    if not os.path.exists(path()):                 # seed: default device, brand color ff1e00
        save(drivers.DEFAULT_PID, 'static', (0xFF, 0x1E, 0x00))
    exe, script = _launcher()
    if sys.platform == 'win32':
        os.makedirs(_startup_dir(), exist_ok=True)
        _make_vbs(exe, script)
        for old in (os.path.join(_startup_dir(), 'RazerRGB.lnk'),   # clean older iconed-shortcut bits
                    _docs('logo.ico'), _docs('RazerRGB.vbs')):
            if os.path.exists(old):
                os.remove(old)
        return (f'installed Startup launcher (no admin):\n  {_startup_vbs()}\n'
                f'  shows in Task Manager > Startup apps as "RazerRGB". Edit {path()}')
    if sys.platform.startswith('linux'):
        d = os.path.expanduser('~/.config/autostart')
        os.makedirs(d, exist_ok=True)
        desktop = os.path.join(d, 'razer-rgb.desktop')
        with open(desktop, 'w', encoding='utf-8') as f:
            f.write("[Desktop Entry]\nType=Application\nName=RazerKit\n"
                    f'Exec={exe} "{script}" --startup apply\n'
                    "X-GNOME-Autostart-enabled=true\n")
        return f"installed autostart entry {desktop}. Edit {path()}"
    raise SystemExit(f"startup install not supported on {sys.platform}")


def uninstall_startup():
    if sys.platform == 'win32':
        targets = [_startup_vbs(), os.path.join(_startup_dir(), 'RazerRGB.lnk'),
                   _docs('logo.ico'), _docs('RazerRGB.vbs')]
    else:
        targets = [os.path.expanduser('~/.config/autostart/razer-rgb.desktop')]
    removed = []
    for t in targets:
        if os.path.exists(t):
            os.remove(t)
            removed.append(t)
    return "removed: " + ("; ".join(removed) if removed else "nothing was installed")
