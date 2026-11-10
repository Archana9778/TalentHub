export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 - 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  bgBar: string;
  requirements: PasswordRequirement[];
  isValid: boolean;
}

export const evaluatePasswordStrength = (password: string): PasswordStrengthResult => {
  const requirements: PasswordRequirement[] = [
    {
      id: 'length',
      label: 'Minimum 12 characters',
      met: password.length >= 12,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'At least one number (0-9)',
      met: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$% etc.)',
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const isValid = metCount === requirements.length;

  let score = 0;
  if (metCount >= 2) score = 1;
  if (metCount >= 3 && password.length >= 8) score = 2;
  if (metCount >= 4 && password.length >= 12) score = 3;
  if (isValid && password.length >= 12) score = 4;

  let label: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
  let color = 'text-rose-600';
  let bgBar = 'bg-rose-500';

  if (score === 2) {
    label = 'Fair';
    color = 'text-amber-600';
    bgBar = 'bg-amber-500';
  } else if (score === 3) {
    label = 'Good';
    color = 'text-blue-600';
    bgBar = 'bg-blue-500';
  } else if (score === 4) {
    label = 'Strong';
    color = 'text-emerald-600';
    bgBar = 'bg-emerald-500';
  }

  return {
    score,
    label,
    color,
    bgBar,
    requirements,
    isValid,
  };
};

