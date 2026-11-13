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
  if (!names.has("New folder")) return "New folder";
  let index = 2;
  while (names.has(`New folder ${index}`)) index += 1;
  return `New folder ${index}`;
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
