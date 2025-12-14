// src/modules/shared/pubsub/events/user.events.ts
export enum UserEventTypes {
  USER_REGISTERED = 'user.registered',
  USER_APPROVED = 'user.approved',
  USER_REJECTED = 'user.rejected',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_AUTH_LEVEL_CHANGED = 'user.auth_level_changed',
  USER_ROLE_CHANGED = 'user.role_changed',
}

export interface UserRegisteredEvent {
  userId: number;
  username: string;
  email: string;
  role: string;
  displayname: string;
  phone: string;
  departmentId?: number;
  timestamp: string;
}

export interface UserAuthLevelChangedEvent {
  userId: number;
  authLevel: number;
  changedBy: number;
  timestamp: string;
}