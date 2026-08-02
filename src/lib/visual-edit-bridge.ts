import type { Sandbox } from "@daytona/sdk";

const BRIDGE_ASSET = "public/__cognix_visual_edit.js";
const LAYOUT_CANDIDATES = [
  "app/layout.tsx",
  "app/layout.jsx",
  "app/layout.js",
  "src/app/layout.tsx",
  "src/app/layout.jsx",
  "src/app/layout.js",
] as const;

const MARKER_START = "{/* cognix:visual-edit:start */}";
const MARKER_END = "{/* cognix:visual-edit:end */}";

const CLIENT_BRIDGE_SOURCE = String.raw`(function () {
  "use strict";

  var SOURCE = "cognix-visual-edit";
  var VERSION = 1;
  var PARENT_ORIGIN = __COGNIX_PARENT_ORIGIN__;
  var existing = window.__COGNIX_VISUAL_EDIT_BRIDGE__;
  if (existing && typeof existing.destroy === "function") existing.destroy();
  if (window.parent === window) return;

  var state = {
    channelId: "",
    enabled: false,
    selections: [],
    hoverTarget: null,
    route: window.location.pathname,
    frame: 0,
    cursor: document.documentElement.style.cursor || ""
  };
  var selectedOverlays = [];

  function assignStyles(element, styles) {
    Object.keys(styles).forEach(function (key) { element.style[key] = styles[key]; });
  }

  function createOverlay(color, dashed) {
    var overlay = document.createElement("div");
    overlay.setAttribute("data-cognix-visual-overlay", "true");
    overlay.setAttribute("aria-hidden", "true");
    assignStyles(overlay, {
      position: "fixed",
      zIndex: "2147483646",
      pointerEvents: "none",
      boxSizing: "border-box",
      border: "2px " + (dashed ? "dashed " : "solid ") + color,
      borderRadius: "4px",
      background: dashed ? "rgba(113, 91, 255, 0.07)" : "rgba(113, 91, 255, 0.11)",
      boxShadow: "0 0 0 1px rgba(255,255,255,.72), 0 8px 24px rgba(29,17,94,.2)",
      display: "none"
    });
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  var hoverOverlay = createOverlay("#725fff", true);
  var hoverLabel = document.createElement("div");
  hoverLabel.setAttribute("data-cognix-visual-overlay", "true");
  assignStyles(hoverLabel, {
    position: "fixed",
    zIndex: "2147483647",
    pointerEvents: "none",
    maxWidth: "320px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderRadius: "5px",
    background: "#624de8",
    padding: "4px 7px",
    color: "white",
    font: "600 11px/1.2 ui-sans-serif, system-ui, sans-serif",
    boxShadow: "0 5px 18px rgba(0,0,0,.25)",
    display: "none"
  });
  document.documentElement.appendChild(hoverLabel);

  function bounded(value, limit) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, limit);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (character) {
      return "\\" + character.charCodeAt(0).toString(16) + " ";
    });
  }

  function uniqueSelector(selector) {
    try { return document.querySelectorAll(selector).length === 1; } catch (_) { return false; }
  }

  function selectorFor(element) {
    if (!(element instanceof Element)) return "";
    if (element.id) {
      var idSelector = "#" + cssEscape(element.id);
      if (uniqueSelector(idSelector)) return idSelector;
    }
    var testId = element.getAttribute("data-testid");
    if (testId) {
      var testSelector = '[data-testid="' + cssEscape(testId) + '"]';
      if (uniqueSelector(testSelector)) return testSelector;
    }
    var parts = [];
    var current = element;
    while (current && current.nodeType === 1 && parts.length < 10) {
      var tag = current.tagName.toLowerCase();
      if (current === document.body || current === document.documentElement) {
        parts.unshift(tag);
        break;
      }
      if (current.id) {
        parts.unshift("#" + cssEscape(current.id));
        break;
      }
      var siblings = current.parentElement
        ? Array.prototype.filter.call(current.parentElement.children, function (child) { return child.tagName === current.tagName; })
        : [];
      if (siblings.length > 1) tag += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
      parts.unshift(tag);
      current = current.parentElement;
    }
    return parts.join(" > ").slice(0, 2000);
  }

  function safePath(fileName) {
    var clean = bounded(fileName, 1000).replace(/\\/g, "/").split("?")[0];
    var projectMarker = clean.lastIndexOf("/app/");
    var srcMarker = clean.lastIndexOf("/src/");
    var marker = Math.max(projectMarker, srcMarker);
    if (marker >= 0) return clean.slice(marker + 1).slice(0, 400);
    var parts = clean.split("/").filter(Boolean);
    return parts.slice(-4).join("/").slice(0, 400);
  }

  function sourceFor(fiber) {
    var debugSource = fiber && fiber._debugSource;
    if (debugSource && debugSource.fileName) {
      return {
        file: safePath(debugSource.fileName),
        line: Number(debugSource.lineNumber) || undefined,
        column: Number(debugSource.columnNumber) || undefined
      };
    }
    var rawStack = fiber && fiber._debugStack;
    var stack = rawStack && (rawStack.stack || String(rawStack));
    if (!stack) return undefined;
    var match = String(stack).match(/(?:\(|at\s+)([^()\s]+\.(?:tsx|jsx|ts|js)):(\d+):(\d+)/i);
    if (!match) return undefined;
    return { file: safePath(match[1]), line: Number(match[2]), column: Number(match[3]) };
  }

  function componentName(type) {
    if (!type) return "";
    if (typeof type === "function") return type.displayName || type.name || "";
    if (typeof type === "object") {
      return type.displayName || type.name || (type.render && (type.render.displayName || type.render.name)) || "";
    }
    return "";
  }

  function componentStackFor(element) {
    var key = Object.keys(element).find(function (name) {
      return name.indexOf("__reactFiber$") === 0 || name.indexOf("__reactInternalInstance$") === 0;
    });
    var fiber = key ? element[key] : null;
    var stack = [];
    var seen = {};
    var depth = 0;
    while (fiber && depth < 24 && stack.length < 8) {
      var name = componentName(fiber.type || fiber.elementType);
      if (name && !seen[name] && name !== "Fragment") {
        seen[name] = true;
        var item = { name: bounded(name, 160) };
        var source = sourceFor(fiber);
        if (source && source.file) item.source = source;
        stack.push(item);
      }
      fiber = fiber.return || fiber._debugOwner;
      depth += 1;
    }
    return stack;
  }

  function safeUrl(value) {
    if (!value || /^(?:data|blob|javascript):/i.test(value)) return "";
    try {
      var url = new URL(value, window.location.href);
      return bounded((url.origin === window.location.origin ? "" : url.origin) + url.pathname, 600);
    } catch (_) {
      return bounded(String(value).split(/[?#]/)[0], 600);
    }
  }

  function attributesFor(element) {
    var attributes = {};
    ["id", "class", "role", "aria-label", "aria-labelledby", "title", "alt", "placeholder", "name", "type", "data-testid"].forEach(function (name) {
      var value = element.getAttribute(name);
      if (value) attributes[name] = bounded(value, 600);
    });
    ["href", "src"].forEach(function (name) {
      var value = safeUrl(element.getAttribute(name));
      if (value) attributes[name] = value;
    });
    return attributes;
  }

  function rounded(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function detailsFor(element) {
    var selector = selectorFor(element);
    var rect = element.getBoundingClientRect();
    var computed = window.getComputedStyle(element);
    var attributes = attributesFor(element);
    var componentStack = componentStackFor(element);
    var text = bounded(element.innerText || element.textContent || "", 300);
    var accessibleName = bounded(attributes["aria-label"] || attributes.alt || attributes.title || text, 300);
    var route = window.location.pathname || "/";
    return {
      id: (route + "::" + selector).slice(0, 2600),
      route: route.slice(0, 400),
      selector: selector,
      tagName: element.tagName.toLowerCase(),
      role: attributes.role || undefined,
      accessibleName: accessibleName || undefined,
      text: text || undefined,
      attributes: attributes,
      rect: { x: rounded(rect.x), y: rounded(rect.y), width: rounded(rect.width), height: rounded(rect.height) },
      viewport: { width: Math.max(1, Math.round(window.innerWidth)), height: Math.max(1, Math.round(window.innerHeight)) },
      styles: {
        display: bounded(computed.display, 600),
        position: bounded(computed.position, 600),
        color: bounded(computed.color, 600),
        backgroundColor: bounded(computed.backgroundColor, 600),
        fontSize: bounded(computed.fontSize, 600),
        fontWeight: bounded(computed.fontWeight, 600),
        borderRadius: bounded(computed.borderRadius, 600)
      },
      componentStack: componentStack.length ? componentStack : undefined
    };
  }

  function labelFor(element) {
    var stack = componentStackFor(element);
    var name = stack.length ? stack[0].name : element.tagName.toLowerCase();
    var text = bounded(element.getAttribute("aria-label") || element.innerText || "", 45);
    return text && text !== name ? name + " · " + text : name;
  }

  function positionOverlay(overlay, rect) {
    assignStyles(overlay, {
      display: rect.width > 0 && rect.height > 0 ? "block" : "none",
      left: Math.round(rect.left) + "px",
      top: Math.round(rect.top) + "px",
      width: Math.round(rect.width) + "px",
      height: Math.round(rect.height) + "px"
    });
  }

  function showHover(element) {
    state.hoverTarget = element;
    var rect = element.getBoundingClientRect();
    positionOverlay(hoverOverlay, rect);
    hoverLabel.textContent = labelFor(element);
    assignStyles(hoverLabel, {
      display: "block",
      left: Math.max(6, Math.round(rect.left)) + "px",
      top: Math.max(6, Math.round(rect.top) - 27) + "px"
    });
  }

  function clearHover() {
    state.hoverTarget = null;
    hoverOverlay.style.display = "none";
    hoverLabel.style.display = "none";
  }

  function clearSelectedOverlays() {
    selectedOverlays.forEach(function (overlay) { overlay.remove(); });
    selectedOverlays = [];
  }

  function renderSelections() {
    clearSelectedOverlays();
    if (!state.enabled) return;
    state.selections.slice(0, 5).forEach(function (selection) {
      var element = null;
      try { element = document.querySelector(selection.selector); } catch (_) { element = null; }
      if (!element) return;
      var overlay = createOverlay("#5b43ee", false);
      positionOverlay(overlay, element.getBoundingClientRect());
      selectedOverlays.push(overlay);
    });
  }

  function send(type, payload) {
    var message = Object.assign({
      source: SOURCE,
      version: VERSION,
      channelId: state.channelId || null,
      type: type
    }, payload || {});
    window.parent.postMessage(message, PARENT_ORIGIN);
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    document.documentElement.style.cursor = state.enabled ? "crosshair" : state.cursor;
    if (!state.enabled) clearHover();
    renderSelections();
  }

  function elementAtEvent(event) {
    var target = event.target;
    if (!(target instanceof Element)) return null;
    if (target.closest("[data-cognix-visual-overlay]")) return null;
    return target;
  }

  function onPointerMove(event) {
    if (!state.enabled) return;
    var target = elementAtEvent(event);
    if (!target || target === state.hoverTarget) return;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(function () { showHover(target); });
  }

  function selectElement(element, append) {
    var selection = detailsFor(element);
    if (!selection.selector) return;
    send("element_selected", { selection: selection, append: Boolean(append) });
  }

  function onClick(event) {
    if (!state.enabled) return;
    var target = elementAtEvent(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    selectElement(target, event.metaKey || event.ctrlKey);
  }

  function onKeyDown(event) {
    if (!state.enabled) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setEnabled(false);
      send("closed");
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && document.activeElement instanceof Element && document.activeElement !== document.body) {
      event.preventDefault();
      event.stopPropagation();
      selectElement(document.activeElement, event.metaKey || event.ctrlKey);
    }
  }

  function onMessage(event) {
    if (event.source !== window.parent || event.origin !== PARENT_ORIGIN) return;
    var data = event.data;
    if (!data || data.source !== SOURCE || data.version !== VERSION || typeof data.channelId !== "string") return;
    if (data.type === "configure") {
      state.channelId = data.channelId.slice(0, 200);
      state.selections = Array.isArray(data.selections) ? data.selections.slice(0, 5) : [];
      setEnabled(data.enabled);
      return;
    }
    if (!state.channelId || data.channelId !== state.channelId) return;
    if (data.type === "set_enabled") setEnabled(data.enabled);
    if (data.type === "set_selections") {
      state.selections = Array.isArray(data.selections) ? data.selections.slice(0, 5) : [];
      renderSelections();
    }
  }

  function onViewportChange() {
    if (state.enabled && state.hoverTarget && document.contains(state.hoverTarget)) showHover(state.hoverTarget);
    renderSelections();
  }

  function checkRoute() {
    if (state.route === window.location.pathname) return;
    state.route = window.location.pathname;
    state.selections = [];
    clearHover();
    renderSelections();
    send("route_changed", { route: state.route.slice(0, 400) });
  }

  window.addEventListener("message", onMessage);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", onViewportChange, true);
  window.addEventListener("resize", onViewportChange);
  var routeTimer = window.setInterval(checkRoute, 500);

  window.__COGNIX_VISUAL_EDIT_BRIDGE__ = {
    destroy: function () {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      window.clearInterval(routeTimer);
      if (state.frame) cancelAnimationFrame(state.frame);
      document.documentElement.style.cursor = state.cursor;
      clearHover();
      clearSelectedOverlays();
      hoverOverlay.remove();
      hoverLabel.remove();
    }
  };

  send("ready", { route: state.route.slice(0, 400) });
})();
`;

