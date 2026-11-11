import React from 'react';
import { Check, X } from 'lucide-react';
import { evaluatePasswordStrength } from '../utils/passwordStrength';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  showRequirements = true,
}) => {
  const result = evaluatePasswordStrength(password);

  if (!password && !showRequirements) return null;

  return (
    <div className="space-y-2.5 mt-2" aria-live="polite">
      {/* Strength Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500 font-medium">Password strength:</span>
          <span className={`font-bold ${result.color}`}>{result.label}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 h-1.5">
          {[1, 2, 3, 4].map((step) => {
            const filled = step <= result.score;
            return (
              <div
                key={step}
                className={`rounded-full transition-all duration-300 ${
                  filled ? result.bgBar : 'bg-slate-200'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Requirement Checklist */}
      {showRequirements && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1">
          <div className="font-semibold text-slate-700 mb-1">Password Requirements:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {result.requirements.map((req) => (
              <div key={req.id} className="flex items-center gap-1.5">
                {req.met ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                ) : (
                  <X className="w-3.5 h-3.5 text-slate-400 shrink-0 stroke-[2.5]" />
                )}
                <span className={req.met ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

