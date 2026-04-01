# Product Context

## What This Product Does
Easy Shipping is a Chrome extension for sellers shipping orders on Amazon, eBay, and Pirate Ship. It adds a floating “Box Size” panel directly on those sites so the user can pick a saved package dimension preset, automatically fill the site’s package size and weight fields, pull live weight from a locally running DYMO USB scale server, and decrement box inventory in a Google Sheet via an Apps Script endpoint.

## Core Features
- Floating in-page widget injected on:
  - Amazon
  - eBay
  - Pirate Ship
- Preset box dimension buttons with default sizes such as:
  - 14×4×4
  - 18×4×4
  - 25×4×4
  - 20×6×6
  - 24×6×6
  - 28×4×4
  - 30×4×4
  - 12×9×1
  - 6×8×1
  - 30×6×6
- Local persistence of box presets in `localStorage` under `shipping_dimensions`
- Add custom box dimensions through prompt-driven entry
- Delete mode for removing saved box presets
- Collapse/expand the preset list in the floating panel
- Site-specific autofill of package dimension and weight inputs across multiple shipping UIs:
  - eBay-like selectors using `configuration-key-*` and `input[name$=...]`
  - Amazon-like selectors using `packageLength`, `packageWidth`, `packageHeight`, and aria-label weight fields
  - Pirate Ship-like selectors using `data-test-id` fields and an “add package” popover flow
- Synthetic event dispatching (`focus`, `input`, `keyup`, `change`, `blur`) to trigger host-site form behavior after values are filled
- Enter-key simulation and extra click/blur events to help weight fields commit on some sites
- Live weight retrieval from a local Flask service at `http://localhost:5000/weight`
- Local USB scale integration via HID for DYMO scales
- Inventory decrement on box selection via Chrome background service worker posting to Google Apps Script
- Google Sheets-backed inventory tracking:
  - reads `Inventory` sheet column A for box name
  - decrements column B quantity by 1
  - normalizes box labels by lowercasing, removing spaces, and converting `×` to `x`
  - prevents negative inventory with `Math.max(0, current - 1)`

## User Flows
- **Autofill a shipment using a saved box preset**
  1. User opens a shipping page on Amazon, eBay, or Pirate Ship.
  2. Extension injects the floating “📦 Box Size” panel.
  3. User clicks a box size button like `14×4×4`.
  4. Extension fetches current weight from the local scale server.
  5. Extension fills dimensions and weight into matching fields on the current site.
  6. Extension highlights the selected button as active.
  7. Extension sends the selected box label to the background worker.
  8. Background worker POSTs to the Apps Script inventory endpoint.
  9. Google Sheet inventory for that box is decremented by 1.

- **Add a new custom box preset**
  1. User clicks the `＋` button in the panel.
  2. User is prompted for Length, Width, and Height.
  3. New preset is appended to saved dimensions in browser local storage.
  4. Panel re-renders and shows the new box button.

- **Delete an existing box preset**
  1. User clicks the `🗑️` button.
  2. Extension toggles delete mode and shows an alert indicating delete mode is on.
  3. Preset buttons change styling to indicate deletion behavior.
  4. User clicks a preset.
  5. That preset is removed from local storage and the list re-renders.

- **Collapse the widget**
  1. User clicks the `▲` button.
  2. Extension toggles visibility of the preset button list.
  3. Toolbar remains visible while the box list is hidden/shown.

- **Read live weight from a DYMO scale**
  1. Content script requests `http://localhost:5000/weight`.
  2. Flask server scans HID devices for one with manufacturer containing `DYMO`.
  3. Server reads raw 6-byte data packets from the scale.
  4. If units indicate lb/oz (`data[2] == 11`), server converts raw HID values to pounds and ounces.
  5. Server returns JSON `{ weight_lb, weight_oz }`.
  6. Extension uses those values to populate weight fields.
  7. If the scale server is unreachable or the scale is missing, extension falls back to `0 lb 0 oz`.

- **Update inventory in Google Sheets**
  1. User selects a box preset in the widget.
  2. Extension detects source site (`Amazon`, `eBay`, `PirateShip`, or `Unknown`).
  3. Background script sends `box` and `source` to Apps Script.
  4. Apps Script finds the matching row in the `Inventory` sheet.
  5. Matching uses normalized box text, so `14×4×4` and `14x4x4` are treated equivalently.
  6. Column B quantity is decreased by 1, with a floor of 0.
  7. Endpoint returns either `{ box, remaining }` or `{ error: "Box not found", received: box }`.

## Known Gaps & TODOs
- `content.js` contains a literal comment:
  - `/* 👇 ADD THIS – YOUR DEPLOYED APPS SCRIPT URL */`
  - This indicates the inventory endpoint is manually configured and environment-specific.
- No explicit `TODO`, `FIXME`, or `NotImplementedError` markers were found elsewhere in the provided code.
- A functional gap visible in code: `source` is sent to the Apps Script endpoint but not used in `appscript.js`, so source-specific logging is not implemented despite the console message `Inventory + Logs updated`.
- Another visible mismatch: `manifest.json` grants host permission for `http://127.0.0.1/*`, while `content.js` fetches from `http://localhost:5000/weight`. Depending on Chrome extension behavior, this may require adding `http://localhost/*` explicitly.
