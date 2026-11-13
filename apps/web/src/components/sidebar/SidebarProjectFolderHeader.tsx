import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ChevronDownIcon, FolderIcon, SquarePenIcon } from "lucide-react";
import { memo, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { cn } from "~/lib/utils";
import type { SidebarCustomFolder } from "../../sidebarCustomFolders";
import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { useUiStateStore } from "../../uiStateStore";
import { resolveSidebarFolderDot, resolveThreadLastVisitedAt } from "../Sidebar.logic";
import { ProjectFavicon } from "../ProjectFavicon";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const FOLDER_DOT_CLASS_NAME = {
  attention: "bg-warning",
  failed: "bg-error",
  unread: "bg-success",
  working: "bg-info",
} as const;

const FOLDER_DOT_LABEL = {
  attention: ", needs you",
  failed: ", failed",
  unread: ", done",
  working: ", working",
} as const;

/** The folder's sidebar tree row; its thread rows name it as their parent. */
export function sidebarFolderRowId(projectKey: string) {
  return `folder:${projectKey}`;
}

export function customFolderRowId(folderId: string) {
  return `custom-folder:${folderId}`;
}

function FolderRenameInput(props: {
  name: string;
  onNameChange: (name: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const settledRef = useRef(false);
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      settledRef.current = true;
      props.onCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      settledRef.current = true;
      props.onCancel();
    }
  };
  return (
    <input
      autoFocus
      value={props.name}
      dir="auto"
      aria-label="Folder name"
      onChange={(event) => props.onNameChange(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (!settledRef.current) props.onCommit();
      }}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className="min-w-0 flex-1 rounded-sm border border-input bg-card px-1 text-sm font-medium text-card-foreground outline-none focus:border-foreground"
    />
  );
}

function SidebarFolderHeader(props: {
  testId: string;
  rowId: string;
  collapsed: boolean;
  label: string;
  icon: ReactNode;
  hiddenThreads: readonly EnvironmentThreadShell[];
  onToggle: () => void;
  onContextMenu: (position: { x: number; y: number }) => void;
  newThreadLabel?: string | undefined;
  onNewThread?: (() => void) | undefined;
  rename?:
    | {
        readonly name: string;
        readonly onNameChange: (name: string) => void;
        readonly onCommit: () => void;
        readonly onCancel: () => void;
      }
    | undefined;
}) {
  const localLastVisitedAtById = useUiStateStore((state) => state.threadLastVisitedAtById);
  const dot = props.collapsed
    ? resolveSidebarFolderDot(
        props.hiddenThreads.map((thread) => ({
          ...thread,
          lastVisitedAt: resolveThreadLastVisitedAt(
            thread.lastVisitedAt,
            localLastVisitedAtById[
              scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))
            ],
          ),
        })),
      )
    : null;
  const rowClassName =
    "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
  const trailing = (
    <>
      {dot ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", FOLDER_DOT_CLASS_NAME[dot])}>
          <span className="sr-only">{FOLDER_DOT_LABEL[dot]}</span>
        </span>
      ) : null}
      {props.collapsed && props.hiddenThreads.length > 0 ? (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums text-sidebar-muted-foreground",
            props.onNewThread &&
              "group-hover/project-folder:invisible group-has-[[data-sidebar-action-for]:focus]/project-folder:invisible pointer-coarse:invisible",
          )}
        >
          {props.hiddenThreads.length}
        </span>
      ) : null}
      <ChevronDownIcon
        aria-hidden
        className={cn(
          "size-3 shrink-0 text-sidebar-muted-foreground transition-transform",
          props.collapsed && "-rotate-90",
        )}
      />
    </>
  );
  return (
    <li
      data-testid={props.testId}
      className="group/project-folder relative mt-2 list-none first:mt-0"
    >
      {props.rename ? (
        <div
          data-sidebar-row={props.rowId}
          tabIndex={0}
          aria-expanded={!props.collapsed}
          className={rowClassName}
        >
          {props.icon}
          <FolderRenameInput
            name={props.rename.name}
            onNameChange={props.rename.onNameChange}
            onCommit={props.rename.onCommit}
            onCancel={props.rename.onCancel}
          />
          {trailing}
        </div>
      ) : (
        <button
          type="button"
          data-sidebar-row={props.rowId}
          aria-expanded={!props.collapsed}
          onClick={props.onToggle}
          onContextMenu={(event) => {
            event.preventDefault();
            props.onContextMenu({ x: event.clientX, y: event.clientY });
          }}
          className={rowClassName}
        >
          {props.icon}
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground/90">
            {props.label}
          </span>
          {trailing}
        </button>
      )}
      {props.onNewThread ? (
        // The count hides while this button is hovered or focused, so it can sit over the count.
        <span className="absolute inset-y-0 right-6 flex items-center opacity-0 focus-within:opacity-100 group-hover/project-folder:opacity-100 pointer-coarse:opacity-100">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  data-sidebar-action-for={props.rowId}
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label={props.newThreadLabel}
                  onClick={props.onNewThread}
                />
              }
            >
              <SquarePenIcon aria-hidden />
            </TooltipTrigger>
            <TooltipPopup>{props.newThreadLabel}</TooltipPopup>
          </Tooltip>
        </span>
      ) : null}
    </li>
  );
}

