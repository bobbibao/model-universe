import React, { useId } from 'react';
import { inputClassName } from './TextField';

interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
  hint?: React.ReactNode;
}

const SelectField = ({
  label,
  options,
  placeholder,
  error,
  hint,
  id,
  className = '',
  ...selectProps
}: SelectFieldProps) => {
  const generatedId = useId();
  const selectId = id || `${selectProps.name || 'field'}-${generatedId}`;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  return (
    <div className={className}>
      <label htmlFor={selectId} className="mb-2 block text-sm font-medium text-black dark:text-white">
        {label}
        {selectProps.required && (
          <span aria-hidden="true" className="form-required">
            {' '}
            *
          </span>
        )}
      </label>
      <select
        id={selectId}
        className={`${inputClassName} ${error ? 'border-danger' : ''}`}
        {...selectProps}
        aria-invalid={error ? true : selectProps['aria-invalid']}
        aria-describedby={
          [selectProps['aria-describedby'], hint ? hintId : undefined, error ? errorId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
};

export default SelectField;
