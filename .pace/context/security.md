# Security Context

## Authentication & Authorisation

- **No user authentication is implemented in this repo**.
  - `appscript.js#doPost(e)` accepts any POST request and processes it without checking an API key, bearer token, session, origin, or signature.
  - `background.js` forwards requests to the Apps Script URL from any matching browser context via `fetch(...)`.
- **No authorisation model exists**.
  - Any caller able to reach the deployed Google Apps Script endpoint can decrement inventory for arbitrary `box` values.
  - The Chrome extension itself has no user/role separation; anyone using the installed extension gets the same capabilities.
- **Trust boundary is weak**:
  - `content.js` hardcodes `INVENTORY_URL` and sends updates whenever a box button is clicked.
  - The `source` field is sent from `content.js` to `background.js`, but `appscript.js` ignores it entirely.

## Sensitive Data Handling

- **Potentially sensitive operational data**:
  - Inventory data is stored in a Google Sheet named `"Inventory"` and modified by `appscript.js`.
  - Box selections are stored in browser `localStorage` under key `shipping_dimensions` in `content.js`. This is not highly sensitive by itself, but it is readable by scripts running in the page context if the extension/page boundary is bypassed.
- **Tokens/credentials**:
  - No explicit API keys, passwords, or OAuth tokens are present in the code.
  - The deployed Google Apps Script endpoint URL is hardcoded in `content.js`; while not a secret by itself, it acts as a capability URL if the Apps Script is deployed publicly.
- **Transmission**:
  - Inventory updates are sent over HTTPS to `https://script.google.com/.../exec` from `background.js`.
  - Weight data is fetched from `http://localhost:5000/weight` in `content.js#fetchWeight()`. This is cleartext HTTP on localhost only.
- **Logging**:
  - `weight_server.py#read_weight()` prints raw HID data and computed weights to stdout (`print("📦 Raw data:", data)`, etc.). This may leak device data into local logs.
  - `content.js` logs inventory update success/errors to the browser console.
- **PII**:
  - No direct PII storage is visible in this repo. However, the extension runs on Amazon/eBay/Pirate Ship pages and manipulates shipping forms, so page context may contain customer/shipping data indirectly.

## Attack Surface

### Exposed endpoints
- **Google Apps Script webhook**
  - `appscript.js#doPost(e)` is externally reachable if deployed as a web app.
  - Accepts JSON body with `box`; no auth, no rate limiting, no origin restriction shown.
- **Local Flask endpoint**
  - `weight_server.py` exposes `GET /weight` on port `5000`.
  - `flask_cors.CORS(app)` enables CORS broadly for all origins by default.

### Input handling / validation
- `appscript.js`:
  - `const body = JSON.parse(e.postData.contents);` parses untrusted input without error handling. Malformed JSON will likely throw and return an Apps Script error.
  - `box` is normalized via `normalize()` before comparison, which reduces formatting issues but is not security validation.
- `content.js`:
  - User-supplied dimensions come from `prompt()` and are stored without validation in `localStorage`.
  - On click, dimensions are split and coerced with `Number`; invalid input could produce `NaN` and be inserted into page forms.
- `weight_server.py`:
  - No user input parameters are accepted on `/weight`, so direct injection risk is low.

### Injection risks
- **SQL injection**: none observed; no SQL usage.
- **Command injection**: none observed; no shell execution.
- **DOM/XSS considerations**:
  - `content.js` uses `panel.innerHTML = ...` with static HTML only, so no immediate DOM XSS there.
  - Dynamic button labels use `textContent`, which is safe.
- **CSRF / unauthorized request risk**:
  - High for the Apps Script endpoint because `doPost(e)` has no authentication.
  - The local Flask service also has broad CORS enabled; if bound beyond localhost or exposed via browser-accessible localhost, other local web pages could query it.
- **Local service exposure mismatch**:
  - `manifest.json` grants host permission for `http://127.0.0.1/*`, but `content.js#fetchWeight()` calls `http://localhost:5000/weight`. Depending on Chrome matching and environment, this may be inconsistent operationally.

## Dependency Risk

- **Python**
  - `weight_server.py` depends on:
    - `flask`
    - `flask_cors`
    - `hid` / likely `hidapi`
  - No `requirements.txt`, version pinning, or lockfile is provided, so dependency versions are uncontrolled and vulnerability status cannot be verified from the repo.
  - `hid`/`hidapi` ecosystem packages can be platform-sensitive and may be less actively maintained depending on the exact package used.
- **JavaScript / extension**
  - No npm dependencies are present.
- **Google Apps Script**
  - Uses built-in Apps Script services only.

## Secrets Management

- **Secrets loading**
  - No dedicated secrets management is implemented.
  - The only notable hardcoded value is `INVENTORY_URL` in `content.js`.
- **Leakage risks**
  - Hardcoding the deployed Apps Script URL in `content.js` means it is distributed to every extension user and easily recoverable from the extension source.
  - If the Apps Script deployment is public/anonymous, the URL effectively becomes the only access control.
  - No `.env`, secret store, or environment-variable usage exists in `weight_server.py`; Flask runs with defaults.
  - `weight_server.py` prints exceptions and raw device data to stdout, which could leak local operational details into logs.
- **Version control risk**
  - Since the webhook URL is embedded in source, it is already committed to version control by design.
  - No other credentials are present in the provided files.

## Notable Security Findings

1. **Unauthenticated inventory modification**
   - `appscript.js#doPost(e)` allows arbitrary callers to decrement inventory if they know the box name and endpoint URL.

2. **Overly permissive CORS on local service**
   - `weight_server.py` uses `CORS(app)` with default permissive settings.

3. **No input/error handling on webhook**
   - `JSON.parse(e.postData.contents)` in `appscript.js` lacks try/catch and schema checks.

4. **Hardcoded capability URL**
   - `content.js` embeds the production Apps Script endpoint directly.

5. **No dependency pinning**
   - Python dependencies are unpinned, making patch status and reproducibility unclear.

## Suggested Areas to Test During Pentest

- Abuse of the Apps Script endpoint:
  - unauthenticated POSTs
  - malformed JSON
  - unexpected body shapes
  - replay / bulk inventory depletion
- Whether the Apps Script deployment is public and callable outside the extension.
- Cross-origin access to `http://localhost:5000/weight` from arbitrary websites due to `CORS(app)`.
- Whether the local Flask service binds only to localhost or is reachable on the LAN.
- Extension behavior with malicious dimension input (`prompt()` -> `localStorage` -> form fill).
- Console/log leakage from `weight_server.py` and the extension.