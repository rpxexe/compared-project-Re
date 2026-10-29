// Forwards Metro (8081) and the backend API (5000) from a USB-connected Android phone to
// this PC, so the debug build of the app can reach both via localhost. Without the 8081
// forward the debug build shows "Unable to load script ... Failed to connect to localhost:8081".
// Never fails the npm script: no adb or no device just prints a note.
const { execFileSync } = require("node:child_process");

const PORTS = [8081, 5000];

try {
  const devices = execFileSync("adb", ["devices"], { encoding: "utf8" })
    .split("\n")
    .slice(1)
    .filter((l) => /\tdevice$/.test(l.trim()));
  if (!devices.length) {
    console.log("[adb-reverse] No USB Android device found; skipping (use Expo Go over Wi-Fi instead).");
    process.exit(0);
  }
  for (const port of PORTS) execFileSync("adb", ["reverse", `tcp:${port}`, `tcp:${port}`]);
  console.log(`[adb-reverse] Forwarded ports ${PORTS.join(", ")} to ${devices.length} device(s).`);
} catch (e) {
  console.log(`[adb-reverse] Skipped (${e.code === "ENOENT" ? "adb not on PATH" : e.message.split("\n")[0]}).`);
}
