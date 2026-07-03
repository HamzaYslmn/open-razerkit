// WebHID transport. DOM-free: React owns state/UI, this owns device I/O.
// Ported from the transport bits of the old app.js.
import { qPoll, qFirmware, qSerial, qBattery, qCharging, qDpi } from "./protocol.js";

export const VID = 0x1532;
export const HZ = { 1: 1000, 2: 500, 3: 125 };
export const supported = () => !!navigator.hid;

export const listDevices = async () => (navigator.hid ? await navigator.hid.getDevices() : []);
export const requestDevices = () => navigator.hid.requestDevice({ filters: [{ vendorId: VID }] });

export function indexByPid(list) {
  const m = new Map();   // pid -> [HIDDevice, ...]
  for (const d of list) {
    if (d.vendorId !== VID) continue;
    if (!m.has(d.productId)) m.set(d.productId, []);
    m.get(d.productId).push(d);
  }
  return m;
}

// Try each granted collection until one accepts every report; sendOne(dev, rep) does
// the actual write (feature vs output report). `tail` appends collection-specific help.
async function trySend(cands, reports, sendOne, tail = "") {
  if (!cands || !cands.length) throw new Error("no device granted -- click Connect");
  let last = null;
  for (const dev of cands) {
    try {
      if (!dev.opened) await dev.open();
      for (const rep of reports) await sendOne(dev, rep);
      return;
    } catch (e) { last = e; }
  }
  throw new Error(`every granted collection rejected the report (last: ${last && last.message}).${tail}`);
}

// Feature reports (report id 0) — the control protocol for every non-Kraken device.
export const sendReports = (cands, reports) =>
  trySend(cands, reports, (dev, rep) => dev.sendFeatureReport(0, rep),
    ` Chrome may be blocking this device's mouse collection (WebHID protected usage).`);

// Kraken lighting rides HID OUTPUT reports (report id 0x04); WebHID routes by report id.
export const sendOutputReports = (cands, reports) =>
  trySend(cands, reports, (dev, rep) => dev.sendReport(rep.reportId, rep.data));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const READ_TXNS = [0xFF, 0x1F, 0x3F];
const workingTxn = new Map();   // pid -> the txn that answered, so later reads skip the dance

async function queryDevice(cands, pid, dev, makeReport) {
  // Send a GET request, read the 90-byte reply; try the device txn + fallbacks,
  // accept the first reply with success status (byte 0 == 0x02).
  const txns = [...new Set([workingTxn.get(pid), ...(dev ? [dev.txn] : []), ...READ_TXNS].filter((t) => t != null))];
  for (const d of cands || []) {
    try {
      if (!d.opened) await d.open();
      for (const txn of txns) {
        await d.sendFeatureReport(0, makeReport(txn));
        await sleep(20);                     // let the device fill the response
        const dv = await d.receiveFeatureReport(0);
        if (dv.getUint8(0) === 0x02) { workingTxn.set(pid, txn); return dv; }
      }
    } catch (e) { /* collection can't be read -- try next */ }
  }
  return null;
}

export async function readHz(cands, pid, dev) {
  const dv = await queryDevice(cands, pid, dev, qPoll);
  if (!dv || !dv.getUint8(8)) return null;
  const code = dv.getUint8(8);
  return HZ[code] || (code >= 1 && code <= 8 ? Math.floor(1000 / code) : null);
}

// Lightweight DPI-only read (for the 3s live poll; readInfo does the full read).
export async function readDpi(cands, pid, dev) {
  const dv = await queryDevice(cands, pid, dev, qDpi);
  if (!dv) return null;
  return [(dv.getUint8(9) << 8) | dv.getUint8(10), (dv.getUint8(11) << 8) | dv.getUint8(12)];
}


export async function readInfo(cands, pid, dev) {
  // Battery / charging / firmware / DPI / serial -- each null if unavailable.
  const out = { battery: null, charging: null, fw: null, serial: null, dpi: null };
  const batt = await queryDevice(cands, pid, dev, qBattery);
  if (batt) out.battery = Math.round(batt.getUint8(9) * 100 / 255);
  if (out.battery != null) { const c = await queryDevice(cands, pid, dev, qCharging); if (c) out.charging = !!c.getUint8(9); }
  const fw = await queryDevice(cands, pid, dev, qFirmware);
  if (fw) out.fw = `${fw.getUint8(8)}.${fw.getUint8(9)}`;
  const dpi = await queryDevice(cands, pid, dev, qDpi);
  if (dpi) out.dpi = [(dpi.getUint8(9) << 8) | dpi.getUint8(10), (dpi.getUint8(11) << 8) | dpi.getUint8(12)];
  const ser = await queryDevice(cands, pid, dev, qSerial);
  if (ser) { let s = ""; for (let i = 8; i < 30; i++) { const ch = ser.getUint8(i); if (!ch) break; s += String.fromCharCode(ch); } out.serial = s.trim() || null; }
  return out;
}
