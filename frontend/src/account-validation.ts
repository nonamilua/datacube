export const USERNAME_LIMITS = {min:3, registration:16, login:32, display:12} as const;
export const PASSWORD_LIMITS = {min:8, max:128} as const;

export function usernameError(value:string, registering:boolean):string {
  const max = registering ? USERNAME_LIMITS.registration : USERNAME_LIMITS.login;
  if (value.length < USERNAME_LIMITS.min || value.length > max) return registering ? 'username must contain 3 to 16 characters' : 'username must contain 3 to 32 characters';
  return /^[a-zA-Z0-9_]+$/.test(value) ? '' : 'use only letters numbers and underscores';
}

export function passwordError(value:string):string {
  return value.length < PASSWORD_LIMITS.min || value.length > PASSWORD_LIMITS.max ? 'password must contain 8 to 128 characters' : '';
}

export function displayUsername(value:string):string {
  return value.length > USERNAME_LIMITS.display ? `${value.slice(0,USERNAME_LIMITS.display)}…` : value;
}
