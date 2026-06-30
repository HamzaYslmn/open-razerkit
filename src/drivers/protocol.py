"""Razer USB-HID protocol: build reports that set a color, run an on-device effect,
set brightness, or query device state (battery / firmware / serial / DPI / polling).

Platform independent -- the transport lives in `transport`. `build(method, action,
rgb, txn, led, store)` returns the report sequence for one lighting action; `store=True`
(VARSTORE) asks the device to keep the setting in its onboard memory, `store=False`
(NOSTORE) is volatile. Opcodes verified against openrazer master (razerchromacommon.c).
"""

# LED ids / flags
ZERO_LED, SCROLL_WHEEL_LED, LOGO_LED, BACKLIGHT_LED = 0x00, 0x01, 0x04, 0x05
VARSTORE, NOSTORE, ON, OFF = 0x01, 0x00, 0x01, 0x00

ACTIONS = ("static", "off", "spectrum", "breathing", "wave", "reactive")
METHODS = ("ext_static", "std_static", "custom", "logo")

WAVE_SPEED = 0x28          # ponytail: openrazer's default wave speed; lower = faster
POLL_CODES = {1000: 0x01, 500: 0x02, 125: 0x08}   # standard polling-rate map (0x00/0x05)


def razer_report(command_class, command_id, data_size, arguments, txn):
    """One 90-byte Razer report. `arguments` start at byte 8 (= arguments[0])."""
    r = bytearray(90)
    r[1] = txn
    r[5] = data_size
    r[6] = command_class
    r[7] = command_id
    r[8:8 + len(arguments)] = arguments
    crc = 0
    for i in range(2, 88):          # CRC = XOR of bytes 2..87, stored at byte 88
        crc ^= r[i]
    r[88] = crc
    return bytes(r)


# --- extended matrix (cmd 0x0F/0x02; args[0]=store, [1]=led, [2]=effect) -----
def _ext_static(rgb, txn, led, sv):
    a = bytearray(9)
    a[0], a[1], a[2], a[5] = sv, led, 0x01, 0x01
    a[6], a[7], a[8] = rgb
    return [razer_report(0x0F, 0x02, 0x09, a, txn)]


def _ext_simple(effect, txn, led, sv):
    a = bytearray(3)
    a[0], a[1], a[2] = sv, led, effect
    return [razer_report(0x0F, 0x02, 0x06, a, txn)]


def _ext_breathing(rgb, rgb2, txn, led, sv):
    if rgb and any(rgb) and rgb2 and any(rgb2):       # breathe between two colors
        a = bytearray(12)
        a[0], a[1], a[2], a[3], a[5] = sv, led, 0x02, 0x02, 0x02
        a[6], a[7], a[8] = rgb
        a[9], a[10], a[11] = rgb2
        return [razer_report(0x0F, 0x02, 0x0C, a, txn)]
    if rgb and any(rgb):                              # breathe one chosen color
        a = bytearray(9)
        a[0], a[1], a[2], a[3], a[5] = sv, led, 0x02, 0x01, 0x01
        a[6], a[7], a[8] = rgb
        return [razer_report(0x0F, 0x02, 0x09, a, txn)]
    return _ext_simple(0x02, txn, led, sv)            # random


def _ext_wave(txn, led, sv, direction):
    a = bytearray(5)
    a[0], a[1], a[2], a[3], a[4] = sv, led, 0x04, direction, WAVE_SPEED
    return [razer_report(0x0F, 0x02, 0x06, a, txn)]


def _ext_reactive(rgb, txn, led, sv, speed):
    a = bytearray(9)
    a[0], a[1], a[2], a[4], a[5] = sv, led, 0x05, speed, 0x01
    a[6], a[7], a[8] = rgb
    return [razer_report(0x0F, 0x02, 0x09, a, txn)]


# --- custom frame (the old Viper Mini static path; kept, unused) --------------
def _custom_static(rgb, txn, led, sv):
    frame = bytearray(8)
    frame[5], frame[6], frame[7] = rgb            # row/start/stop cols stay 0
    show = bytearray(3)
    show[2] = 0x08
    return [razer_report(0x0F, 0x03, 0x47, frame, txn),
            razer_report(0x0F, 0x02, 0x0C, show, txn)]


# --- standard matrix (cmd 0x03/0x0A; args[0]=effect id) ----------------------
def _std_static(rgb, txn, led, sv):
    a = bytearray(4)
    a[0] = 0x06                                    # MATRIX_EFFECT_STATIC
    a[1], a[2], a[3] = rgb
    return [razer_report(0x03, 0x0A, 0x04, a, txn)]


def _std_simple(effect, txn):
    return [razer_report(0x03, 0x0A, 0x01, bytes([effect]), txn)]


def _std_breathing(rgb, rgb2, txn):
    a = bytearray(8)
    a[0] = 0x03                                    # MATRIX_EFFECT_BREATHING
    if rgb and any(rgb) and rgb2 and any(rgb2):
        a[1] = 0x02                                # dual
        a[2], a[3], a[4] = rgb
        a[5], a[6], a[7] = rgb2
    elif rgb and any(rgb):
        a[1] = 0x01                                # single
        a[2], a[3], a[4] = rgb
    else:
        a[1] = 0x03                                # random
    return [razer_report(0x03, 0x0A, 0x08, a, txn)]


def _std_wave(txn, direction):
    return [razer_report(0x03, 0x0A, 0x02, bytes([0x01, direction]), txn)]


def _std_reactive(rgb, txn, speed):
    a = bytearray(5)
    a[0], a[1] = 0x02, speed                       # MATRIX_EFFECT_REACTIVE
    a[2], a[3], a[4] = rgb
    return [razer_report(0x03, 0x0A, 0x05, a, txn)]


