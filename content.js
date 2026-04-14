/*****************************************************************
 📦  Multi-site Shipping Autofill – Pirate Ship • eBay • Amazon
 *****************************************************************/
(function initBoxWidget() {
  if (document.querySelector("#box-selector-panel")) return;

  /* 👇 ADD THIS – YOUR DEPLOYED APPS SCRIPT URL */
  const INVENTORY_URL = "https://script.google.com/macros/s/AKfycbw3GbETze-o8Qj7C01omfeLZgeqc7uvE5_EdPiaePM_yQEJETL1A4SJ2NQMDGnnBLq1/exec";

  /*──────── STORAGE ────────*/
  const STORAGE_KEY = "shipping_dimensions";
  const UNIT_STORAGE_KEY = "shipping_unit_preference";

  const DEFAULT_DIMS = [
    "14,4,4",
    "18,4,4",
    "25,4,4",
    "20,6,6",
    "24,6,6",
    "28,4,4",
    "30,4,4",
    "12,9,1",
    "6,8,1",
    "30,6,6"
  ];

  const loadDims = () =>
    JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_DIMS;

  const saveDims = dims =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dims));

  const loadUnitPreference = () =>
    localStorage.getItem(UNIT_STORAGE_KEY) || "lb_oz";

  const saveUnitPreference = unit =>
    localStorage.setItem(UNIT_STORAGE_KEY, unit);

  let deleteMode = false;
  let collapsed = false;
  let currentUnit = loadUnitPreference();

  /*──────── 1. floating widget ────────*/
  const panel = document.createElement("div");
  panel.id = "box-selector-panel";
  panel.innerHTML = `
    <style>
      #box-selector-panel{
        position:fixed;top:50%;right:10px;transform:translateY(-50%);
        background:rgba(255,255,255,.92);padding:12px;border:1px solid #ccc;
        border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.25);
        z-index:99999;font-family:sans-serif;width:150px;
      }
      .toolbar{
        display:flex;justify-content:space-between;align-items:center;
        margin-bottom:6px;
      }
      .toolbar button{
        padding:2px 6px;border:1px solid #888;border-radius:4px;
        background:#eee;cursor:pointer;font-size:12px;
      }
      #box-buttons{
        display:flex;flex-direction:column;gap:6px;
      }
      #box-buttons button{
        padding:6px 10px;border:1px solid #888;border-radius:4px;
        background:#fafafa;cursor:pointer;
      }
      #box-buttons button.active{
        background:#4caf50;color:#fff;font-weight:600;
      }
      #box-buttons button.delete{
        background:#ffebee;border-color:#e53935;color:#c62828;
      }
      .hidden{display:none;}
    </style>

    <div class="toolbar">
      <strong>📦 Box Size</strong>
      <div>
        <button id="add-dim">＋</button>
        <button id="del-dim">🗑️</button>
        <button id="flip">▲</button>
      </div>
    </div>

    <div id="box-buttons"></div>
  `;
  document.body.appendChild(panel);

  function detectSource() {
    const host = window.location.hostname;

    if (host.includes("amazon")) return "Amazon";
    if (host.includes("ebay")) return "eBay";
    if (host.includes("pirateship")) return "PirateShip";

    return "Unknown";
  }

  function updateInventory(boxLabel) {
    chrome.runtime.sendMessage(
      {
        type: "UPDATE_INVENTORY",
        url: INVENTORY_URL,
        box: boxLabel,
        source: detectSource()
      },
      response => {
        if (!response) return;
        if (response.ok) {
          console.log("Inventory + Logs updated");
        } else {
          console.error(response.error);
        }
      }
    );
  }

  /*──────── 2. helpers (UNCHANGED) ───────────────*/
  const fireEvents = el =>
    ["focus", "input", "keyup", "change", "blur"].forEach(evt =>
      el.dispatchEvent(new Event(evt, { bubbles: true }))
    );

  const trySetField = (selectors, value) => {
    for (const sel of selectors) {
      const el =
        document.getElementById(sel.replace(/^#/, "")) || document.querySelector(sel);
      if (el) {
        el.value = value;
        fireEvents(el);
        return el;
      }
    }
    return null;
  };

  const fetchWeight = async () => {
    try {
      const { weight_lb = 0, weight_oz = 0 } =
        await fetch("http://localhost:5000/weight").then(r => r.json());
      return { lb: weight_lb, oz: weight_oz };
    } catch {
      console.warn("⚠️ Scale server unreachable – using 0 lb 0 oz");
      return { lb: 0, oz: 0 };
    }
  };

  const sendEnter = el => {
    if (!el) return;
    ["keydown", "keyup"].forEach(type =>
      el.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true
        })
      )
    );
    el.blur();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };

  /*──────── 3. main fill routine (UNCHANGED) ─────*/
  const fillSiteForms = async ({ L, W, H }) => {
    const { lb, oz } = await fetchWeight();

    trySetField(["#configuration-key-length",'input[name$=".dimensionX"]'],L);
    trySetField(["#configuration-key-width",'input[name$=".dimensionY"]'],W);
    trySetField(["#configuration-key-height",'input[name$=".dimensionZ"]'],H);
    trySetField(["#configuration-key-weight-pounds",'input[name$=".weightPounds"]'],lb);
    trySetField(["#configuration-key-weight-ounces",'input[name$=".weightOunces"]'],oz);

    trySetField(['#packageLength'],L);
    trySetField(['#packageWidth'],W);
    trySetField(['#packageHeight'],H);
    trySetField(['input[aria-label="Package weight in pounds"]'],lb);
    sendEnter(trySetField(['input[aria-label="Package weight in ounces"]'],oz));

    document.querySelector('[data-test-id="add-package-text-popover"]')?.click();
    setTimeout(() => {
      trySetField(['input[data-test-id="add-package-preload-input-0"]'],L);
      trySetField(['input[data-test-id="add-package-preload-input-1"]'],W);
      trySetField(['input[data-test-id="add-package-preload-input-2"]'],H);
      trySetField(['input[data-test-id="shipping-weight-input-LB"]'],lb);
      trySetField(['input[data-test-id="shipping-weight-input-OZ"]'],oz);
      document.querySelector('[data-test-id="add-package-preload-apply"]')?.click();
    }, 400);
  };

  /*──────── 4. render buttons ─────────*/
  const renderButtons = () => {
    const container = document.getElementById("box-buttons");
    container.innerHTML = "";

    loadDims().forEach(d => {
      const btn = document.createElement("button");
      btn.dataset.dims = d;
      btn.textContent = d.replace(/,/g,"×");

      if (deleteMode) btn.classList.add("delete");

      btn.onclick = () => {
        if (deleteMode) {
          saveDims(loadDims().filter(x => x !== d));
          renderButtons();
        } else {
          container.querySelectorAll("button").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          const [L,W,H] = d.split(",").map(Number);
          fillSiteForms({L,W,H});

          updateInventory(btn.textContent);
        }
      };
      container.appendChild(btn);
    });
  };

  document.getElementById("add-dim").onclick = () => {
    const L = prompt("Length?");
    const W = prompt("Width?");
    const H = prompt("Height?");
    if (!L || !W || !H) return;

    const dims = loadDims();
    dims.push(`${L},${W},${H}`);
    saveDims(dims);
    renderButtons();
  };

  document.getElementById("del-dim").onclick = () => {
    deleteMode = !deleteMode;
    alert(deleteMode ? "Delete mode ON (click box to remove)" : "Delete mode OFF");
    renderButtons();
  };

  document.getElementById("flip").onclick = () => {
    collapsed = !collapsed;
    document.getElementById("box-buttons")
      .classList.toggle("hidden", collapsed);
  };

  renderButtons();
})();