/**
 * A project folder in the boring sidebar. It reads like a shelf header: a trailing
 * count and chevron, with the count and a status dot only while it is closed, so a
 * closed folder still says when a hidden thread needs you.
 */
export const SidebarProjectFolderHeader = memo(function SidebarProjectFolderHeader(props: {
  group: SidebarProjectSnapshot;
  collapsed: boolean;
  hiddenThreads: readonly EnvironmentThreadShell[];
  onToggle: (group: SidebarProjectSnapshot) => void;
  onNewThread: (group: SidebarProjectSnapshot) => void;
  onContextMenu: (group: SidebarProjectSnapshot, position: { x: number; y: number }) => void;
}) {
  const { group, collapsed, hiddenThreads } = props;
  return (
    <SidebarFolderHeader
      testId="sidebar-project-folder"
      rowId={sidebarFolderRowId(group.projectKey)}
      collapsed={collapsed}
      label={group.displayName}
      icon={<ProjectFavicon project={group} className="size-4 shrink-0" />}
      hiddenThreads={hiddenThreads}
      onToggle={() => props.onToggle(group)}
      onContextMenu={(position) => props.onContextMenu(group, position)}
      newThreadLabel={`New thread in ${group.displayName}`}
      onNewThread={() => props.onNewThread(group)}
    />
  );
});

export const SidebarCustomFolderHeader = memo(function SidebarCustomFolderHeader(props: {
  folder: SidebarCustomFolder;
  collapsed: boolean;
  hiddenThreads: readonly EnvironmentThreadShell[];
  onToggle: (folderId: string) => void;
  onContextMenu: (folderId: string, position: { x: number; y: number }) => void;
}) {
  const editingName = useUiStateStore((state) =>
    state.editingCustomFolderId === props.folder.id ? state.editingCustomFolderName : null,
  );
  return (
    <SidebarFolderHeader
      testId="sidebar-custom-folder"
      rowId={customFolderRowId(props.folder.id)}
      collapsed={props.collapsed}
      label={props.folder.name}
      icon={<FolderIcon aria-hidden className="size-4 shrink-0" />}
      hiddenThreads={props.hiddenThreads}
      onToggle={() => props.onToggle(props.folder.id)}
      onContextMenu={(position) => props.onContextMenu(props.folder.id, position)}
      rename={
        editingName === null
          ? undefined
          : {
              name: editingName,
              onNameChange: (name) => useUiStateStore.getState().setEditingCustomFolderName(name),
              onCommit: () => useUiStateStore.getState().commitCustomFolderRename(),
              onCancel: () => useUiStateStore.getState().cancelCustomFolderRename(),
            }
      }
    />
  );
});
