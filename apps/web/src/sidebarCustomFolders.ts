import { msg } from "gt-react";

import { m } from "./i18n/messages";

export interface SidebarCustomFolder {
  readonly id: string;
  readonly name: string;
  readonly collapsed: boolean;
  readonly threadKeys: readonly string[];
}

const CUSTOM_FOLDER_ID = /^cf_[A-Za-z0-9-]+$/;

export function sanitizeCustomFolders(value: unknown): readonly SidebarCustomFolder[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  const seenThreads = new Set<string>();
  const folders: SidebarCustomFolder[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (!CUSTOM_FOLDER_ID.test(id) || seenIds.has(id) || name.length === 0) continue;
    seenIds.add(id);
    const threadKeys: string[] = [];
    if (Array.isArray(raw.threadKeys)) {
      for (const key of raw.threadKeys) {
        if (typeof key !== "string" || key.length === 0 || seenThreads.has(key)) continue;
        seenThreads.add(key);
        threadKeys.push(key);
      }
    }
    folders.push({
      id,
      name,
      collapsed: raw.collapsed === true,
      threadKeys,
    });
  }
  return folders;
}

export function nextCustomFolderName(folders: readonly SidebarCustomFolder[]): string {
  const names = new Set(folders.map((folder) => folder.name));
  const base = m(msg("New folder"));
  if (!names.has(base)) return base;
  let index = 2;
  let candidate = m(msg("New folder {index}", { index }));
  while (names.has(candidate)) {
    index += 1;
    candidate = m(msg("New folder {index}", { index }));
  }
  return candidate;
}

function withoutThread(
  folders: readonly SidebarCustomFolder[],
  threadKey: string,
): readonly SidebarCustomFolder[] {
  if (!folders.some((folder) => folder.threadKeys.includes(threadKey))) return folders;
  return folders.map((folder) =>
    folder.threadKeys.includes(threadKey)
      ? { ...folder, threadKeys: folder.threadKeys.filter((key) => key !== threadKey) }
      : folder,
  );
}

export function createCustomFolder(
  folders: readonly SidebarCustomFolder[],
  threadKey: string,
  id: string,
): readonly SidebarCustomFolder[] {
  if (threadKey.length === 0 || !CUSTOM_FOLDER_ID.test(id)) return folders;
  return [
    {
      id,
      name: nextCustomFolderName(folders),
      collapsed: false,
      threadKeys: [threadKey],
    },
    ...withoutThread(folders, threadKey),
  ];
}

export function renameCustomFolder(
  folders: readonly SidebarCustomFolder[],
  id: string,
  name: string,
): readonly SidebarCustomFolder[] {
  const trimmed = name.trim();
  if (trimmed.length === 0) return folders;
  const index = folders.findIndex((folder) => folder.id === id);
  const current = folders[index];
  if (current === undefined || current.name === trimmed) return folders;
  const next = folders.slice();
  next[index] = { ...current, name: trimmed };
  return next;
}

export function deleteCustomFolder(
  folders: readonly SidebarCustomFolder[],
  id: string,
): readonly SidebarCustomFolder[] {
  if (!folders.some((folder) => folder.id === id)) return folders;
  return folders.filter((folder) => folder.id !== id);
}

export function setCustomFolderCollapsed(
  folders: readonly SidebarCustomFolder[],
  id: string,
  collapsed: boolean,
): readonly SidebarCustomFolder[] {
  const index = folders.findIndex((folder) => folder.id === id);
  const current = folders[index];
  if (current === undefined || current.collapsed === collapsed) return folders;
  const next = folders.slice();
  next[index] = { ...current, collapsed };
  return next;
}

export function moveThreadToCustomFolder(
  folders: readonly SidebarCustomFolder[],
  threadKey: string,
  folderId: string,
): readonly SidebarCustomFolder[] {
  const target = folders.find((folder) => folder.id === folderId);
  if (target === undefined || threadKey.length === 0) return folders;
  const alreadyFiledHere = folders.every(
    (folder) => folder.id === folderId || !folder.threadKeys.includes(threadKey),
  );
  if (alreadyFiledHere && target.threadKeys.includes(threadKey)) return folders;
  return withoutThread(folders, threadKey).map((folder) =>
    folder.id === folderId
      ? { ...folder, collapsed: false, threadKeys: [...folder.threadKeys, threadKey] }
      : folder,
  );
}

const CUSTOM_FOLDER_ROW_PREFIX = "custom-folder:";

