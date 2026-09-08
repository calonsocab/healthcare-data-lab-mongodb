const WORKSPACE_PREFIX = "/workspace";

const normalizeView = (value) => String(value || "").trim();

export function workspaceSlugToView(slugParts = []) {
  const parts = Array.isArray(slugParts)
    ? slugParts.map((part) => String(part || "").trim()).filter(Boolean)
    : [];

  if (!parts.length) return "home";
  if (parts[0] === "learn") {
    if (parts.length === 1) return "learn";
    return `learn:${decodeURIComponent(parts.slice(1).join("/"))}`;
  }
  return decodeURIComponent(parts[0]);
}

export function sherpaPathToView(pathname = "/") {
  const path = String(pathname || "/").trim() || "/";
  if (path === "/") return "home";

  const segments = path.split("/").filter(Boolean);
  if (segments[0] !== WORKSPACE_PREFIX.replace("/", "")) {
    return "home";
  }

  return workspaceSlugToView(segments.slice(1));
}

export function viewToSherpaPath(view = "home") {
  const normalizedView = normalizeView(view) || "home";
  if (normalizedView === "home") return "/";

  if (normalizedView.startsWith("learn:")) {
    const moduleId = encodeURIComponent(normalizedView.slice("learn:".length));
    return `${WORKSPACE_PREFIX}/learn/${moduleId}`;
  }

  if (normalizedView === "learn") {
    return `${WORKSPACE_PREFIX}/learn`;
  }

  return `${WORKSPACE_PREFIX}/${encodeURIComponent(normalizedView)}`;
}

export function isSherpaWorkspacePath(pathname = "/") {
  return String(pathname || "").startsWith(`${WORKSPACE_PREFIX}/`);
}
