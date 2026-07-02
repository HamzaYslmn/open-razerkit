<p align="center">
  <img src="docs/logo.png" alt="open-razerkit logo" width="140" />
</p>

<h1 align="center">open-razerkit</h1>

> Control your Razer device's RGB, effects, and settings — from the terminal or the browser. No extra software, no drivers, no background process.

![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue)
![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![python](https://img.shields.io/badge/python-3.14%2B-blue)
[![web app](https://img.shields.io/badge/web%20app-WebHID-10b981)](https://hamzayslmn.github.io/open-razerkit/)
[![sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ec4899)](https://github.com/sponsors/HamzaYslmn)

I got really tired of the Razer app and other things always running in the background, so I wrote this small Python app. It talks to the device directly over USB-HID, sets the color, and exits.

> **No install at all?** There's also a **[browser version](https://hamzayslmn.github.io/open-razerkit/)** — same protocol over WebHID. Just open it in Chrome/Edge and click *Connect*. See [Browser app](#-browser-app-no-install).

## ✨ Why

- **Nothing runs in the background** — it sets the lighting and quits.
- **Zero dependencies** — pure Python standard library.
- **Windows & Linux** — picks the right HID backend automatically.
- **Saves to the mouse's onboard memory**, so the color sticks with no software running — including on the **Viper Mini**, where Razer hides this feature.

## 📦 Setup

Needs [uv](https://docs.astral.sh/uv/) — it brings its own Python, so there's nothing else to install.

**Windows**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
uv sync
```

**Linux / macOS**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync
```

`uv sync` sets up the venv and Python 3.14 (still zero dependencies).

## 🎨 Usage

```bash
uv run python src/main.py                 # list devices, or open the menu in a terminal
uv run python src/main.py red             # solid color (name, ff0000, or '255,0,0')
uv run python src/main.py spectrum        # on-device effect
uv run python src/main.py breathing 00ff88
uv run python src/main.py reactive ff0000 # light up on keypress/click (multi-zone)
uv run python src/main.py starlight 00ff88 # twinkling stars (multi-zone)
uv run python src/main.py off             # solid black
uv run python src/main.py red -d all      # every connected Razer device
uv run python src/main.py -m              # interactive menu
```

`-d` picks a device by list number (`-d 2`), product id (`-d 008a`), or `all`. The color saves to onboard memory by default; add `--temp` to apply it just once.

Other device-internal settings (stored on the device, no software needed afterward):

```bash
uv run python src/main.py --brightness 60     # brightness 0-100
uv run python src/main.py --dpi 1600          # mouse DPI (or --dpi 1600,800 for x,y)
uv run python src/main.py --poll 1000         # polling: 8000/4000/2000/1000/500/250/125 Hz (HyperPolling)
uv run python src/main.py --info              # read battery, firmware, serial, DPI, Hz
```

The **browser app** additionally has a **per-key keyboard editor** and a **per-zone mouse editor** (logo, scroll wheel, side strips, underglow), plus scroll-wheel modes, game/macro toggles, and **named profiles** (saved in the browser).

## 🗂 Profiles & game detection

Save the lighting of all your devices under a name, then bring it back with one command — and have a profile apply automatically **when a game starts** (reverting to `default` when it exits):

```bash
uv run python src/main.py red                      # set things up how you like them...
uv run python src/main.py --profile save default   # ...and snapshot that as the fallback
uv run python src/main.py 00ff88 && uv run python src/main.py --profile save fps
uv run python src/main.py --profile load fps       # apply a profile (list / delete too)

uv run python src/main.py --game add cs2.exe fps   # while CS2 is in the foreground -> [fps]
uv run python src/main.py --watch                  # watch & auto-switch (ctrl-c to stop)
```

Profiles live in `docs/profiles.txt` and the game map in `docs/games.txt` — both plain, editable text. If any game mappings exist, the **startup launcher keeps watching after logon**, so game detection works with zero extra setup (`--startup install`). Detection is the *foreground app* on Windows (UWP/Store games included) and a process scan on Linux (Wine/Proton titles are matched best-effort by their `.exe` name).

## 🎧 Headset EQ (BlackShark V2 Pro)

Some wireless Razer headsets keep their **equalizer in the headset's own DSP**, set over a vendor HID interface — so RazerKit can set it with no Synapse and no audio driver:

```bash
uv run python src/main.py -d 0555 --eq game               # flat | game | music | movie
uv run python src/main.py -d 0555 --eq 0,0,-2,0,3,3,2,1,0,0   # 10 custom band gains
```

Verified protocol for the **BlackShark V2 Pro (1532:0555)** only; other headsets either use a host-side DSP in Synapse (nothing on-device to set) or an uncaptured protocol — `--force` lets you try anyway. Wired Kraken-family EQ ("THX Spatial") is host software, not the headset, so no tool can set it device-side.

## 💻 Razer Blade laptop (performance & battery)

Blade laptops expose **performance mode and the battery charge limit over the same USB-HID protocol** (the keyboard MCU bridges to the embedded controller), so RazerKit drives them too — no Synapse. Performance mode also sets the firmware fan curve; there's deliberately **no manual fan-rpm knob** (a bad fixed speed is a thermal risk).

```bash
uv run python src/main.py --perf gaming    # balanced | gaming | creator (also sets the fan curve)
uv run python src/main.py --charge 80      # cap charging at 50-95%  (--charge off = no limit)
uv run python src/main.py --info           # also shows perf mode / fan rpm / charge limit on a Blade
```

**GPU MUX / Optimus switching is _not_ possible from any userland tool** — on 2023+ Blades (Advanced Optimus) the switch lives in **NVIDIA Control Panel → Manage Display Mode** (NVIDIA has declined to expose an API; Razer removed it from Synapse on these models on purpose), and on older Blades it's a firmware setting + reboot. What RazerKit *can* do is power the dGPU off/on at the device level ("Eco", the same approach ASUS G-Helper uses) — saves battery when you're on iGPU-only work:

```bash
uv run python src/main.py --gpu status    # list iGPU/dGPU and their state (+ MUX guidance)
uv run python src/main.py --gpu eco       # power the NVIDIA dGPU off (admin, Windows)
uv run python src/main.py --gpu on        # bring it back
```

## 🌐 Browser app (no install)

Don't want to install anything — not even Python? Open the **[web version](https://hamzayslmn.github.io/open-razerkit/)** in Chrome or Edge, click **Connect**, pick your device, and set colors/effects. It speaks the exact same Razer HID protocol from the browser via [WebHID](https://developer.mozilla.org/docs/Web/API/WebHID_API).

- Same 281-model table, same color/effect builders as the CLI.
- Runs entirely client-side — nothing is uploaded, no background process.
- Or run it locally: `python -m http.server` in the repo, then open `http://localhost:8000/frontend/`.

> Chrome blocks WebHID on *protected* (mouse/keyboard) HID collections, so a few devices whose control interface is a plain mouse collection may be refused by the browser — the app tells you when that happens. The CLI has no such restriction.

## 🔌 Device access

**Windows** — works out of the box. If other RGB software is running, close it first — it can re-apply its own profile and overwrite your color.

**Linux** — you need write access to `/dev/hidraw*`. Either run with `sudo`, or add a udev rule once:
```bash
echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="1532", MODE="0660", TAG+="uaccess"' \
  | sudo tee /etc/udev/rules.d/99-razer.rules
sudo udevadm control --reload && sudo udevadm trigger
```

## 🚀 Run at startup

Re-apply your saved colors at every logon (replays `settings.txt`):

**Windows** — no admin needed. Drops a hidden `RazerRGB.vbs` in your Startup folder; it appears in **Task Manager → Startup apps** as *RazerRGB*, where you can toggle it too.
```powershell
uv run python src/main.py --startup install
uv run python src/main.py --startup remove     # undo
```

**Linux** — no admin needed (adds a `~/.config/autostart` entry):
```bash
uv run python src/main.py --startup install
uv run python src/main.py --startup remove     # undo
```

## 🤖 MCP server (control it from Claude / AI agents)

A built-in [MCP](https://modelcontextprotocol.io) server lets Claude (or any MCP client) change your lighting — still **dep-free**, pure stdlib over stdio.

```bash
uv run python src/mcp_server.py
```

Tools: `list_devices`, `set_color`, `set_effect`, `get_polling_rate`. For **Claude Code**, the included [`.mcp.json`](.mcp.json) registers it automatically — open the project and approve the `razerkit` server when prompted (or run `/mcp`). Then just ask: *"set my mouse to ff1e00"*.

## 📝 Notes

Verified on the Razer Viper Mini; ~260 other models are included. Some may need a tweak — `--txn` / `--led` are there for tuning. Effects like `wave` need a multi-zone device; single-LED mice (Viper Mini) say so instead of doing nothing.

## ❤️ Sponsor

If this saved you from running Synapse in the background, consider [sponsoring on GitHub](https://github.com/sponsors/HamzaYslmn) — it keeps projects like this maintained.