export function customFolderRowId(folderId: string) {
  return `${CUSTOM_FOLDER_ROW_PREFIX}${folderId}`;
}

export interface CustomFolderThreadPlacement {
  readonly folderId: string;
  readonly beforeKey: string | null;
}

export function resolveCustomFolderThreadDrop(
  folders: readonly SidebarCustomFolder[],
  overId: string,
): CustomFolderThreadPlacement | null {
  if (overId.startsWith(CUSTOM_FOLDER_ROW_PREFIX)) {
    const folderId = overId.slice(CUSTOM_FOLDER_ROW_PREFIX.length);
    return folders.some((folder) => folder.id === folderId) ? { folderId, beforeKey: null } : null;
  }
  const folder = folders.find((candidate) => candidate.threadKeys.includes(overId));
  return folder === undefined ? null : { folderId: folder.id, beforeKey: overId };
}

export function customFolderThreadPlacement(
  folders: readonly SidebarCustomFolder[],
  threadKey: string,
): CustomFolderThreadPlacement | null {
  for (const folder of folders) {
    const index = folder.threadKeys.indexOf(threadKey);
    if (index === -1) continue;
    return { folderId: folder.id, beforeKey: folder.threadKeys[index + 1] ?? null };
  }
  return null;
}

export function placeThreadInCustomFolder(
  folders: readonly SidebarCustomFolder[],
  threadKey: string,
  folderId: string,
  beforeKey: string | null,
  expand = true,
): readonly SidebarCustomFolder[] {
  if (threadKey.length === 0 || beforeKey === threadKey) return folders;
  const targetIndex = folders.findIndex((folder) => folder.id === folderId);
  const target = folders[targetIndex];
  if (target === undefined) return folders;
  const source = folders.find((folder) => folder.threadKeys.includes(threadKey));
  if (source?.id === folderId) {
    const from = target.threadKeys.indexOf(threadKey);
    let to = beforeKey === null ? target.threadKeys.length : target.threadKeys.indexOf(beforeKey);
    if (from === -1 || to === -1) return folders;
    if (from < to) to -= 1;
    if (from === to) return folders;
    const threadKeys = target.threadKeys.slice();
    threadKeys.splice(from, 1);
    threadKeys.splice(to, 0, threadKey);
    const next = folders.slice();
    next[targetIndex] = { ...target, threadKeys };
    return next;
  }
  const stripped = withoutThread(folders, threadKey);
  const nextTargetIndex = stripped.findIndex((folder) => folder.id === folderId);
  const nextTarget = stripped[nextTargetIndex];
  if (nextTarget === undefined) return folders;
  const threadKeys = nextTarget.threadKeys.slice();
  const at = beforeKey === null ? threadKeys.length : threadKeys.indexOf(beforeKey);
  threadKeys.splice(at < 0 ? threadKeys.length : at, 0, threadKey);
  const next = stripped.slice();
  next[nextTargetIndex] = {
    ...nextTarget,
    collapsed: expand ? false : nextTarget.collapsed,
    threadKeys,
  };
  return next;
}

export function removeThreadFromCustomFolders(
  folders: readonly SidebarCustomFolder[],
  threadKey: string,
): readonly SidebarCustomFolder[] {
  return withoutThread(folders, threadKey);
}

/** A closed folder still shows the open thread and counts the rest. */
export function customFolderDisplayKeys(
  memberKeys: readonly string[],
  collapsed: boolean,
  routeThreadKey: string | null,
): { readonly visibleKeys: readonly string[]; readonly hiddenKeys: readonly string[] } {
  if (!collapsed) return { visibleKeys: memberKeys, hiddenKeys: [] };
  const visibleKeys =
    routeThreadKey !== null && memberKeys.includes(routeThreadKey) ? [routeThreadKey] : [];
  return {
    visibleKeys,
    hiddenKeys: memberKeys.filter((key) => !visibleKeys.includes(key)),
  };
}

export function claimCustomFolderMembers(
  folders: readonly SidebarCustomFolder[],
  isVisible: (threadKey: string) => boolean,
): ReadonlyArray<{ readonly folder: SidebarCustomFolder; readonly memberKeys: readonly string[] }> {
  const claimed = new Set<string>();
  return folders.map((folder) => {
    const memberKeys: string[] = [];
    for (const key of folder.threadKeys) {
      if (claimed.has(key) || !isVisible(key)) continue;
      claimed.add(key);
      memberKeys.push(key);
    }
    return { folder, memberKeys };
  });
}
