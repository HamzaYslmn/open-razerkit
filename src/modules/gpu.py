"""Laptop dGPU power control ("Eco") + honest GPU-MUX guidance.

A true MUX / Advanced-Optimus display switch is NOT reachable from userland:
NVIDIA only exposes it through its Control Panel (they've declined to add an
API), and on pre-2023 Blades Synapse flips a firmware setting and reboots.
What CAN be done portably is powering the dGPU off/on at the PnP level --
the same "Eco mode" trick G-Helper-style tools use. Saves battery; needs admin.

Windows: PowerShell PnP cmdlets with JSON output (locale-safe -- pnputil's
text labels are localized). Linux: status via sysfs; switching is left to
supergfxctl, which already does it properly.
"""

import json
import subprocess
import sys

_MUX_NOTE = ("note: a true GPU-MUX switch isn't possible from userland. 2023+ Blades "
             "(Advanced Optimus): NVIDIA Control Panel > Manage Display Mode. Older "
             "Blades: Synapse GPU MODE / BIOS (reboots). 'eco' below just powers the "
             "dGPU off at the PnP level instead.")


def _ps(cmd):
    r = subprocess.run(['powershell', '-NoProfile', '-Command', cmd],
                       capture_output=True, text=True)
    return r.returncode, (r.stdout or '').strip(), (r.stderr or '').strip()


def _win_gpus():
    """[{FriendlyName, InstanceId, Status}] for every display adapter."""
    code, out, err = _ps("Get-PnpDevice -Class Display | "
                         "Select-Object FriendlyName,InstanceId,Status | ConvertTo-Json -Compress")
    if code or not out:
        raise SystemExit(f"could not enumerate GPUs: {err or 'no output'}")
    data = json.loads(out)
    return [data] if isinstance(data, dict) else list(data)


def _is_nvidia(gpu):
    return 'VEN_10DE' in (gpu.get('InstanceId') or '')


def status():
    print(_MUX_NOTE + "\n")
    if sys.platform == 'win32':
        for g in _win_gpus():
            tag = "dGPU" if _is_nvidia(g) else "iGPU"
            print(f"{tag}  {g.get('Status'):<8}  {g.get('FriendlyName')}")
        return
    if sys.platform.startswith('linux'):
        import glob
        import os
        for dev in sorted(glob.glob('/sys/bus/pci/devices/*')):
            try:
                with open(os.path.join(dev, 'class')) as f:
                    if not f.read().startswith('0x03'):     # display controller
                        continue
                with open(os.path.join(dev, 'vendor')) as f:
                    vendor = f.read().strip()
                power = '?'
                try:
                    with open(os.path.join(dev, 'power', 'runtime_status')) as f:
                        power = f.read().strip()
                except OSError:
                    pass
            except OSError:
                continue
            tag = "dGPU" if vendor == '0x10de' else "iGPU"
            print(f"{tag}  {power:<10}  {os.path.basename(dev)}  (vendor {vendor})")
        print("\nto switch on Linux use supergfxctl (Integrated mode = dGPU off)")
        return
    raise SystemExit(f"--gpu is not supported on {sys.platform}")


def set_dgpu(on):
    """Enable/disable the NVIDIA dGPU at the PnP level (Windows, admin)."""
    if not sys.platform == 'win32':
        raise SystemExit("dGPU eco/on is Windows-only here -- on Linux use supergfxctl")
    gpus = [g for g in _win_gpus() if _is_nvidia(g)]
    if not gpus:
        raise SystemExit("no NVIDIA dGPU found")
    verb = 'Enable' if on else 'Disable'
    for g in gpus:
        iid = g['InstanceId'].replace("'", "''")
        code, _out, err = _ps(f"{verb}-PnpDevice -InstanceId '{iid}' -Confirm:$false")
        if code:
            hint = " (run as administrator?)" if "denied" in err.lower() or "erişim" in err.lower() else ""
            raise SystemExit(f"{verb.lower()} failed for {g.get('FriendlyName')}: {err}{hint}")
        print(f"{verb.lower()}d {g.get('FriendlyName')}")
    if not on:
        print("dGPU is now off (Eco). If the screen blanked, your panel was wired to the "
              "dGPU -- press Win+Ctrl+Shift+B or reboot, then use NVIDIA Control Panel for "
              "display-mode changes instead.")


def main(cmd):
    if cmd == 'status':
        return status()
    return set_dgpu(cmd == 'on')
