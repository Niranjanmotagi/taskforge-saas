import {
  BillingInterval,
  ChannelType,
  CustomFieldType,
  DependencyType,
  InvitationStatus,
  InvoiceStatus,
  NotificationType,
  PlanTier,
  ProjectHealth,
  ProjectStatus,
  RecurrenceFrequency,
  SprintStatus,
  SubscriptionStatus,
  SystemRole,
  TaskPriority,
  TaskStatusCategory,
  TimerStatus,
  WorkspaceRole,
} from './enums';

/** Serialized (JSON) entity shapes as returned by the REST API. Dates are ISO strings. */

export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  systemRole: SystemRole;
  emailVerifiedAt: string | null;
  timezone: string;
  locale: string;
  createdAt: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  ownerId: string;
  planTier: PlanTier;
  storageUsedBytes: number;
  createdAt: string;
  memberCount?: number;
  role?: WorkspaceRole;
}

export interface WorkspaceMemberDto {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  jobTitle: string | null;
  joinedAt: string;
  user: Pick<UserDto, 'id' | 'email' | 'name' | 'avatarUrl'>;
}

export interface InvitationDto {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  invitedById: string;
  expiresAt: string;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  budgetSpent: number | null;
  currency: string;
  clientName: string | null;
  clientEmail: string | null;
  isTemplate: boolean;
  isFavorite?: boolean;
  progress: number;
  leadId: string | null;
  taskCounts?: { total: number; completed: number };
  createdAt: string;
  archivedAt: string | null;
}

export interface BoardColumnDto {
  id: string;
  projectId: string;
  name: string;
  category: TaskStatusCategory;
  color: string;
  position: number;
  wipLimit: number | null;
}

export interface LabelDto {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
}

export interface ChecklistItemDto {
  id: string;
  taskId: string;
  title: string;
  isCompleted: boolean;
  position: number;
}

export interface TaskDto {
  id: string;
  workspaceId: string;
  projectId: string;
  columnId: string | null;
  sprintId: string | null;
  parentId: string | null;
  number: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  statusCategory: TaskStatusCategory;
  position: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number;
  storyPoints: number | null;
  completedAt: string | null;
  creatorId: string;
  assignees: Array<Pick<UserDto, 'id' | 'name' | 'avatarUrl'>>;
  labels: LabelDto[];
  subtaskCount?: { total: number; completed: number };
  commentCount?: number;
  attachmentCount?: number;
  isRecurring: boolean;
  recurrence?: { frequency: RecurrenceFrequency; interval: number } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependencyDto {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: DependencyType;
}

export interface CommentDto {
  id: string;
  taskId: string;
  authorId: string;
  author: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>;
  body: string;
  parentId: string | null;
  isEdited: boolean;
  createdAt: string;
}

export interface CustomFieldDto {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  isRequired: boolean;
}

export interface SprintDto {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  taskCount?: number;
  completedCount?: number;
}

export interface TimeEntryDto {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  isBillable: boolean;
  hourlyRate: number | null;
  status: TimerStatus;
}

export interface AttachmentDto {
  id: string;
  workspaceId: string;
  taskId: string | null;
  folderId: string | null;
  uploaderId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  thumbnailUrl: string | null;
  version: number;
  createdAt: string;
}

export interface ChannelDto {
  id: string;
  workspaceId: string;
  type: ChannelType;
  name: string | null;
  projectId: string | null;
  taskId: string | null;
  memberIds: string[];
  lastMessageAt: string | null;
  unreadCount?: number;
}

export interface MessageDto {
  id: string;
  channelId: string;
  senderId: string;
  sender: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>;
  body: string;
  attachmentUrl: string | null;
  reactions: Array<{ emoji: string; userIds: string[] }>;
  readBy: string[];
  isEdited: boolean;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PlanDto {
  id: string;
  tier: PlanTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxMembers: number;
  maxProjects: number;
  storageLimitBytes: number;
  aiCreditsPerMonth: number;
  features: string[];
}

export interface SubscriptionDto {
  id: string;
  workspaceId: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  interval: BillingInterval;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEndsAt: string | null;
}

export interface InvoiceDto {
  id: string;
  workspaceId: string;
  number: string;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  issuedAt: string;
}

export interface ActivityDto {
  id: string;
  workspaceId: string;
  actorId: string;
  actor: Pick<UserDto, 'id' | 'name' | 'avatarUrl'>;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  projectId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
