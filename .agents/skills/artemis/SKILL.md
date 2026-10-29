---
name: artemis
description: Autonomous Android testing and automation agent using Google ARTEMIS. Drives real Android devices and emulators, inspects screens and UI hierarchies, executes end-to-end mobile user journeys, analyzes logcat, and generates verified test scripts.
license: Apache-2.0
metadata:
  version: v1
  publisher: google
---

# ARTEMIS Mobile Automation & Testing Skill

ARTEMIS transforms natural-language instructions into reliable Android automation. It drives real Android devices or emulators, executes multi-step workflows across applications, captures system diagnostics (logcat, screen recordings, traces), and authors verified automated test code.

Repository: [google/artemis](https://github.com/google/artemis)
Local Installation: `C:\Users\admin\artemis`

---

## Capabilities & MCP Tools

ARTEMIS exposes five native MCP tools:

1. **`mobile_run_task`**: Launch an autonomous mobile task or test plan on a device.
   - `goal`: Natural language description of what to do (e.g., "Open Settings, find Battery and report the percentage").
   - `execution_profile`: `"flash"` (fast reactive 3–5s loop) or `"pro"` (plan-execute-verify-summarize loop).
   - `device_serial`: Optional serial number of the target device.
   - `verification_level`: For Pro mode (`"off"`, `"final"`, `"checkpoints"`, `"strict"`).
2. **`mobile_get_device_state`**: Query the device state, screen resolution, foreground app/activity, and current screen capture.
3. **`mobile_manage_task`**: Check status (`"status"`), list running tasks (`"list"`), or stop a task (`"stop"`).
4. **`mobile_inspect_trace`**: Fetch detailed step-by-step logs, screenshots, and action decisions for a completed or running task trace.
5. **`mobile_diagnose`**: Run an automated health check of ADB, Python runtime, connected devices, and API credentials (`attempt_fix=true` to self-heal).

---

## Workflow Guide

### 1. Pre-Flight Device Check
Before launching mobile automation tasks:
- Verify attached devices with `adb devices -l`.
- If multiple devices are present, ask the user to confirm their target device serial before proceeding.
- Run `mobile_get_device_state` or `mobile_diagnose` to confirm the device is unlocked, authorized, and responsive.

### 2. Choosing the Execution Model

- **ARTEMIS Flash (`execution_profile: "flash"`)**:
  - Best for: Lightweight, direct automation, quick smoke tests, or linear UI interactions.
  - Processing speed: ~3–5 seconds per step.
  - Loop: Reactive Observe-Think-Act without multi-agent planning overhead.
- **ARTEMIS Pro (`execution_profile: "pro"`)**:
  - Best for: Complex multi-step journeys, dynamic multi-branch exploration, continuous monitoring/polling, and tasks requiring ADB/log diagnostics, verified checkpoints, or a formal audit report.
  - Architecture: Plan-Execute-Verify-Summarize closed loop (Planner, Operator with safety net, Checker verifier).

### 3. Writing Resilient Test Scripts (Dynamic-First, Coordinate-Fallback)
When authoring test scripts based on ARTEMIS exploration:
- **Dynamic Elements First**: Always locate elements by resource ID, accessibility text, or OCR when available to tolerate screen size and layout variations.
- **Coordinate Fallback**: Fall back to verified coordinates only when dynamic selectors fail or are unavailable.
- **Deterministic Waits**: Local test frameworks run without LLM latency; replace model step intervals with explicit wait conditions (`waitFor`, timeouts, assertions).

### 4. CLI & Showcase UI Access

From `C:\Users\admin\artemis`:
- **Showcase Web UI & Live Mirroring**: Run `.\start.bat` to launch the local web control center at `http://localhost:8000` with live screen mirroring and task replays.
- **Direct CLI Execution**:
  ```powershell
  uv run artemis run "Open Settings and report battery level" --profile flash
  ```
- **Environment Diagnostics**:
  ```powershell
  uv run artemis doctor
  ```