# --- standard LED / logo (CLASSIC effects via set_led_effect) ----------------
def _logo_static(rgb, txn, led, sv):
    led = led or LOGO_LED
    rgb_a = bytearray([sv, led, rgb[0], rgb[1], rgb[2]])
    return [razer_report(0x03, 0x01, 0x05, rgb_a, txn),
            razer_report(0x03, 0x02, 0x03, bytes([sv, led, 0x00]), txn),   # CLASSIC static
            razer_report(0x03, 0x00, 0x03, bytes([sv, led, ON]), txn)]


def _logo_effect(effect, txn, led, sv):
    led = led or LOGO_LED
    return [razer_report(0x03, 0x02, 0x03, bytes([sv, led, effect]), txn),
            razer_report(0x03, 0x00, 0x03, bytes([sv, led, ON]), txn)]


def _logo_off(txn, led, sv):
    led = led or LOGO_LED
    return [razer_report(0x03, 0x00, 0x03, bytes([sv, led, OFF]), txn)]


# 'custom' static uses the VARSTORE extended-matrix static so the color is stored
# on-device. custom/logo are single-LED -> animate via their family below.
_STATIC = {"ext_static": _ext_static, "std_static": _std_static,
           "custom": _ext_static, "logo": _logo_static}
_FAMILY = {"ext_static": "ext", "std_static": "std", "custom": "ext", "logo": "logo"}
_SINGLE_LED = ("custom", "logo")   # can't wave / react -- one zone


def build(method, action, rgb, txn, led, store=True, *, rgb2=None, speed=0x02, direction=0x01):
    """Reports for one lighting action. action in ACTIONS; rgb is a 3-tuple (or None).

    rgb2 = second color (dual breathing). speed = reactive/effect speed (1-4).
    direction = wave direction (0/1 or 1/2 depending on firmware). Raises
    NotImplementedError for unsupported (method, action) combos.
    """
    if method not in METHODS:
        raise NotImplementedError(f"lighting method {method!r} not implemented")
    sv = VARSTORE if store else NOSTORE
    fam = _FAMILY[method]
    if action == "static":
        return _STATIC[method](rgb or (0, 0, 0), txn, led, sv)
    if action == "off":
        return (_ext_simple(0x00, txn, led, sv) if fam == "ext"
                else _std_simple(0x00, txn) if fam == "std" else _logo_off(txn, led, sv))
    if action == "spectrum":
        return (_ext_simple(0x03, txn, led, sv) if fam == "ext"
                else _std_simple(0x04, txn) if fam == "std" else _logo_effect(0x04, txn, led, sv))
    if action == "breathing":
        if method == "custom":
            txn = 0xFF                              # Viper-Mini-class breathing uses txn 0xff
        return (_ext_breathing(rgb, rgb2, txn, led, sv) if fam == "ext"
                else _std_breathing(rgb, rgb2, txn) if fam == "std" else _logo_effect(0x02, txn, led, sv))
    if action == "wave":
        if method in _SINGLE_LED:
            raise NotImplementedError("wave needs a multi-zone device; this one has a single LED")
        return _ext_wave(txn, led, sv, direction) if fam == "ext" else _std_wave(txn, direction)
    if action == "reactive":
        if method in _SINGLE_LED:
            raise NotImplementedError("reactive needs a multi-zone device; this one has a single LED")
        return (_ext_reactive(rgb or (0, 0, 0), txn, led, sv, speed) if fam == "ext"
                else _std_reactive(rgb or (0, 0, 0), txn, speed))
    raise NotImplementedError(f"{action!r} not available for {method!r} devices")


# --- brightness --------------------------------------------------------------
def brightness(method, level, txn, led, store=True):
    """Set brightness 0-255. ext/custom -> 0x0F/0x04; std/logo -> 0x03/0x03."""
    level = max(0, min(255, int(level)))
    sv = VARSTORE if store else NOSTORE
    if method in ("ext_static", "custom"):
        return [razer_report(0x0F, 0x04, 0x03, bytes([sv, led, level]), txn)]
    bled = led or (BACKLIGHT_LED if method == "std_static" else LOGO_LED)
    return [razer_report(0x03, 0x03, 0x03, bytes([sv, bled, level]), txn)]


# --- device-state queries (send these; transport reads the 90-byte reply) ----
def q_firmware(txn): return razer_report(0x00, 0x81, 0x02, b"", txn)   # resp arg0.arg1
def q_serial(txn):   return razer_report(0x00, 0x82, 0x16, b"", txn)   # resp arg0..21 ASCII
def q_battery(txn):  return razer_report(0x07, 0x80, 0x02, b"", txn)   # resp arg1 (0-255)
def q_charging(txn): return razer_report(0x07, 0x84, 0x02, b"", txn)   # resp arg1 (0/1)
def q_dpi(txn):      return razer_report(0x04, 0x85, 0x07, bytes([NOSTORE]), txn)  # resp arg1..4
def q_poll(txn):     return razer_report(0x00, 0x85, 0x01, b"", txn)   # resp arg0 code


# --- device-state writes -----------------------------------------------------
def set_dpi(x, y, txn):
    """Set DPI (big-endian, VARSTORE). x/y clamped 100-30000."""
    x = max(100, min(30000, int(x)))
    y = max(100, min(30000, int(y)))
    a = bytes([VARSTORE, x >> 8, x & 0xFF, y >> 8, y & 0xFF, 0x00, 0x00])
    return [razer_report(0x04, 0x05, 0x07, a, txn)]


def set_poll(hz, txn):
    """Set polling rate. hz in {1000, 500, 125}."""
    code = POLL_CODES.get(int(hz))
    if code is None:
        raise ValueError("polling rate must be 1000, 500, or 125")
    return [razer_report(0x00, 0x05, 0x01, bytes([code]), txn)]
