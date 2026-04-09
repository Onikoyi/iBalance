export type AuthSession = {
    userEmail: string;
    issuedAtUtc: string;
  };
  
  const authKey = 'ibalance.auth.session';
  
  export function getSession(): AuthSession | null {
    const raw = localStorage.getItem(authKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }
  
  export function isAuthenticated(): boolean {
    return getSession() !== null;
  }
  
  export function loginDemo(email: string): AuthSession {
    const session: AuthSession = {
      userEmail: email.trim().toLowerCase(),
      issuedAtUtc: new Date().toISOString(),
    };
    localStorage.setItem(authKey, JSON.stringify(session));
    return session;
  }
  
  export function logout(): void {
    localStorage.removeItem(authKey);
  }