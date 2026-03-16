// API client for the Agent Desk backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.openweave.dev/api';

// Custom error class with field-level errors from DRF
export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  user_type: 'HUMAN' | 'BOT';
  skills: string[];
  description: string;
  is_active: boolean;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  slug: string;
  workspace?: string;
}

export interface Ticket {
  id: number;
  project: string;
  project_name: string;
  ticket_slug: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_TESTING' | 'REVIEW' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ticket_type: 'BUG' | 'FEATURE';
  assigned_to: number | null;
  assigned_to_details: User | null;
  created_by: number;
  created_by_details: User;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface TicketAttachment {
  id: number;
  ticket: number;
  file: string;
  filename: string;
  url: string;
  uploaded_by: number;
  uploaded_by_details: User;
  created_at: string;
}

export interface Comment {
  id: number;
  ticket: number | string;
  author: number;
  author_details: User;
  ticket_details?: { ticket_slug: string; title: string };
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  owner: number;
  owner_details?: User;
  member_count: number;
  restrict_status_to_assigned: boolean;
  created_at: string;
}

export interface ProjectAgentMembership {
  id: number;
  project: string;
  user: User;
  role: 'ADMIN' | 'MEMBER';
  joined_at: string;
}

export interface WorkspaceMember {
  id: number;
  workspace: string;
  user: User;
  joined_at: string;
}

export interface WorkspaceInvite {
  id: number;
  workspace: string;
  token: string;
  created_by: number;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user?: User;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface StatusDefinition {
  id: number;
  workspace: string;
  key: string;
  label: string;
  color: string;
  is_default: boolean;
  position: number;
  in_use?: boolean; // deprecated — removed from API
  allowed_from: number[];
  allowed_users: number[];
  allowed_users_details: User[];
}

/** @deprecated Legacy interface — transitions are now handled via allowed_from on StatusDefinition */
export interface StatusTransition {
  id: number;
  workspace: string;
  from_status: number;
  to_status: number;
  from_status_key: string;
  to_status_key: string;
  actor_type: 'BOT' | 'HUMAN' | 'ALL';
}

export interface SubscriptionStatus {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface DashboardStats {
  total_tickets: number;
  status_counts: Record<string, number>;
  statuses: StatusDefinition[];
  completed_today: number;
  total_projects: number;
  total_members: number;
  my_tickets: number;
  recent_tickets: Ticket[];
  my_assigned: Ticket[];
}

// Token management
export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  },

  getRefreshToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  },

  setTokens: (tokens: AuthTokens) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('accessToken', tokens.access);
    localStorage.setItem('refreshToken', tokens.refresh);
    localStorage.setItem('user', JSON.stringify(tokens.user));
  },

  clearTokens: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  getUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isLoggedIn: (): boolean => {
    return !!tokenStorage.getAccessToken();
  }
};

