// API client for the Agent Desk backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Types
export interface Agent {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  agent_type: 'HUMAN' | 'BOT';
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
  agents: Agent[];
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
  assigned_to_details: Agent | null;
  created_by: number;
  created_by_details: Agent;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
}

export interface Comment {
  id: number;
  ticket: number;
  author: number;
  author_details: Agent;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: Agent;
}

export interface ApiResponse<T> {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
  data?: T;
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
  
  getUser: (): Agent | null => {
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
      
      // Handle 401 Unauthorized - try to refresh token
      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the original request with new token
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${tokenStorage.getAccessToken()}`,
          };
          const retryResponse = await fetch(url, config);
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        // If refresh failed, clear tokens and redirect to login
        tokenStorage.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `HTTP ${response.status}`);
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

  // Auth endpoints
  async login(email: string, password: string): Promise<AuthTokens> {
    return this.request<AuthTokens>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData: Partial<Agent> & { password: string }): Promise<Agent> {
    return this.request<Agent>('/agents/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const response = await this.request<ApiResponse<Project>>('/projects/');
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

  // Tickets
  async getProjectTickets(projectId: number, status?: string): Promise<Ticket[]> {
    const params = status ? `?status=${status}` : '';
    const response = await this.request<ApiResponse<Ticket>>(`/projects/${projectId}/tickets/${params}`);
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

  async assignTicket(id: number, agentId: number): Promise<void> {
    await this.request(`/tickets/${id}/assign/`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    });
  }

  async changeTicketStatus(id: number, status: string): Promise<void> {
    await this.request(`/tickets/${id}/change_status/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  // Comments
  async getTicketComments(ticketId: number): Promise<Comment[]> {
    const response = await this.request<ApiResponse<Comment>>(`/tickets/${ticketId}/comments/`);
    return response.results || [];
  }

  async createComment(comment: Partial<Comment>): Promise<Comment> {
    return this.request<Comment>('/comments/', {
      method: 'POST',
      body: JSON.stringify(comment),
    });
  }

  // Agents
  async getTickets(params?: Record<string, string>): Promise<Ticket[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await this.request<ApiResponse<Ticket>>(`/tickets/${query}`);
    return response.results || [];
  }

  async deleteTicket(id: number): Promise<void> {
    await this.request(`/tickets/${id}/`, { method: 'DELETE' });
  }

  async updateProject(id: number, data: Partial<Project>): Promise<Project> {
    return this.request<Project>(`/projects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: number): Promise<void> {
    await this.request(`/projects/${id}/`, { method: 'DELETE' });
  }

  async getAgents(): Promise<Agent[]> {
    const response = await this.request<ApiResponse<Agent>>('/agents/');
    return response.results || [];
  }

  async getCurrentUser(): Promise<Agent> {
    return this.request<Agent>('/agents/me/');
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);