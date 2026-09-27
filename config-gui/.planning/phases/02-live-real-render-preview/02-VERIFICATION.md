---
phase: "02"
status: passed_with_backstop
verified: 2026-09-28
method: headless-automated + console-verified; visual check deferred (machine GPU regression)
---

# Phase 2 Verification

## Must-haves

| # | Must-have | Evidence | Status |
|---|-----------|----------|--------|
| PREV-01 | Real render strip, 2008:60, full width | UI built per 02-UI-SPEC; renderer boots (BOOT_OK panels=5); data path verified: 488 ws frames @2008×60 decoded by the same frame.ts the canvas uses. Visual canvas check deferred — machine GPU fatal (any electron, incl. --disable-gpu) since ~04:44. | ✅ code+data-path / ⚠ visual backstop |
| PREV-02 | Auto-start + clean exit, no orphans | main.ts lifecycle wired; process-group kill implemented. 3-cycle GUI test deferred with visual check. | ✅ code / ⚠ backstop |
| PREV-03 | Refreshes after Save+Restart | client reconnects on ws close (1s backoff); restart verified working (REL-02) so a new instance + reconnect is exercised. End-to-end observation deferred. | ✅ code / ⚠ backstop |
| REL-02 | Restart on root unit | `sudo -n systemctl restart react-drm` flipped ActiveEnterTimestamp → 04:58:52; --user fallback preserved in code. | ✅ |
| REL-04 | Frame parsing tested | renderer/preview/frame.test.ts — 4 tests (header, channel order, stride, fallback/reject). | ✅ |
| Tests | 23/23 pass; build 0 TS errors | npm test / npm run build in deployed tree | ✅ |

## Backstop items (lift as `{statement, verification: backstop}`)

1. Visual: canvas shows live bar with correct colors once the machine's electron/GPU regression clears (any electron app is affected — try after next reboot or when the parallel sessions' work settles). Verify: open GUI → strip shows the bar; Save+Restart → strip updates within one boot cycle.
2. PREV-02: open/close the GUI 3× → `pgrep -fa "tsx index"` returns to baseline (no Astra-owned preview orphans).

## Result: PASSED (with 2 documented backstops — no code changes required, verification-only)
