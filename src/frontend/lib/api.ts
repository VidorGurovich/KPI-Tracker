/**
 * API Client for KPI Tracker
 * Handles all communication with the backend API
 */

interface ApiResponse<T = any> {
  message: string;
  timestamp: string;
  [key: string]: any;
  data?: T;
}

class ApiError extends Error {
  public error: string;
  public details?: any[];
  public timestamp: string;

  constructor(data: { error: string; message: string; details?: any[]; timestamp: string }) {
    super(data.message);
    this.error = data.error;
    this.details = data.details;
    this.timestamp = data.timestamp;
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.loadToken();
  }

  private loadToken(): void {
    this.token = localStorage.getItem('auth_token');
  }

  private saveToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  private clearToken(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(data);
      }

      return data as T;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Network error - please check your connection');
      }
      throw error;
    }
  }

  // Authentication methods
  async login(email: string, password: string): Promise<ApiResponse & {
    token: string;
    user: {
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      emailVerified: boolean;
    };
    expiresIn: string;
  }> {
    const response = await this.request<ApiResponse & { token: string; user: any; expiresIn: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      this.saveToken(response.token);
    }

    return response;
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  }): Promise<ApiResponse> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  async verifyEmail(token: string): Promise<ApiResponse> {
    return this.request('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse> {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse> {
    const response = await this.request<ApiResponse>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.token) {
      this.saveToken(response.token);
    }

    return response;
  }

  // User methods
  async getUserProfile(): Promise<ApiResponse> {
    return this.request('/api/users/profile');
  }

  async updateUserProfile(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    preferences?: any;
  }): Promise<ApiResponse> {
    return this.request('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<ApiResponse> {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return this.request(`/api/users${queryString}`);
  }

  async getUserById(id: number): Promise<ApiResponse> {
    return this.request(`/api/users/${id}`);
  }

  async getUserStats(): Promise<ApiResponse> {
    return this.request('/api/users/stats');
  }

  // Team methods
  async getTeamMembers(managerId: number): Promise<ApiResponse> {
    return this.request(`/api/teams/members/${managerId}`);
  }

  async getMyTeamMembers(): Promise<ApiResponse> {
    return this.request('/api/teams/my-members');
  }

  async getUnassignedEmployees(): Promise<ApiResponse> {
    return this.request('/api/teams/unassigned');
  }

  // KPI methods
  async getKPIDefinitions(params?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse> {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return this.request(`/api/kpis/definitions${queryString}`);
  }

  async createKPIDefinition(data: {
    name: string;
    description?: string;
    unit: string;
    targetType: string;
    calculationType: string;
  }): Promise<ApiResponse> {
    return this.request('/api/kpis/definitions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateKPIDefinition(id: number, data: {
    name?: string;
    description?: string;
    unit?: string;
    targetType?: string;
    calculationType?: string;
  }): Promise<ApiResponse> {
    return this.request(`/api/kpis/definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteKPIDefinition(id: number): Promise<ApiResponse> {
    return this.request(`/api/kpis/definitions/${id}`, {
      method: 'DELETE',
    });
  }

  async getKPIInstances(params?: {
    userId?: number;
    teamId?: number;
    definitionId?: number;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse> {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return this.request(`/api/kpis/instances${queryString}`);
  }

  async createKPIInstance(data: {
    definitionId: number;
    assigneeId: number;
    targetValue: number;
    period: string;
    startDate: string;
    endDate: string;
  }): Promise<ApiResponse> {
    return this.request('/api/kpis/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateKPIInstance(id: number, data: {
    targetValue?: number;
    period?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<ApiResponse> {
    return this.request(`/api/kpis/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async recordKPIProgress(instanceId: number, data: {
    value: number;
    notes?: string;
    recordedAt?: string;
  }): Promise<ApiResponse> {
    return this.request(`/api/kpis/instances/${instanceId}/progress`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getKPIProgress(instanceId: number): Promise<ApiResponse> {
    return this.request(`/api/kpis/instances/${instanceId}/progress`);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.request('/api/health');
  }

  // Utility methods
  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;

// Export types for use in components
export type { ApiResponse, ApiError };
