import { create } from "zustand";

interface BulkSelectionState {
  selectedTaskIds: Set<string>;
  // Selection is scoped to a single column/status: selecting a task from a
  // different scope starts a fresh selection there.
  selectionScope: string | null;
  isSelectMode: boolean;
  availableTaskIds: string[];
  focusedTaskId: string | null;

  selectTask: (taskId: string, scope?: string) => void;
  deselectTask: (taskId: string) => void;
  toggleSelection: (taskId: string, scope?: string) => void;
  clearSelection: () => void;
  selectAll: () => void;
  setAvailableTasks: (taskIds: string[]) => void;
  getSelectedCount: () => number;
  isSelected: (taskId: string) => boolean;
  setFocusedTask: (taskId: string | null) => void;
  clearFocus: () => void;
  isFocused: (taskId: string) => boolean;
  focusNext: () => void;
  focusPrevious: () => void;
}

const useBulkSelectionStore = create<BulkSelectionState>((set, get) => ({
  selectedTaskIds: new Set(),
  selectionScope: null,
  isSelectMode: false,
  availableTaskIds: [],
  focusedTaskId: null,

  selectTask: (taskId: string, scope?: string) =>
    set((state) => {
      const scopeChanged =
        scope !== undefined &&
        state.selectionScope !== null &&
        state.selectionScope !== scope;
      return {
        selectedTaskIds: scopeChanged
          ? new Set([taskId])
          : new Set([...state.selectedTaskIds, taskId]),
        selectionScope: scope ?? state.selectionScope,
        isSelectMode: true,
      };
    }),

  deselectTask: (taskId: string) =>
    set((state) => {
      const newSet = new Set(state.selectedTaskIds);
      newSet.delete(taskId);
      return {
        selectedTaskIds: newSet,
        selectionScope: newSet.size > 0 ? state.selectionScope : null,
        isSelectMode: newSet.size > 0,
      };
    }),

  toggleSelection: (taskId: string, scope?: string) => {
    const { selectedTaskIds, selectionScope } = get();
    const scopeChanged =
      scope !== undefined &&
      selectionScope !== null &&
      selectionScope !== scope;
    if (!scopeChanged && selectedTaskIds.has(taskId)) {
      get().deselectTask(taskId);
    } else {
      get().selectTask(taskId, scope);
    }
  },

  clearSelection: () =>
    set({
      selectedTaskIds: new Set(),
      selectionScope: null,
      isSelectMode: false,
    }),

  // ponytail: Ctrl+A still selects across all columns (store has no
  // task→column map); per-column select-all when that map exists.
  selectAll: () =>
    set((state) => ({
      selectedTaskIds: new Set(state.availableTaskIds),
      selectionScope: null,
      isSelectMode: true,
    })),

  setAvailableTasks: (taskIds: string[]) =>
    set(() => ({
      availableTaskIds: taskIds,
    })),

  getSelectedCount: () => {
    const { selectedTaskIds } = get();
    return selectedTaskIds.size;
  },

  isSelected: (taskId: string) => {
    const { selectedTaskIds } = get();
    return selectedTaskIds.has(taskId);
  },

  setFocusedTask: (taskId: string | null) =>
    set(() => ({
      focusedTaskId: taskId,
    })),

  clearFocus: () =>
    set(() => ({
      focusedTaskId: null,
    })),

  isFocused: (taskId: string) => {
    const { focusedTaskId } = get();
    return focusedTaskId === taskId;
  },

  focusNext: () => {
    const { availableTaskIds, focusedTaskId } = get();

    if (availableTaskIds.length === 0) return;

    if (!focusedTaskId) {
      get().setFocusedTask(availableTaskIds[0]);
      return;
    }

    const currentIndex = availableTaskIds.indexOf(focusedTaskId);
    const nextIndex = (currentIndex + 1) % availableTaskIds.length;
    get().setFocusedTask(availableTaskIds[nextIndex]);
  },

  focusPrevious: () => {
    const { availableTaskIds, focusedTaskId } = get();

    if (availableTaskIds.length === 0) return;

    if (!focusedTaskId) {
      get().setFocusedTask(availableTaskIds[availableTaskIds.length - 1]);
      return;
    }

    const currentIndex = availableTaskIds.indexOf(focusedTaskId);
    const previousIndex =
      currentIndex === 0 ? availableTaskIds.length - 1 : currentIndex - 1;
    get().setFocusedTask(availableTaskIds[previousIndex]);
  },
}));

export default useBulkSelectionStore;
