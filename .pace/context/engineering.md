# Engineering Context

## Tech Stack
- **JavaScript**
  - **Chrome Extension (Manifest V3)** in:
    - `content.js`
    - `background.js`
    - `manifest.json`
  - Browser APIs:
    - `chrome.runtime.onMessage`
    - `chrome.runtime.sendMessage`
    - DOM APIs
    - `fetch`
    - `localStorage`
- **Python**
  - `weight_server.py`
  - Libraries:
    - `flask` (`Flask`, `jsonify`)
    - `flask_cors` (`CORS`)
    - `hid` for USB HID device access
    - stdlib: `struct`, `math`
- **Google Apps Script**
  - `appscript.js`
  - Uses:
    - `SpreadsheetApp`
    - `ContentService`

## Architecture
This repo is a small multi-process system with 3 independently deployed/runtime pieces:

1. **Chrome extension UI + page automation**
   - `content.js`
   - Injects a floating “Box Size” widget into supported sites.
   - Owns:
     - box preset persistence (`STORAGE_KEY = "shipping_dimensions"`)
     - site detection via `detectSource()`
     - DOM field autofill via `trySetField()`, `fireEvents()`, `sendEnter()`
     - weight retrieval from local server via `fetchWeight()`
     - inventory update trigger via `updateInventory()`
   - Main orchestration happens inside the IIFE `initBoxWidget()`.

2. **Chrome extension background service worker**
   - `background.js`
   - Owns cross-origin POSTing to the Google Apps Script endpoint.
   - Handles only one message type: `"UPDATE_INVENTORY"`.
   - Receives `{ url, box, source }`, POSTs JSON, and replies asynchronously with `{ ok, data }` or `{ ok, error }`.

3. **Local weight service**
   - `weight_server.py`
   - Flask app exposing `GET /weight` on port `5000`.
   - Owns:
     - DYMO device discovery in `find_dymo_scale()`
     - HID parsing in `read_weight()`
     - HTTP response in `get_weight()`
   - `content.js` calls this directly from the page context using `fetch("http://localhost:5000/weight")`.

4. **Inventory backend**
   - `appscript.js`
   - Google Apps Script web app that decrements inventory in the `Inventory` sheet.
   - Owns:
     - POST handling in `doPost(e)`
     - box name normalization in `normalize(v)`
     - JSON output formatting in `json(o)`
   - Reads `A:B` from sheet `"Inventory"`, matches requested box against column A, decrements column B.

### Data flow
- User clicks a box button in `content.js`.
- `fillSiteForms({L,W,H})` fills dimensions and weight into Amazon/eBay/Pirate Ship fields.
- `fetchWeight()` gets live weight from `weight_server.py`.
- `updateInventory(btn.textContent)` sends a runtime message to `background.js`.
- `background.js` POSTs to the Apps Script `INVENTORY_URL`.
- `appscript.js` decrements inventory and returns remaining quantity.

## Coding Conventions
### Naming
- Functions use **camelCase**:
  - `initBoxWidget`
  - `detectSource`
  - `updateInventory`
  - `find_dymo_scale`
  - `read_weight`
- Constants are uppercase when intended as config:
  - `INVENTORY_URL`
  - `STORAGE_KEY`
  - `DEFAULT_DIMS`

### Project layout
- Flat repo; each top-level file maps to a runtime boundary:
  - `manifest.json` = extension config
  - `content.js` = injected page logic
  - `background.js` = extension service worker
  - `weight_server.py` = local HTTP server
  - `appscript.js` = deployed Apps Script backend
- There are no shared utility modules; helpers are defined inline in the file that uses them.

### Error handling
- Mostly **fail-soft** and return defaults:
  - `fetchWeight()` catches all errors and returns `{ lb: 0, oz: 0 }`
  - `read_weight()` returns `(0, 0)` on missing scale or exceptions
  - `background.js` wraps fetch failures into `{ ok: false, error: err.message }`
  - `appscript.js` returns JSON error payloads like `{ error: "Box not found", received: box }`
- There is no centralized error abstraction or custom error classes.

