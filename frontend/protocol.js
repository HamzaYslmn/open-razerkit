// Port of src/drivers/protocol.py -- builds the Razer report sequences for one
// action, plus brightness, device-state queries, and DPI/polling writes.
// Classic script (no modules) so file:// works. Opcodes verified vs openrazer.

const LOGO_LED = 0x04, BACKLIGHT_LED = 0x05;
const VARSTORE = 0x01, NOSTORE = 0x00, ON = 0x01, OFF = 0x00;
const ACTIONS = ["static", "off", "spectrum", "breathing", "wave", "reactive"];
const METHODS = ["ext_static", "std_static", "custom", "logo"];
const WAVE_SPEED = 0x28;
const POLL_CODES = { 1000: 0x01, 500: 0x02, 125: 0x08 };

function razerReport(cls, id, dataSize, args, txn) {
  // One 90-byte Razer report. args start at byte 8. CRC = XOR of bytes 2..87 at byte 88.
  const r = new Uint8Array(90);
  r[1] = txn; r[5] = dataSize; r[6] = cls; r[7] = id;
  r.set(args, 8);
  let crc = 0;
  for (let i = 2; i < 88; i++) crc ^= r[i];
  r[88] = crc;
  return r;
}

const anyRGB = (rgb) => rgb && (rgb[0] || rgb[1] || rgb[2]);

// --- extended matrix (0x0F/0x02) ---------------------------------------------
function extStatic(rgb, txn, led, sv) {
  const a = new Uint8Array(9);
  a[0] = sv; a[1] = led; a[2] = 0x01; a[5] = 0x01;
  a[6] = rgb[0]; a[7] = rgb[1]; a[8] = rgb[2];
  return [razerReport(0x0F, 0x02, 0x09, a, txn)];
}
function extSimple(effect, txn, led, sv) {
  return [razerReport(0x0F, 0x02, 0x06, [sv, led, effect], txn)];
}
function extBreathing(rgb, rgb2, txn, led, sv) {
  if (anyRGB(rgb) && anyRGB(rgb2)) {
    const a = new Uint8Array(12);
    a[0] = sv; a[1] = led; a[2] = 0x02; a[3] = 0x02; a[5] = 0x02;
    a[6] = rgb[0]; a[7] = rgb[1]; a[8] = rgb[2];
    a[9] = rgb2[0]; a[10] = rgb2[1]; a[11] = rgb2[2];
    return [razerReport(0x0F, 0x02, 0x0C, a, txn)];
  }
  if (anyRGB(rgb)) {
    const a = new Uint8Array(9);
    a[0] = sv; a[1] = led; a[2] = 0x02; a[3] = 0x01; a[5] = 0x01;
    a[6] = rgb[0]; a[7] = rgb[1]; a[8] = rgb[2];
    return [razerReport(0x0F, 0x02, 0x09, a, txn)];
  }
  return extSimple(0x02, txn, led, sv);
}
function extWave(txn, led, sv, direction) {
  return [razerReport(0x0F, 0x02, 0x06, [sv, led, 0x04, direction, WAVE_SPEED], txn)];
}
function extReactive(rgb, txn, led, sv, speed) {
  const a = new Uint8Array(9);
  a[0] = sv; a[1] = led; a[2] = 0x05; a[4] = speed; a[5] = 0x01;
  a[6] = rgb[0]; a[7] = rgb[1]; a[8] = rgb[2];
  return [razerReport(0x0F, 0x02, 0x09, a, txn)];
}

// --- standard matrix (0x03/0x0A) ---------------------------------------------
function stdStatic(rgb, txn, led, sv) {
  return [razerReport(0x03, 0x0A, 0x04, [0x06, rgb[0], rgb[1], rgb[2]], txn)];
}
function stdSimple(effect, txn) {
  return [razerReport(0x03, 0x0A, 0x01, [effect], txn)];
}
function stdBreathing(rgb, rgb2, txn) {
  const a = new Uint8Array(8);
  a[0] = 0x03;
  if (anyRGB(rgb) && anyRGB(rgb2)) {
    a[1] = 0x02; a[2] = rgb[0]; a[3] = rgb[1]; a[4] = rgb[2];
    a[5] = rgb2[0]; a[6] = rgb2[1]; a[7] = rgb2[2];
  } else if (anyRGB(rgb)) {
    a[1] = 0x01; a[2] = rgb[0]; a[3] = rgb[1]; a[4] = rgb[2];
  } else {
    a[1] = 0x03;
  }
  return [razerReport(0x03, 0x0A, 0x08, a, txn)];
}
function stdWave(txn, direction) {
  return [razerReport(0x03, 0x0A, 0x02, [0x01, direction], txn)];
}
function stdReactive(rgb, txn, speed) {
  return [razerReport(0x03, 0x0A, 0x05, [0x02, speed, rgb[0], rgb[1], rgb[2]], txn)];
}

