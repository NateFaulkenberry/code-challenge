import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  ...rest
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  hint?: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange">) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        className={styles.control}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export { styles as fieldStyles };