### Logging
- Logging is lightweight and ad hoc:
  - `content.js`: `console.log`, `console.warn`, `console.error`
  - `weight_server.py`: `print(...)`
- Example log points:
  - successful inventory update: `"Inventory + Logs updated"`
  - scale unavailable: `"⚠️ Scale server unreachable – using 0 lb 0 oz"`
  - raw HID data and parsed weights in `read_weight()`

### Style patterns
- `content.js` is written as a self-invoking function to avoid polluting page globals.
- DOM creation is imperative and inline; CSS is embedded inside `panel.innerHTML`.
- Site support is selector-driven inside `fillSiteForms()`, not abstracted into separate per-site modules.
- `background.js` uses promise chains instead of `async/await`.
- `appscript.js` loops over spreadsheet rows manually instead of indexing/caching.

## Testing Approach
There is currently **no test suite** in the repo:
- No unit test framework
- No integration test framework
- No e2e/browser automation setup
- No `package.json`, `pytest`, or CI config present

### Current validation is manual
- **Extension**
  - Load unpacked extension using `manifest.json`
  - Open Amazon/eBay/Pirate Ship pages
  - Verify widget injection, autofill, and inventory POST behavior
- **Weight service**
  - Run `python weight_server.py`
  - Hit `http://localhost:5000/weight`
  - Confirm returned JSON and DYMO readings
- **Apps Script**
  - Deploy `appscript.js` as a Web App
  - POST JSON like `{"box":"14×4×4"}` and verify spreadsheet decrement in sheet `Inventory`

### How to run
- Extension:
  - Chrome → Extensions → Developer Mode → Load unpacked → repo folder
- Weight server:
  - `python weight_server.py`
- Apps Script:
  - Copy `appscript.js` into a Google Apps Script project bound to the spreadsheet and deploy as Web App
- There is no single command to run all components together.

## Entry Points
### Primary execution entry points
- **Chrome extension manifest**
  - `manifest.json`
  - Defines:
    - background service worker: `background.js`
    - content script injection: `content.js`
- **Content script bootstrap**
  - `content.js` starts at `(function initBoxWidget() { ... })();`
- **Python server bootstrap**
  - `weight_server.py` starts at:
    - `if __name__ == "__main__": app.run(port=5000)`
- **Apps Script HTTP entry**
  - `appscript.js` starts at `doPost(e)`

### Files a developer will touch most often
- `content.js`
  - Most daily changes will likely happen here:
    - adding/changing selectors in `fillSiteForms()`
    - changing widget behavior in `renderButtons()`
    - updating source detection in `detectSource()`
    - changing local storage format/constants
- `manifest.json`
  - Touched when adding permissions, hosts, or changing extension wiring.
- `background.js`
  - Touched when inventory API behavior changes.
- `weight_server.py`
  - Touched when scale parsing or local API behavior changes.
- `appscript.js`
  - Touched when spreadsheet schema or inventory rules change.

### Key functions/classes to know
There are no classes in this codebase. Key functions are:
- `content.js`
  - `initBoxWidget`
  - `detectSource`
  - `updateInventory`
  - `fetchWeight`
  - `fillSiteForms`
  - `renderButtons`
  - `trySetField`
  - `sendEnter`
- `background.js`
  - anonymous `chrome.runtime.onMessage.addListener(...)` handler for `"UPDATE_INVENTORY"`
- `weight_server.py`
  - `find_dymo_scale`
  - `read_weight`
  - `get_weight`
- `appscript.js`
  - `doPost`
  - `normalize`
  - `json`

## Repo-specific notes
- `content.js` hardcodes the deployed Apps Script endpoint in `INVENTORY_URL`.
- `manifest.json` allows `http://127.0.0.1/*`, but `content.js` fetches `http://localhost:5000/weight`; if host permissions matter for future refactors, keep those aligned.
- Inventory matching is normalized across `"×"` vs `"x"`, spaces, and case in `appscript.js::normalize(v)`.
- The `source` field is sent from `content.js` to `background.js`, but `appscript.js` currently ignores it.