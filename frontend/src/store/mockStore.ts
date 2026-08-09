import { create } from 'zustand';
import type {
  TaskSummary,
  ExtractionFields,
  GroupsConfig,
  GeneralSettings,
} from '../types';
import { MOCK_TASKS } from '../mocks/tasks';
import { MOCK_EXTRACTION } from '../mocks/extraction';
import { DEFAULT_GROUPS_CONFIG } from '../mocks/config-groups';

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToLocalStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

interface MockStore {
  tasks: TaskSummary[];
  fieldsByTaskId: Record<string, ExtractionFields>;
  groupsConfig: GroupsConfig;
  generalSettings: GeneralSettings;
  groupsConfigDirty: boolean;

  updateTaskFields(taskId: string, fields: ExtractionFields): void;
  saveGroupsConfig(config: GroupsConfig): void;
  saveGeneralSettings(settings: GeneralSettings): void;
  setGroupsConfigDirty(dirty: boolean): void;
  addMockTask(task: TaskSummary): void;
}

export const useMockStore = create<MockStore>((set) => ({
  tasks: MOCK_TASKS,
  fieldsByTaskId: {
    ...MOCK_EXTRACTION,
    ...loadFromLocalStorage<Record<string, ExtractionFields>>('mock:fields-by-task', {}),
  },
  groupsConfig: loadFromLocalStorage<GroupsConfig>('mock:groups', DEFAULT_GROUPS_CONFIG),
  generalSettings: {
    apiBaseUrl: 'http://127.0.0.1:8000',
    pollIntervalSec: 3,
    userId: 'anonymous',
    ...loadFromLocalStorage<Partial<GeneralSettings>>('mock:general-settings', {}),
  },
  groupsConfigDirty: false,

  updateTaskFields(taskId, fields) {
    set((state) => {
      const updated = { ...state.fieldsByTaskId, [taskId]: fields };
      saveToLocalStorage('mock:fields-by-task', updated);
      return { fieldsByTaskId: updated };
    });
  },

  saveGroupsConfig(config) {
    saveToLocalStorage('mock:groups', config);
    set({ groupsConfig: config });
  },

  saveGeneralSettings(settings) {
    saveToLocalStorage('mock:general-settings', settings);
    set({ generalSettings: settings });
  },

  setGroupsConfigDirty(dirty) {
    set({ groupsConfigDirty: dirty });
  },

  addMockTask(task) {
    set((state) => ({ tasks: [task, ...state.tasks] }));
  },
}));
