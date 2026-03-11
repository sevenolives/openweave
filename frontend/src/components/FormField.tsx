'use client';

import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}

export default function FormField({ label, error, children, required }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

// Utility: parse ApiError fieldErrors into a Record<string, string>
export function parseFieldErrors(error: unknown): Record<string, string> {
  if (error && typeof error === 'object' && 'fieldErrors' in error) {
    const fe = (error as { fieldErrors: Record<string, string[]> }).fieldErrors;
    const result: Record<string, string> = {};
    for (const [key, msgs] of Object.entries(fe)) {
      result[key] = msgs.join(', ');
    }
    return result;
  }
  return {};
}

// Input class helper — returns Tailwind classes for inputs with optional error state
export function inputClass(error?: string): string {
  const base = 'w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:border-transparent transition-colors';
  if (error) {
    return `${base} border-red-500 focus:ring-red-500 bg-red-50`;
  }
  return `${base} border-gray-300 focus:ring-indigo-500`;
}

// Select class helper — returns Tailwind classes for selects with optional error state
export function selectClass(error?: string): string {
  const base = 'w-full px-4 py-3 h-[44px] border rounded-xl text-sm focus:ring-2 focus:border-transparent transition-colors bg-white appearance-none cursor-pointer';
  if (error) {
    return `${base} border-red-500 focus:ring-red-500 bg-red-50`;
  }
  return `${base} border-gray-300 focus:ring-indigo-500`;
}
