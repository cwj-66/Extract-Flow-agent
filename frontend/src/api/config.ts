import { apiRequest } from './client';
import type { GroupsConfig } from '../types';

export function fetchGroupsConfig(): Promise<GroupsConfig> {
  return apiRequest<GroupsConfig>('/config/groups');
}

export function saveGroupsConfig(config: GroupsConfig): Promise<GroupsConfig> {
  return apiRequest<GroupsConfig>('/config/groups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}
