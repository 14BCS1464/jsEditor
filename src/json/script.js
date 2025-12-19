const input = document.getElementById("input");
const output = document.getElementById("output");
const status = document.getElementById("status");
const urlInput = document.getElementById("urlInput");

document.getElementById("loadBtn").onclick = loadFromURL;
document.getElementById("beautifyBtn").onclick = beautify;
document.getElementById("minifyBtn").onclick = minify;

/* LIVE RENDER */
let timer;
input.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(renderJSON, 300);
});

function renderJSON() {
  try {
    const obj = JSON.parse(input.value);
    output.innerHTML = "";
    buildTree(obj, output);
    status.textContent = "✓ Valid JSON";
    status.className = "status success";
  } catch (e) {
    output.innerHTML = `<span class="json-null">${e.message}</span>`;
    status.textContent = "✗ Invalid JSON";
    status.className = "status error";
  }
}
languageList.addEventListener("click", (e) => {
  const item = e.target.closest("li");
  if (!item) return;

  const langKey = item.dataset.lang; // "javascript", "typescript", etc.
  if (!langKey) return;

  console.log("Selected language:", langKey);
  language = langKey

  // UI: active state
  document
    .querySelectorAll("#languageList li")
    .forEach(li => li.classList.remove("active"));

  item.classList.add("active");

  // // Switch Monaco language
  switchLanguage(langKey);
});

function switchLanguage(lang) {


  switch (lang) {
    case "javascript":
      window.location.href = "/src/editor/index.html";
      break;

    case "typescript":
      window.location.href = "/src/typescript/index.html"; // Leading slash!
      break;

    case "html":
      window.location.href = "/src/html/index.html";
      break;
    case "react":
      window.location.href = "/src/react/index.html";
      break;
    case "json":
      window.location.href = "/src/json/index.html";
      break;


    default:
      console.warn(`No runner defined for ${lang}`);
  }
}
const toggle = document.getElementById("autoExecuteToggle");
const label = document.getElementById("autoExecuteLabel");

function buildTree(value, parent) {
  if (typeof value !== "object" || value === null) {
    parent.innerHTML += formatValue(value);
    return;
  }

  const isArray = Array.isArray(value);
  const keys = Object.keys(value);

  const toggle = document.createElement("div");
  toggle.className = "toggle";
  toggle.textContent = isArray
    ? `Array [${keys.length}]`
    : `Object {${keys.length}}`;

  toggle.onclick = () => toggle.classList.toggle("collapsed");

  const node = document.createElement("div");
  node.className = "node";

  keys.forEach(k => {
    const line = document.createElement("div");
    line.innerHTML = `<span class="json-key">"${k}"</span>: `;
    node.appendChild(line);
    buildTree(value[k], line);
  });

  parent.append(toggle, node);
}

function formatValue(v) {
  if (v === null) return `<span class="json-null">null</span>`;
  if (typeof v === "string") return `<span class="json-string">"${v}"</span>`;
  if (typeof v === "number") return `<span class="json-number">${v}</span>`;
  if (typeof v === "boolean") return `<span class="json-boolean">${v}</span>`;
}

function beautify() {
  input.value = JSON.stringify(JSON.parse(input.value), null, 2);
  renderJSON();
}

function minify() {
  input.value = JSON.stringify(JSON.parse(input.value));
  renderJSON();
}

async function loadFromURL() {
  try {
    status.textContent = "Loading...";
    const res = await fetch(urlInput.value);
    const json = await res.json();
    input.value = JSON.stringify(json, null, 2);
    renderJSON();
  } catch {
    status.textContent = "Failed to load JSON";
    status.className = "status error";
  }
}

/* RESIZER */
const resizer = document.getElementById("resizer");
const left = document.getElementById("leftPanel");
let drag = false;

resizer.onmousedown = () => (drag = true);
document.onmouseup = () => (drag = false);
document.onmousemove = e => {
  if (!drag) return;
  left.style.flex = "none";
  left.style.width = e.clientX + "px";
};

renderJSON();
