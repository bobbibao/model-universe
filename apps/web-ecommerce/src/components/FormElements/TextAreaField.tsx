import { useId, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { inputClassName } from './TextField';

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export default function TextAreaField({ label, hint, error, id, className = '', ...props }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id || `${props.name || 'field'}-${generatedId}`;
  const hintId = `${fieldId}-hint`,
    errorId = `${fieldId}-error`;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-2 block text-sm font-medium text-black dark:text-white">
        {label}
        {props.required && (
          <span aria-hidden="true" className="form-required">
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        id={fieldId}
        rows={3}
        className={`${inputClassName} ${error ? 'border-danger' : ''}`}
        {...props}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={
          [props['aria-describedby'], hint ? hintId : undefined, error ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      {hint && (
        <p id={hintId} className="form-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
