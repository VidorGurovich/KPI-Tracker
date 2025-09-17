/**
 * Shared test utility functions for contract tests
 */

export async function makeRequest(url: string, options: any) {
  const response = await fetch(`http://localhost:3001${url}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return {
    status: response.status,
    body
  };
}

export async function getAuthToken(_email: string): Promise<string> {
  // Mock implementation for testing
  return Promise.resolve('mock-auth-token');
}

export async function verifyUserEmail(_email: string) {
  // Mock implementation for testing
  return Promise.resolve();
}

export async function getVerificationToken(_email: string): Promise<string> {
  // Mock implementation for testing
  return Promise.resolve('mock-verification-token');
}

export function getInstanceIdForTargetType(_targetType: string): number {
  // Mock implementation for testing
  return 1;
}
