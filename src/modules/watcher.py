"""Game profile detection: swap lighting profiles as mapped games start/stop.

Windows: the *foreground* app (ctypes user32/kernel32 -- what you're actually
playing). Linux: a /proc scan (no X11 deps, works on Wayland/console too).
Matching is by exe basename, case-insensitive, with and without the extension.
"""

import os
import sys
import time

from modules import settings
from modules.core import apply

POLL_S = 2.0        # ponytail: fixed 2s poll (simpler than a SetWinEventHook message pump); near-zero CPU


if sys.platform == 'win32':
    import ctypes
    from ctypes import wintypes

    _u32 = ctypes.WinDLL('user32', use_last_error=True)
    _k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    _PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    # explicit signatures: HWND/HANDLE are 64-bit -- ctypes' int default truncates them
    _u32.GetForegroundWindow.restype = wintypes.HWND
    _u32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    _u32.GetWindowThreadProcessId.restype = wintypes.DWORD
    _WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    _u32.EnumChildWindows.argtypes = [wintypes.HWND, _WNDENUMPROC, wintypes.LPARAM]
    _k32.OpenProcess.restype = wintypes.HANDLE
    _k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    _k32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    _k32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                                                wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    _k32.CloseHandle.argtypes = [wintypes.HANDLE]

    def _exe_of_hwnd(hwnd):
        """Lowercased exe basename owning this window, or None."""
        pid = wintypes.DWORD()
        _u32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        h = _k32.OpenProcess(_PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
        if not h:
            return None
        try:
            buf = ctypes.create_unicode_buffer(1024)
            n = wintypes.DWORD(len(buf))
            if _k32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(n)):
                return os.path.basename(buf.value).lower()
        finally:
            _k32.CloseHandle(h)
        return None

    def running_exes():
        """{foreground exe basename, lowercased} -- empty set if unreadable."""
        hwnd = _u32.GetForegroundWindow()
        if not hwnd:
            return set()
        exe = _exe_of_hwnd(hwnd)
        if exe == 'applicationframehost.exe':
            # UWP/Store games are wrapped by the frame host; the real app owns a child window
            found = []

            @_WNDENUMPROC
            def _cb(child, _lparam):
                e = _exe_of_hwnd(child)
                if e and e != 'applicationframehost.exe':
                    found.append(e)
                    return False                       # stop enumerating
                return True
            _u32.EnumChildWindows(hwnd, _cb, 0)
            if found:
                exe = found[0]
        return {exe} if exe else set()
else:
    def running_exes():
        """Program basenames from every process's cmdline.

        Checks argv[0] plus any later token ending in .exe -- under Wine/Proton
        argv[0] is often the preloader while the game path appears as a later arg.
        """
        out = set()
        for p in os.listdir('/proc'):
            if not p.isdigit():
                continue
            try:
                with open(f'/proc/{p}/cmdline', 'rb') as f:
                    argv = f.read().split(b'\0')
            except OSError:
                continue
            for i, tok in enumerate(argv):
                t = tok.decode('utf-8', 'ignore')
                if not t:
                    continue
                base = os.path.basename(t.replace('\\', '/')).lower()
                if i == 0 or base.endswith('.exe'):
                    out.add(base)
        return out


def match(exes, games):
    """Profile name for the first mapped exe found, else None (extension optional)."""
    for exe in exes:
        prof = games.get(exe) or games.get(os.path.splitext(exe)[0])
        if prof:
            return prof
    return None


def _apply_rows(rows, status):
    for pid, action, rgb in rows:
        try:
            apply(pid, action, rgb, save=False)      # volatile: don't clobber onboard memory
        except SystemExit as e:                       # device unplugged -- keep watching
            status(str(e))


def watch(status=print):
    """Poll forever: mapped game in foreground -> its profile; gone -> default."""
    if not settings.load_games():
        raise SystemExit(f"no game mappings -- add one first:\n"
                         f"  main.py --profile save <name>\n"
                         f"  main.py --game add <exe> <name>\n({settings.games_path()})")
    status(f"watching for mapped games every {POLL_S:g}s (ctrl-c to stop)")
    current = None                                    # active game profile; None = default
    while True:
        games = settings.load_games()                 # reload: edits take effect live
        prof = match(running_exes(), games)
        if prof != current:
            try:
                rows = settings.profile_rows(prof) if prof else settings.default_rows()
            except SystemExit as e:                   # mapped profile was deleted
                status(str(e))
                rows = []
            _apply_rows(rows, status)
            status(f"[watch] -> {prof or 'default'}")
            current = prof
        time.sleep(POLL_S)
