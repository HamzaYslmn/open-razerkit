"""Argparse entry point and the no-device self-check."""

import argparse
import sys

import drivers
from modules import settings
from modules.core import (apply, describe, read_status, resolve_action,
                          select_targets, set_brightness, set_dpi, set_poll)
from modules.menu import list_connected, menu


def _dpi_arg(s):
    try:
        vals = [int(v) for v in s.lower().replace('x', ',').split(',')]
    except ValueError:
        raise argparse.ArgumentTypeError("dpi: use N or X,Y (e.g. 1600 or 1600,800)")
    if len(vals) == 1:
        return (vals[0], vals[0])
    if len(vals) == 2:
        return (vals[0], vals[1])
    raise argparse.ArgumentTypeError("dpi: use N or X,Y")


def _print_info(pid):
    st = read_status(pid)
    dev = drivers.get(pid)
    name = dev.name if dev else f"1532:{pid:04x}"
    bits = []
    if st['hz']:
        bits.append(f"{st['hz']} Hz")
    if st['dpi']:
        bits.append(f"{st['dpi'][0]}x{st['dpi'][1]} dpi")
    if st['battery'] is not None:
        bits.append(f"battery {st['battery']}%" + (" (charging)" if st['charging'] else ""))
    if st['firmware']:
        bits.append(f"fw {st['firmware']}")
    if st['serial']:
        bits.append(f"sn {st['serial']}")
    print(f"{name}: " + ("  ".join(bits) if bits else "no readable info"))


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Razer RGB -- set a color or effect (Windows/Linux, no deps). "
                    "No args opens the menu.")
    p.add_argument('action', nargs='?', help="color (red, ff0000) or effect (spectrum, breathing, wave, off)")
    p.add_argument('color', nargs='?', help="color for 'breathing'")
    p.add_argument('-d', '--device', metavar='SEL',
                   help="device: a list number, a pid like 008a, or 'all' (default: auto)")
    p.add_argument('-m', '-i', '--menu', dest='menu', action='store_true', help="open the menu app")
    p.add_argument('--temp', action='store_true', help="apply once: don't save to memory or settings.txt")
    p.add_argument('--startup', choices=('apply', 'install', 'remove'),
                   help="apply settings.txt now, or (un)install the logon task")
    p.add_argument('--brightness', type=int, metavar='PCT', help="set brightness 0-100")
    p.add_argument('--dpi', type=_dpi_arg, metavar='N', help="set mouse DPI: N or X,Y")
    p.add_argument('--poll', type=int, metavar='HZ', help="set polling rate: 1000, 500, or 125")
    p.add_argument('--info', action='store_true', help="read battery/firmware/serial/DPI/Hz from the device")
    p.add_argument('--txn', type=lambda x: int(x, 16), help="advanced: override transaction id (hex)")
    p.add_argument('--led', type=lambda x: int(x, 16), help="advanced: override LED id (hex)")
    p.add_argument('--models', action='store_true', help="list every Razer model the registry knows")
    p.add_argument('--selftest', action='store_true', help="self-check, no device")
    args = p.parse_args(argv)

    if args.selftest:
        return _selftest()
    if args.startup:
        fn = {'apply': _apply_settings, 'install': lambda: print(settings.install_startup()),
              'remove': lambda: print(settings.uninstall_startup())}[args.startup]
        return fn()
    if args.models:
        for d in drivers.all_devices():
            print(f"1532:{d.pid:04x}  {d.category:9} {d.method:10} txn=0x{d.txn:02x}  {d.name}")
        print(f"\n{len(drivers.all_devices())} devices")
        return
    if args.menu:
        return menu()
    ops = args.brightness is not None or args.dpi or args.poll or args.info
    if args.action is None and not ops:  # bare run: menu on a real terminal, list if piped
        return menu() if sys.stdin.isatty() and sys.stdout.isatty() else list_connected()

    action = rgb = None
    if args.action is not None:
        try:
            action, rgb = resolve_action(args.action, args.color)
        except ValueError as e:
            p.error(str(e))

    for pid in select_targets(args.device):       # may raise SystemExit (ambiguous)
        try:
            if action is not None:
                label, used = apply(pid, action, rgb, save=not args.temp, txn=args.txn, led=args.led)
                print(f"set {label} -> {describe(action, rgb)} (method={used})")
                if not args.temp:
                    settings.save(pid, action, rgb)   # so --startup apply reproduces it at logon
            if args.brightness is not None:
                print(f"set {set_brightness(pid, args.brightness, save=not args.temp, txn=args.txn, led=args.led)}"
                      f" brightness -> {args.brightness}%")
            if args.dpi:
                lbl, (x, y) = set_dpi(pid, *args.dpi, txn=args.txn)
                print(f"set {lbl} dpi -> {x}x{y}")
            if args.poll:
                print(f"set {set_poll(pid, args.poll, txn=args.txn)} polling -> {args.poll} Hz")
            if args.info:
                _print_info(pid)
        except (SystemExit, ValueError) as e:   # one device failing shouldn't abort the rest
            print(e)


def _apply_settings():
    """Replay settings.txt onto each listed device. This is what the startup task runs."""
    rows = settings.load()
    if not rows:
        print(f"no settings to apply -- edit {settings.path()} or set a color first")
        return
    for pid, action, rgb in rows:
        try:
            label, used = apply(pid, action, rgb)
            print(f"set {label} -> {describe(action, rgb)} (method={used})")
        except SystemExit as e:
            print(e)