function parentOrigin() {
  try {
    return new URL(process.env.APP_BASE_URL || "http://localhost:3000").origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function createVisualEditBridgeSource(origin = parentOrigin()) {
  return CLIENT_BRIDGE_SOURCE.replace("__COGNIX_PARENT_ORIGIN__", JSON.stringify(origin));
}

export function injectVisualEditScriptTag(layoutSource: string) {
  const block = `${MARKER_START}\n        <script data-cognix-visual-edit src="/__cognix_visual_edit.js" defer />\n        ${MARKER_END}`;
  const managedBlock = /\{\/\* cognix:visual-edit:start \*\/\}[\s\S]*?\{\/\* cognix:visual-edit:end \*\/\}/;
  const existingManagedBlock = layoutSource.match(managedBlock)?.[0];
  if (existingManagedBlock?.includes('src="/__cognix_visual_edit.js"')) return layoutSource;
  if (existingManagedBlock) return layoutSource.replace(managedBlock, block);

  const closingBodyIndex = layoutSource.search(/<\/body\s*>/i);
  if (closingBodyIndex < 0) return null;
  const lineStart = layoutSource.lastIndexOf("\n", closingBodyIndex - 1) + 1;
  const beforeClosingTag = layoutSource.slice(lineStart, closingBodyIndex);
  const indent = /^\s*$/.test(beforeClosingTag) ? beforeClosingTag : "        ";
  const prefix = closingBodyIndex > 0 && layoutSource[closingBodyIndex - 1] === "\n" ? "" : "\n";
  const insertion = `${prefix}${indent}${block.replaceAll("\n", `\n${indent}`)}\n${indent}`;
  return `${layoutSource.slice(0, closingBodyIndex)}${insertion}${layoutSource.slice(closingBodyIndex)}`;
}

async function readOptionalFile(sandbox: Sandbox, remotePath: string) {
  try {
    return (await sandbox.fs.downloadFile(remotePath)).toString("utf8");
  } catch {
    return null;
  }
}

export async function ensureVisualEditBridge(
  sandbox: Sandbox,
  projectRoot: string,
  projectFsRoot = "app",
) {
  let layoutPath: string | null = null;
  let layoutSource: string | null = null;
  for (const candidate of LAYOUT_CANDIDATES) {
    const source = await readOptionalFile(sandbox, `${projectFsRoot}/${candidate}`);
    if (source !== null) {
      layoutPath = candidate;
      layoutSource = source;
      break;
    }
  }

  if (!layoutPath || layoutSource === null) {
    return { installed: false, changed: false, layoutPath: null };
  }

  const patchedLayout = injectVisualEditScriptTag(layoutSource);
  if (patchedLayout === null) {
    return { installed: false, changed: false, layoutPath };
  }

  const bridgeSource = createVisualEditBridgeSource();
  const currentBridge = await readOptionalFile(sandbox, `${projectFsRoot}/${BRIDGE_ASSET}`);
  const layoutChanged = patchedLayout !== layoutSource;
  const bridgeChanged = currentBridge !== bridgeSource;

  if (bridgeChanged) {
    await sandbox.process.executeCommand("mkdir -p public", projectRoot, undefined, 30);
    await sandbox.fs.uploadFile(Buffer.from(bridgeSource), `${projectFsRoot}/${BRIDGE_ASSET}`);
  }
  if (layoutChanged) {
    await sandbox.fs.uploadFile(Buffer.from(patchedLayout), `${projectFsRoot}/${layoutPath}`);
  }

  return { installed: true, changed: bridgeChanged || layoutChanged, layoutPath };
}
