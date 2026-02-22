// API client for the Agent Desk backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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
  role: 'ADMIN' | 'MEMBER';
  skills: string[];
  is_active: boolean;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  agents: User[];
  workspace?: number;
}

export interface Ticket {
  id: number;
  project: number;
  project_name: string;
  title: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'BLOCKED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  assigned_to: number | null;
  assigned_to_details: User | null;
  created_by: number;
  created_by_details: User;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface Comment {
  id: number;
  ticket: number;
  author: number;
  author_details: User;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  owner: number;
  member_count: number;
  created_at: string;
}

export interface WorkspaceMember {
  id: number;
  workspace: number;
  user: User;
  role: 'ADMIN' | 'MEMBER';
  joined_at: string;
}

export interface WorkspaceInvite {
  id: number;
  workspace: number;
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
  async getProjects(params?: Record<string, string>): Promise<Project[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<PaginatedResponse<Project>>(`/projects/${query}`);
    return response.results || [];
  }

  async getProject(id: number): Promise<Project> {
    return this.request<Project>(`/projects/${id}/`);
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    return this.request<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: number, data: Partial<Project> & { agent_ids?: number[] }): Promise<Project> {
    return this.request<Project>(`/projects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: number): Promise<void> {
    await this.request(`/projects/${id}/`, { method: 'DELETE' });
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

  async getTicket(id: number): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}/`);
  }

  async createTicket(ticket: Partial<Ticket>): Promise<Ticket> {
    return this.request<Ticket>('/tickets/', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  }

  async updateTicket(id: number, ticket: Partial<Ticket>): Promise<Ticket> {
    return this.request<Ticket>(`/tickets/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(ticket),
    });
  }

  async deleteTicket(id: number): Promise<void> {
    await this.request(`/tickets/${id}/`, { method: 'DELETE' });
  }

  // Comments
  async getComments(params?: Record<string, string>): Promise<Comment[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<PaginatedResponse<Comment>>(`/comments/${query}`);
    return response.results || [];
  }

  async createComment(comment: Partial<Comment>): Promise<Comment> {
    return this.request<Comment>('/comments/', {
      method: 'POST',
      body: JSON.stringify(comment),
    });
  }

  // Agents
  async getUsers(): Promise<User[]> {
    const response = await this.request<PaginatedResponse<User>>('/users/');
    return response.results || [];
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/users/me/');
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

  async updateWorkspace(id: number, data: Partial<Workspace>): Promise<Workspace> {
    return this.request<Workspace>(`/workspaces/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkspace(id: number): Promise<void> {
    await this.request(`/workspaces/${id}/`, { method: 'DELETE' });
  }

  // Workspace Members
  async getWorkspaceMembers(params?: Record<string, string>): Promise<WorkspaceMember[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<PaginatedResponse<WorkspaceMember>>(`/workspace-members/${query}`);
    return response.results || [];
  }

  async updateWorkspaceMember(id: number, data: { role: string }): Promise<WorkspaceMember> {
    return this.request<WorkspaceMember>(`/workspace-members/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
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

  async createInvite(data: { workspace: number; expires_at?: string; max_uses?: number }): Promise<WorkspaceInvite> {
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