def _selftest():
    b = drivers.build
    r = b('ext_static', 'static', (0xFF, 0x10, 0x20), 0x3F, 0x00)[0]
    assert len(r) == 90 and (r[1], r[6], r[7]) == (0x3F, 0x0F, 0x02)
    assert (r[14], r[15], r[16]) == (0xFF, 0x10, 0x20)
    crc = 0
    for i in range(2, 88):
        crc ^= r[i]
    assert r[88] == crc and crc != 0
    # custom mice (Viper Mini) static = VARSTORE extended-matrix static, so it saves on-device
    f = b('custom', 'static', (1, 2, 3), 0x3F, 0x04)
    assert len(f) == 1 and (f[0][6], f[0][7]) == (0x0F, 0x02)
    assert (f[0][14], f[0][15], f[0][16]) == (1, 2, 3) and f[0][8] == 0x01   # args[0]=VARSTORE
    assert b('ext_static', 'spectrum', None, 0xFF, 0)[0][10] == 0x03
    # custom mice (Viper Mini) animate via extended matrix on the logo LED, not 0x03
    sp = b('custom', 'spectrum', None, 0x3F, 0x04)[0]
    assert (sp[6], sp[7], sp[9], sp[10]) == (0x0F, 0x02, 0x04, 0x03)   # class, id, led, spectrum
    assert b('custom', 'breathing', None, 0x3F, 0x04)[0][1] == 0xFF    # breathing txn override
    assert len(b('logo', 'static', (1, 1, 1), 0xFF, 0x04)) == 3
    assert b('ext_static', 'static', (1, 2, 3), 0xFF, 0, store=True)[0][8] == 0x01
    assert b('ext_static', 'static', (1, 2, 3), 0xFF, 0, store=False)[0][8] == 0x00
    assert drivers.get(0x008A).method == 'custom'
    assert resolve_action('red') == ('static', (255, 0, 0))
    assert resolve_action('spectrum') == ('spectrum', None)
    assert resolve_action('breathing', 'ff0000') == ('breathing', (255, 0, 0))
    assert resolve_action('off') == ('static', (0, 0, 0))     # off == solid black
    assert select_targets('009e') == [0x009e]                 # -d pid hex (no hardware)
    try:
        b('custom', 'wave', None, 0x3F, 0x04)                 # single-LED can't wave
        assert False
    except NotImplementedError:
        pass
    try:
        b('custom', 'reactive', (1, 1, 1), 0x3F, 0x04)        # single-LED can't react
        assert False
    except NotImplementedError:
        pass

    # --- device-internal features (opcodes verified vs openrazer) ------------
    pr = drivers.protocol
    # brightness: ext (0x0F/0x04) vs std LED (0x03/0x03)
    bri = pr.brightness('custom', 200, 0x3F, 0x04, True)[0]
    assert (bri[6], bri[7]) == (0x0F, 0x04) and (bri[8], bri[9], bri[10]) == (0x01, 0x04, 200)
    bls = pr.brightness('std_static', 128, 0xFF, 0x00, True)[0]
    assert (bls[6], bls[7]) == (0x03, 0x03) and (bls[8], bls[9], bls[10]) == (0x01, 0x05, 128)
    # dual-color breathing (ext): size 0x0C, effect 0x02, mode 0x02, two RGBs
    db = b('ext_static', 'breathing', (1, 2, 3), 0x1F, 0x05, rgb2=(4, 5, 6))[0]
    assert db[5] == 0x0C and (db[10], db[11]) == (0x02, 0x02)
    assert (db[14], db[15], db[16]) == (1, 2, 3) and (db[17], db[18], db[19]) == (4, 5, 6)
    # reactive (ext): effect 0x05, speed at arg4, rgb at arg6..8
    re = b('ext_static', 'reactive', (9, 8, 7), 0x1F, 0x05, speed=3)[0]
    assert re[5] == 0x09 and re[10] == 0x05 and re[12] == 3 and re[13] == 0x01
    assert (re[14], re[15], re[16]) == (9, 8, 7)
    # wave direction + speed byte
    wv = b('ext_static', 'wave', None, 0x1F, 0x05, direction=0x02)[0]
    assert (wv[10], wv[11], wv[12]) == (0x04, 0x02, 0x28)
    # std breathing single (0x03/0x0A, size 0x08, mode 0x01)
    sb = b('std_static', 'breathing', (1, 2, 3), 0xFF, 0x00)[0]
    assert (sb[6], sb[7]) == (0x03, 0x0A) and sb[5] == 0x08 and (sb[8], sb[9]) == (0x03, 0x01)
    assert (sb[10], sb[11], sb[12]) == (1, 2, 3)
    # DPI set: big-endian, VARSTORE (1600x800)
    sd = pr.set_dpi(1600, 800, 0xFF)[0]
    assert (sd[6], sd[7]) == (0x04, 0x05) and sd[8] == 0x01
    assert (sd[9], sd[10], sd[11], sd[12]) == (0x06, 0x40, 0x03, 0x20)
    # polling-rate set + validation
    assert pr.set_poll(500, 0xFF)[0][8] == 0x02
    try:
        pr.set_poll(333, 0xFF)                                 # only 1000/500/125
        assert False
    except ValueError:
        pass
    # query builders: class/id (+ serial data_size 0x16)
    assert (pr.q_firmware(0xFF)[6], pr.q_firmware(0xFF)[7]) == (0x00, 0x81)
    assert pr.q_serial(0xFF)[5] == 0x16 and pr.q_battery(0xFF)[6] == 0x07
    assert (pr.q_dpi(0xFF)[6], pr.q_dpi(0xFF)[7]) == (0x04, 0x85)
    print(f"selftest ok ({len(drivers.all_devices())} devices in registry)")
