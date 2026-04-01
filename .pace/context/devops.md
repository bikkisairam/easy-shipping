# DevOps Context

## Build & Run

### Components
This repo has 3 deployable/runtime pieces:

1. **Chrome extension**
   - `manifest.json`
   - `background.js`
   - `content.js`

2. **Local weight service**
   - `weight_server.py`

3. **Google Apps Script inventory webhook**
   - `appscript.js`

### Local install

#### Chrome extension
No package manager or build step exists in this repo. The extension is loaded unpacked directly from source.

Steps:
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the repository folder containing `manifest.json`

Notes:
- `manifest.json` is MV3.
- The extension injects `content.js` on Amazon/eBay/Pirate Ship pages.
- `background.js` runs as the service worker.

#### Python weight server
There is no `requirements.txt`, so dependencies must be installed manually.

Expected Python deps from `weight_server.py`:
- `flask`
- `flask-cors`
- `hid` / hidapi Python binding

Example install:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install flask flask-cors hid
```

Run locally:
```bash
python weight_server.py
```

This starts Flask on:
```text
http://localhost:5000
```

Health test:
```bash
curl http://localhost:5000/weight
```

Expected response:
```json
{"weight_lb":0,"weight_oz":0}
```
If no DYMO scale is connected, the service logs `✗ DYMO scale not found.` and returns zeroes.

#### Google Apps Script
`appscript.js` must be pasted into a Google Apps Script project bound to a spreadsheet that contains a sheet named:

```text
Inventory
```

Expected sheet layout:
- Column A: box identifier/dimensions
- Column B: remaining quantity
- Data starts on row 2

Deploy as:
- **Web app**
- Execute as appropriate account with spreadsheet access
- Allow POST access from the extension

The deployed web app URL must be set in `content.js`:
```js
const INVENTORY_URL = "https://script.google.com/macros/s/.../exec";
```

### Production build
There is no bundler, transpiler, Dockerfile, or release packaging in this repo.

“Production build” today means:
- For the extension: ship the static source files as-is, zip if needed for store/manual distribution
- For the weight service: run `weight_server.py` in a Python runtime on the operator workstation
- For Apps Script: deploy a new web app version from the Apps Script editor

Recommended release artifact for extension:
```bash
zip -r easy-shipping.zip manifest.json background.js content.js icons/
```

## CI/CD Pipeline

## Current state
No CI/CD config is present in the repository:
- no `.github/workflows/*`
- no Docker build
- no test suite
- no lint config

So currently:
- **No automated checks run on every PR**
- **No automated deployment trigger exists**

## Recommended PR checks
Because this repo is small and static, every PR should at minimum run:

### 1. Extension manifest validation
Validate `manifest.json` is valid JSON:
```bash
python -m json.tool manifest.json > /dev/null
```

### 2. Python syntax check
```bash
python -m py_compile weight_server.py
```

### 3. Basic JS syntax check
If Node is available in CI:
```bash
node --check background.js
node --check content.js
```

### 4. Apps Script syntax sanity
`appscript.js` is plain JS syntax; can also be checked with:
```bash
node --check appscript.js
```

### 5. Optional smoke assertions
Simple grep checks to catch environment drift:
- `content.js` contains `INVENTORY_URL`
- `manifest.json` contains host permissions for:
  - `https://script.google.com/*`
  - local Flask host
- Sheet name in `appscript.js` remains `Inventory`

Example:
```bash
grep -q 'Inventory' appscript.js
grep -q 'https://script.google.com/' manifest.json
grep -q 'localhost:5000/weight' content.js
```

## Recommended deployment triggers
Since there is no automated deployment now, deployments are manual.

### Extension deployment
Trigger:
- Tag or release branch merge

Manual steps:
1. Zip extension sources
2. Upload to Chrome Web Store or distribute unpacked/zip internally
3. Verify new `manifest.json` version

### Apps Script deployment
Trigger:
- Merge to `main` affecting `appscript.js`

Manual steps:
1. Copy updated `appscript.js` into Apps Script project
2. Create new deployment version
3. Update `INVENTORY_URL` in `content.js` only if deployment URL changes

### Weight server deployment
Trigger:
- Merge to `main` affecting `weight_server.py`

Manual steps:
1. Install/update Python deps on workstation
2. Restart the Python process
3. Re-test `GET /weight`

## Infrastructure

### Runtime topology
This service is not centralized cloud infrastructure; it is split across browser + local machine + Google cloud:

1. **User browser**
   - Chrome extension executes on supported e-commerce sites

2. **Local workstation**
   - `weight_server.py` runs on port `5000`
   - Reads from a locally attached DYMO USB scale via HID

3. **Google Apps Script / Google Sheets**
   - `appscript.js` runs as a web app endpoint
   - Uses bound spreadsheet as inventory database

### Containers
None currently.
- No `Dockerfile`
- No container orchestration
- No Kubernetes/ECS/etc.

### Cloud services
- **Google Apps Script** web app endpoint
- **Google Sheets** spreadsheet backend

### Database / storage
1. **Google Sheets**
   - Primary inventory store
   - Sheet name hardcoded as `Inventory`
   - Box lookup in column A, count in column B

2. **Browser localStorage**
   - Key: `shipping_dimensions`
   - Stores user-defined box presets from `content.js`

No SQL/NoSQL database exists.

### Required environment/config values

#### Hardcoded config to watch
- In `content.js`:
  - `INVENTORY_URL` must point to the deployed Apps Script web app
  - Weight fetch URL is hardcoded to:
    ```js
    http://localhost:5000/weight
    ```

#### Browser permissions
`manifest.json` requires:
- permissions:
  - `scripting`
  - `activeTab`
  - `storage`
- host permissions:
  - Amazon/eBay/Pirate Ship domains
  - `https://script.google.com/*`
  - `http://127.0.0.1/*`

Important mismatch:
- `content.js` fetches `http://localhost:5000/weight`
- `manifest.json` only allows `http://127.0.0.1/*`

This may break requests depending on browser enforcement. Add:
```json
"http://localhost/*"
```
or change code to `http://127.0.0.1:5000/weight`.

#### Python host prerequisites
- USB HID access to DYMO scale
- OS-level hidapi support
- Correct Python HID package installed

## Observability

## Current logging
### Extension
- `content.js`
  - success log: `Inventory + Logs updated`
  - warning if scale unreachable: `⚠️ Scale server unreachable – using 0 lb 0 oz`
  - error logs from inventory update callback
- `background.js`
  - no direct logs; errors are returned to sender

### Weight server
`weight_server.py` prints to stdout:
- scale not found
- raw HID data
- parsed weight
- exception messages

### Apps Script
No explicit logging is implemented.
Could add:
```js
console.log(...)
```
or `Logger.log(...)` in `doPost`.

## Metrics
No metrics system exists.
- no Prometheus
- no Cloud Monitoring integration
- no extension telemetry
- no request counters or latency histograms

Recommended minimum metrics to add:
- weight endpoint request count / error count
- Apps Script inventory update success/failure count
- box-not-found count
- scale-not-found count

## Health checks

### Current
- Weight service implicit health check:
  ```bash
  curl http://localhost:5000/weight
  ```
  If Flask responds with JSON, process is up.

- Apps Script health check:
  no dedicated endpoint; only POST workflow through `doPost`

### Recommended
Add to `weight_server.py`:
```python
@app.route('/healthz')
def healthz():
    return jsonify({"ok": True})
```

Add a lightweight Apps Script GET handler:
```javascript
function doGet() {
  return json({ ok: true });
}
```

Then use:
```bash
curl http://localhost:5000/healthz
curl https://script.google.com/macros/s/.../exec
```

## Alerting
No alerting exists.

Recommended operational alert points:
- Local weight server not reachable
- Apps Script returning non-200 / invalid JSON
- Spreadsheet “Box not found” spikes
- Permission failures after Chrome extension update

Because the weight server is local to an operator workstation, practical alerting is likely:
- browser console error visibility
- local process supervisor restart logs
- optional desktop notification on repeated fetch failures

## Deployment Risks

### 1. Host permission mismatch
As noted:
- `content.js` calls `http://localhost:5000/weight`
- `manifest.json` permits only `http://127.0.0.1/*`

This is the biggest immediate runtime risk. Keep code and manifest aligned.

### 2. Google Apps Script URL coupling
`INVENTORY_URL` is hardcoded in `content.js`.
If Apps Script is redeployed and URL changes, inventory updates silently fail until the extension is rebuilt/reloaded.

Recommendation:
- move URL to extension storage/options page, or
- keep stable deployment URL policy

### 3. Spreadsheet schema dependency
`appscript.js` assumes:
- spreadsheet is active/bound correctly
- sheet name is exactly `Inventory`
- box labels are in column A
- counts are in column B
- row 1 is header

Any sheet rename or column change breaks inventory updates.

### 4. No concurrency protection in inventory updates
`doPost(e)` reads all rows, finds a match, and writes decremented value.
Concurrent requests can race and overwrite counts in Google Sheets.

Risk increases if multiple users click the same box simultaneously.

Mitigation:
- use Apps Script `LockService`
- consider moving inventory to a transactional backend if scale grows

### 5. Breaking selector changes on target sites
`content.js` depends on fragile DOM selectors for Amazon/eBay/Pirate Ship.
Any site UI update can break autofill without build/runtime failure.

Operationally, validate after each release against all 3 sites.

### 6. Local hardware dependency
`weight_server.py` depends on:
- DYMO scale being attached
- HID enumeration finding manufacturer string containing `DYMO`
- platform USB permissions

If not available, extension continues with `0 lb 0 oz`, which may hide failures.

### 7. CORS and local network assumptions
`weight_server.py` enables permissive CORS with:
```python
CORS(app)
```
This is fine for local-only use, but if bound more broadly in future, review exposure.

### 8. No pinned dependencies
Without `requirements.txt`, environments may drift and installs may fail on different machines.

Recommended file:
```txt
flask
flask-cors
hid
```

### 9. No process supervision for weight server
If `python weight_server.py` exits, nothing restarts it.

Recommended production/local ops approach:
- `systemd` user service on Linux, or
- launch agent/service wrapper on macOS/Windows

Example `systemd --user` ExecStart:
```ini
ExecStart=/path/to/.venv/bin/python /path/to/repo/weight_server.py
```

---

## Recommended next DevOps actions
1. Fix `localhost` vs `127.0.0.1` mismatch in `manifest.json`/`content.js`
2. Add `requirements.txt`
3. Add `/healthz` in `weight_server.py` and `doGet()` in `appscript.js`
4. Add PR CI for JSON/Python/JS syntax checks
5. Add basic process supervision for the local Flask service
6. Add Apps Script logging and lock protection around inventory updates