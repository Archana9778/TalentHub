const COMMON_PASSWORDS = new Set([
  'password123456',
  'password1234!',
  'password123!',
  'admin12345678!',
  'administrator!',
  'talenthub123!',
  'welcome12345!',
  '123456789012',
  '1234567890123',
  'qwertyuiop12',
  'letmein12345!',
  'changeme1234!',
  'iloveyou12345',
  'monkey123456!',
  'dragon123456!',
  'master123456!',
  'sunshine1234!',
  'princess1234!',
  'football1234!',
  'trustno11234!',
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  score: number; // 0 to 4
}

export const validatePasswordPolicy = (password: string, userContext?: { email?: string; name?: string }): PasswordValidationResult => {
  const errors: string[] = [];

  if (typeof password !== 'string') {
    return { valid: false, errors: ['Password must be a valid string.'], score: 0 };
  }

  // 1. Length check: Minimum 12 characters, max 128 characters
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters in length.');
  } else if (password.length > 128) {
    errors.push('Password cannot exceed 128 characters.');
  }

  // 2. Character diversity
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password);

  if (!hasUpper) errors.push('Password must contain at least one uppercase letter (A-Z).');
  if (!hasLower) errors.push('Password must contain at least one lowercase letter (a-z).');
  if (!hasNumber) errors.push('Password must contain at least one number (0-9).');
  if (!hasSpecial) errors.push('Password must contain at least one special character (!@#$%^&* etc.).');

  // 3. Common or compromised password check
  const lowerPass = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPass)) {
    errors.push('This password is too common or easily guessed. Please choose a unique passphrase.');
  }

  // 4. User context check (avoid using name or email handle inside password)
  if (userContext) {
    if (userContext.email) {
      const emailHandle = userContext.email.split('@')[0].toLowerCase();
      if (emailHandle.length >= 4 && lowerPass.includes(emailHandle)) {
        errors.push('Password cannot contain your email username.');
      }
    }
    if (userContext.name) {
      const nameParts = userContext.name.toLowerCase().split(/\s+/);
      for (const part of nameParts) {
        if (part.length >= 4 && lowerPass.includes(part)) {
          errors.push('Password cannot contain parts of your name.');
          break;
        }
      }
    }
  }

  // Calculate strength score (0 to 4)
  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (hasUpper && hasLower && hasNumber) score += 1;
  if (hasSpecial && errors.length === 0) score += 1;

  return {
    valid: errors.length === 0,
    errors,
    score: Math.min(4, score),
  };
};