// --- standard LED / logo (0x03 CLASSIC effects) ------------------------------
function logoStatic(rgb, txn, led, sv) {
  led = led || LOGO_LED;
  return [razerReport(0x03, 0x01, 0x05, [sv, led, rgb[0], rgb[1], rgb[2]], txn),
          razerReport(0x03, 0x02, 0x03, [sv, led, 0x00], txn),
          razerReport(0x03, 0x00, 0x03, [sv, led, ON], txn)];
}
function logoEffect(effect, txn, led, sv) {
  led = led || LOGO_LED;
  return [razerReport(0x03, 0x02, 0x03, [sv, led, effect], txn),
          razerReport(0x03, 0x00, 0x03, [sv, led, ON], txn)];
}
function logoOff(txn, led, sv) {
  led = led || LOGO_LED;
  return [razerReport(0x03, 0x00, 0x03, [sv, led, OFF], txn)];
}

const STATIC = { ext_static: extStatic, std_static: stdStatic, custom: extStatic, logo: logoStatic };
const FAMILY = { ext_static: "ext", std_static: "std", custom: "ext", logo: "logo" };
const SINGLE_LED = ["custom", "logo"];

function buildReports(method, action, rgb, txn, led, store = true, opts = {}) {
  // Reports for one lighting action. opts: { rgb2, speed, direction }.
  if (!METHODS.includes(method)) throw new Error(`lighting method '${method}' not implemented`);
  const sv = store ? VARSTORE : NOSTORE, fam = FAMILY[method];
  const speed = opts.speed || 0x02, direction = opts.direction || 0x01, rgb2 = opts.rgb2 || null;
  if (action === "static") return STATIC[method](rgb || [0, 0, 0], txn, led, sv);
  if (action === "off")
    return fam === "ext" ? extSimple(0x00, txn, led, sv) : fam === "std" ? stdSimple(0x00, txn) : logoOff(txn, led, sv);
  if (action === "spectrum")
    return fam === "ext" ? extSimple(0x03, txn, led, sv) : fam === "std" ? stdSimple(0x04, txn) : logoEffect(0x04, txn, led, sv);
  if (action === "breathing") {
    if (method === "custom") txn = 0xFF;               // Viper-Mini-class breathing
    return fam === "ext" ? extBreathing(rgb, rgb2, txn, led, sv)
         : fam === "std" ? stdBreathing(rgb, rgb2, txn) : logoEffect(0x02, txn, led, sv);
  }
  if (action === "wave") {
    if (SINGLE_LED.includes(method)) throw new Error("wave needs a multi-zone device; this one has a single LED");
    return fam === "ext" ? extWave(txn, led, sv, direction) : stdWave(txn, direction);
  }
  if (action === "reactive") {
    if (SINGLE_LED.includes(method)) throw new Error("reactive needs a multi-zone device; this one has a single LED");
    return fam === "ext" ? extReactive(rgb || [0, 0, 0], txn, led, sv, speed) : stdReactive(rgb || [0, 0, 0], txn, speed);
  }
  throw new Error(`'${action}' not available for '${method}' devices`);
}

// --- brightness --------------------------------------------------------------
function brightnessReport(method, level, txn, led, store = true) {
  level = Math.max(0, Math.min(255, level | 0));
  const sv = store ? VARSTORE : NOSTORE;
  if (method === "ext_static" || method === "custom")
    return [razerReport(0x0F, 0x04, 0x03, [sv, led, level], txn)];
  const bled = led || (method === "std_static" ? BACKLIGHT_LED : LOGO_LED);
  return [razerReport(0x03, 0x03, 0x03, [sv, bled, level], txn)];
}

// --- device-state queries (send; transport reads the 90-byte reply) ----------
const qFirmware = (txn) => razerReport(0x00, 0x81, 0x02, [], txn);   // resp arg0.arg1
const qSerial   = (txn) => razerReport(0x00, 0x82, 0x16, [], txn);   // resp arg0..21 ASCII
const qBattery  = (txn) => razerReport(0x07, 0x80, 0x02, [], txn);   // resp arg1 (0-255)
const qCharging = (txn) => razerReport(0x07, 0x84, 0x02, [], txn);   // resp arg1 (0/1)
const qDpi      = (txn) => razerReport(0x04, 0x85, 0x07, [NOSTORE], txn);  // resp arg1..4
const qPoll     = (txn) => razerReport(0x00, 0x85, 0x01, [], txn);   // resp arg0 code

// --- device-state writes -----------------------------------------------------
function setDpiReport(x, y, txn) {
  x = Math.max(100, Math.min(30000, x | 0));
  y = Math.max(100, Math.min(30000, y | 0));
  return [razerReport(0x04, 0x05, 0x07, [VARSTORE, x >> 8, x & 0xFF, y >> 8, y & 0xFF, 0, 0], txn)];
}
function setPollReport(hz, txn) {
  const code = POLL_CODES[hz | 0];
  if (code === undefined) throw new Error("polling rate must be 1000, 500, or 125");
  return [razerReport(0x00, 0x05, 0x01, [code], txn)];
}