// API client class
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = tokenStorage.getAccessToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${tokenStorage.getAccessToken()}`,
          };
          const retryResponse = await fetch(url, config);
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        tokenStorage.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // DRF returns field-level errors as {field: [errors]} or {detail: "msg"}
        if (errorData.detail) {
          throw new ApiError(errorData.detail, response.status, errorData);
        }
        // Build readable message from field errors
        const fieldErrors: Record<string, string[]> = {};
        const messages: string[] = [];
        for (const [key, value] of Object.entries(errorData)) {
          const errs = Array.isArray(value) ? value.map(String) : [String(value)];
          fieldErrors[key] = errs;
          messages.push(`${key}: ${errs.join(', ')}`);
        }
        if (messages.length > 0) {
          throw new ApiError(messages.join('; '), response.status, errorData, fieldErrors);
        }
        throw new ApiError(`HTTP ${response.status}`, response.status, errorData);
      }

      // 204 No Content — nothing to parse
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const tokens = await response.json();
        localStorage.setItem('accessToken', tokens.access);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }

  // Auth
  async login(username: string, password: string): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // SimpleJWT only returns access + refresh, fetch user separately
    if (tokens.access) {
      tokenStorage.setTokens(tokens);
      const user = await this.getCurrentUser();
      tokens.user = user;
    }
    return tokens;
  }

  async register(data: { username: string; name: string; password: string }): Promise<AuthTokens> {
    const tokens = await this.request<AuthTokens>('/auth/join/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (tokens.access) {
      tokenStorage.setTokens(tokens);
      const user = await this.getCurrentUser();
      tokens.user = user;
    }
    return tokens;
  }

  // Projects
  async getProjectsPaginated(params?: Record<string, string>): Promise<PaginatedResponse<Project>> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<PaginatedResponse<Project>>(`/projects/${query}`);
  }

  async getProjects(params?: Record<string, string>): Promise<Project[]> {
    const response = await this.getProjectsPaginated(params);
    return response.results || [];
  }

  async getProject(slug: string): Promise<Project> {
    return this.request<Project>(`/projects/${slug}/`);
  }

  async getProjectAgents(projectSlug: string): Promise<User[]> {
    const response = await this.request<PaginatedResponse<User>>(`/users/?project=${projectSlug}`);
    return response.results || [];
  }

  async getProjectAgentMemberships(projectSlug: string): Promise<ProjectAgentMembership[]> {
    const response = await this.request<PaginatedResponse<ProjectAgentMembership>>(`/project-agents/?project=${projectSlug}`);
    return response.results || [];
  }

  async updateProjectAgentRole(membershipId: number, role: string): Promise<ProjectAgentMembership> {
    return this.request<ProjectAgentMembership>(`/project-agents/${membershipId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async updateProjectAgent(membershipId: number, data: Partial<Pick<ProjectAgentMembership, 'role'>>): Promise<ProjectAgentMembership> {
    return this.request<ProjectAgentMembership>(`/project-agents/${membershipId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    return this.request<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(slug: string, data: Partial<Project> & { agent_ids?: number[] }): Promise<Project> {
    return this.request<Project>(`/projects/${slug}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(slug: string): Promise<void> {
    await this.request(`/projects/${slug}/`, { method: 'DELETE' });
  }

  // Tickets
  async getTicketsPaginated(params?: Record<string, string>): Promise<PaginatedResponse<Ticket>> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<PaginatedResponse<Ticket>>(`/tickets/${query}`);
  }

  async getTickets(params?: Record<string, string>): Promise<Ticket[]> {
    const response = await this.getTicketsPaginated(params);
    return response.results || [];
  }

  async getTicket(id: number | string): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}/`);
  }

  async createTicket(ticket: Partial<Ticket>): Promise<Ticket> {
    return this.request<Ticket>('/tickets/', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  }

  async updateTicket(id: number | string, ticket: Partial<Ticket>): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(ticket),
    });
  }

  async deleteTicket(id: number | string): Promise<void> {
    await this.request(`/tickets/${id}/`, { method: 'DELETE' });
  }

  // Comments
  async getComments(params?: Record<string, string>): Promise<Comment[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<PaginatedResponse<Comment>>(`/comments/${query}`);
    return response.results || [];
  }

  async getCommentsPaginated(params?: Record<string, string>): Promise<PaginatedResponse<Comment>> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<PaginatedResponse<Comment>>(`/comments/${query}`);
  }

  async createComment(comment: Partial<Comment>): Promise<Comment> {
    return this.request<Comment>('/comments/', {
      method: 'POST',
      body: JSON.stringify(comment),
    });
  }

  // Attachments
  async getAttachments(params?: Record<string, string>): Promise<TicketAttachment[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<PaginatedResponse<TicketAttachment>>(`/attachments/${query}`);
    return response.results || [];
  }

  async uploadAttachment(ticketId: number, file: File): Promise<TicketAttachment> {
    const url = `${this.baseUrl}/attachments/`;
    const token = tokenStorage.getAccessToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ticket', String(ticketId));
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(errorData.detail || `Upload failed (${response.status})`, response.status, errorData);
    }
    return response.json();
  }

  async deleteAttachment(id: number): Promise<void> {
    await this.request(`/attachments/${id}/`, { method: 'DELETE' });
  }

  // Users
  async getUsers(params?: Record<string, string>): Promise<User[]> {
    const merged = { page_size: '100', ...params };
    const query = '?' + new URLSearchParams(merged).toString();
    const response = await this.request<PaginatedResponse<User>>(`/users/${query}`);
    return response.results || [];
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/users/me/');
  }

  async getDashboard(params: Record<string, string>): Promise<DashboardStats> {
    const query = '?' + new URLSearchParams(params).toString();
    return this.request<DashboardStats>(`/dashboard/${query}`);
  }

  async getStatusDefinitions(workspaceSlug: string): Promise<StatusDefinition[]> {
    const res = await this.request<{ results: StatusDefinition[] }>(`/status-definitions/?workspace=${workspaceSlug}&page_size=100`);
    return res.results;
  }

  async createStatusDefinition(data: Partial<StatusDefinition>): Promise<StatusDefinition> {
    return this.request<StatusDefinition>('/status-definitions/', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateStatusDefinition(id: number, data: Partial<StatusDefinition>): Promise<StatusDefinition> {
    return this.request<StatusDefinition>(`/status-definitions/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteStatusDefinition(id: number): Promise<void> {
    await this.request<void>(`/status-definitions/${id}/`, { method: 'DELETE' });
  }

  async updateMyProfile(data: { name?: string; email?: string; description?: string; skills?: string[] }): Promise<User> {
    return this.request<User>('/users/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    const response = await this.request<PaginatedResponse<Workspace>>('/workspaces/');
    return response.results || [];
  }

  async createWorkspace(data: { name: string; slug: string }): Promise<Workspace> {
    return this.request<Workspace>('/workspaces/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkspace(slug: string, data: Partial<Workspace>): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${slug}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkspace(slug: string): Promise<void> {
    await this.request(`/workspaces/${slug}/`, { method: 'DELETE' });
  }

  // Workspace Members
  async getWorkspaceMembersPaginated(params?: Record<string, string>): Promise<PaginatedResponse<WorkspaceMember>> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<PaginatedResponse<WorkspaceMember>>(`/workspace-members/${query}`);
  }

  async getWorkspaceMembers(params?: Record<string, string>): Promise<WorkspaceMember[]> {
    const response = await this.getWorkspaceMembersPaginated({ page_size: '100', ...params });
    return response.results || [];
  }

  async removeWorkspaceMember(id: number): Promise<void> {
    await this.request(`/workspace-members/${id}/`, { method: 'DELETE' });
  }

  // Invites
  async getInvites(params?: Record<string, string>): Promise<WorkspaceInvite[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<PaginatedResponse<WorkspaceInvite>>(`/invites/${query}`);
    return response.results || [];
  }

  async createInvite(data: { workspace: string; expires_at?: string; max_uses?: number }): Promise<WorkspaceInvite> {
    return this.request<WorkspaceInvite>('/invites/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvite(id: number, data: Partial<WorkspaceInvite>): Promise<WorkspaceInvite> {
    return this.request<WorkspaceInvite>(`/invites/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteInvite(id: number): Promise<void> {
    await this.request(`/invites/${id}/`, { method: 'DELETE' });
  }

  // Billing
  async createCheckoutSession(workspaceSlug: string, plan: string): Promise<{ checkout_url: string }> {
    return this.request<{ checkout_url: string }>('/billing/checkout/', {
      method: 'POST',
      body: JSON.stringify({
        workspace: workspaceSlug,
        plan,
        frontend_url: typeof window !== 'undefined' ? window.location.origin : 'https://openweave.dev',
      }),
    });
  }

  async getSubscriptionStatus(workspaceSlug: string): Promise<SubscriptionStatus> {
    return this.request<SubscriptionStatus>(`/billing/status/?workspace=${workspaceSlug}`);
  }

  async createPortalSession(workspaceSlug: string): Promise<{ portal_url: string }> {
    return this.request<{ portal_url: string }>('/billing/portal/', {
      method: 'POST',
      body: JSON.stringify({
        workspace: workspaceSlug,
        frontend_url: typeof window !== 'undefined' ? window.location.origin : 'https://openweave.dev',
      }),
    });
  }

  async joinWorkspace(token: string): Promise<Workspace> {
    return this.request<Workspace>('/auth/join/', {
      method: 'POST',
      body: JSON.stringify({ workspace_invite_token: token }),
    });
  }

  async registerAndJoin(data: { workspace_invite_token: string; username: string; name: string; password: string }): Promise<{ workspace: Workspace; user: User }> {
    const response = await fetch(`${this.baseUrl}/auth/join/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.access) {
      tokenStorage.setTokens({ access: result.access, refresh: result.refresh });
      const user = await this.getCurrentUser();
      return { workspace: result.workspace, user };
    }
    return result;
  }
}

export const api = new ApiClient(API_BASE_URL);

/**
 * Resolve an attachment/media URL to a full absolute URL.
 * Backend FileField URLs may be relative (e.g. "/media/...") — this
 * prefixes them with the API origin so they load correctly from the frontend.
 */
export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path — prefix with API origin
  const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'https://api.openweave.dev/api').replace(/\/api\/?$/, '');
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}
/** @deprecated Legacy interface — exceptions are no longer used; access is controlled via allowed_users on StatusDefinition */
export interface TransitionException {
  id: number;
  workspace: string;
  from_status: number;
  to_status: number;
  from_status_key: string;
  to_status_key: string;
  from_status_label: string;
  to_status_label: string;
  exception_type: 'human' | 'bot';
  user: number | null;
  user_details: User | null;
  reason: string;
  created_by: number;
  created_by_details: User | null;
  created_at: string;
}
// build: 1773486565
