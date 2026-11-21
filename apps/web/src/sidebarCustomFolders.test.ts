import { describe, expect, it } from "vite-plus/test";

import {
  claimCustomFolderMembers,
  createCustomFolder,
  customFolderDisplayKeys,
  deleteCustomFolder,
  moveThreadToCustomFolder,
  nextCustomFolderName,
  removeThreadFromCustomFolders,
  renameCustomFolder,
  sanitizeCustomFolders,
  setCustomFolderCollapsed,
  type SidebarCustomFolder,
} from "./sidebarCustomFolders";

const folder = (
  id: string,
  name: string,
  threadKeys: readonly string[],
  collapsed = false,
): SidebarCustomFolder => ({ id, name, collapsed, threadKeys });

describe("custom sidebar folders", () => {
  it("keeps a thread in the first folder that names it", () => {
    const folders = sanitizeCustomFolders([
      {
        id: "cf_bugs",
        name: " Bugs ",
        collapsed: true,
        threadKeys: ["env:a", "env:a", ""],
      },
      { id: "nope", name: "Bad", threadKeys: ["env:b"] },
      { id: "cf_bugs", name: "Duplicate", threadKeys: ["env:c"] },
      {
        id: "cf_later",
        name: "Later",
        collapsed: "yes",
        threadKeys: ["env:a", "env:b"],
      },
      { id: "cf_empty", name: "   ", threadKeys: ["env:d"] },
    ]);

    expect(folders).toEqual([
      folder("cf_bugs", "Bugs", ["env:a"], true),
      folder("cf_later", "Later", ["env:b"]),
    ]);
    expect(claimCustomFolderMembers(folders, (key) => key !== "env:b")).toEqual([
      { folder: folders[0], memberKeys: ["env:a"] },
      { folder: folders[1], memberKeys: [] },
    ]);
  });

  it("names, files, and restores threads without dropping empty folders", () => {
    const created = createCustomFolder([], "env:a", "cf_one");
    expect(created).toEqual([folder("cf_one", "New folder", ["env:a"])]);
    const second = createCustomFolder(created, "env:a", "cf_two");
    expect(second).toEqual([
      folder("cf_two", "New folder 2", ["env:a"]),
      folder("cf_one", "New folder", []),
    ]);
    expect(nextCustomFolderName(second)).toBe("New folder 3");
    expect(renameCustomFolder(second, "cf_two", "   ")).toBe(second);
    const named = renameCustomFolder(second, "cf_two", " Bugs ");
    expect(named[0]).toEqual(folder("cf_two", "Bugs", ["env:a"]));
    expect(moveThreadToCustomFolder(named, "env:a", "cf_two")).toBe(named);
    const moved = moveThreadToCustomFolder(named, "env:b", "cf_one");
    expect(moved).toEqual([
      folder("cf_two", "Bugs", ["env:a"]),
      folder("cf_one", "New folder", ["env:b"]),
    ]);
    const collapsed = setCustomFolderCollapsed(moved, "cf_one", true);
    expect(collapsed[1]?.collapsed).toBe(true);
    expect(setCustomFolderCollapsed(collapsed, "cf_one", true)).toBe(collapsed);
    expect(moveThreadToCustomFolder(collapsed, "env:a", "cf_one")[1]).toEqual(
      folder("cf_one", "New folder", ["env:b", "env:a"]),
    );
    expect(removeThreadFromCustomFolders(moved, "env:b")[1]?.threadKeys).toEqual([]);
    expect(removeThreadFromCustomFolders(moved, "missing")).toBe(moved);
    expect(deleteCustomFolder(moved, "cf_two")).toEqual([
      folder("cf_one", "New folder", ["env:b"]),
    ]);
    expect(deleteCustomFolder(moved, "missing")).toBe(moved);
    expect(createCustomFolder(moved, "env:c", "new")).toBe(moved);
  });

  it("shows only the open thread while a folder is collapsed", () => {
    expect(customFolderDisplayKeys(["env:a", "env:b"], true, "env:b")).toEqual({
      visibleKeys: ["env:b"],
      hiddenKeys: ["env:a"],
    });
    expect(customFolderDisplayKeys(["env:a"], true, null)).toEqual({
      visibleKeys: [],
      hiddenKeys: ["env:a"],
    });
    expect(customFolderDisplayKeys(["env:a", "env:b"], false, "env:b").hiddenKeys).toEqual([]);
  });
});
