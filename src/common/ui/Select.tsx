import React from "react";
import SelectComponent from "react-select";
import CreatableSelect from "react-select/creatable";
import type {
  ActionMeta,
  Props as ReactSelectProps,
  SingleValue,
  StylesConfig,
} from "react-select";

export type SelectOption = {
  value: string;
  label: string;
  isDisabled?: boolean;
};

type BaseProps = {
  value: string | null;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  isClearable?: boolean;
  onChange: (value: string | null, action: ActionMeta<SelectOption>) => void;
  onBlur?: () => void;
  className?: string;
  formatCreateLabel?: (input: string) => string;
};

type CreatableProps = {
  isCreatable: true;
  onCreateOption: (value: string) => void;
};

type NonCreatableProps = {
  isCreatable?: false;
  onCreateOption?: never;
};

export type SelectProps = BaseProps & (CreatableProps | NonCreatableProps);

// Matches the app's fields (.g-input) and menus (.g-menu) in glider-ui.css.
const accent = "var(--color-logo-primary)";

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "var(--g-field-h)",
    borderRadius: "var(--g-r-ctl)",
    borderColor: state.isFocused ? accent : "var(--g-ctl-edge)",
    boxShadow: state.isFocused
      ? "0 0 0 3px color-mix(in srgb, var(--color-logo-primary) 30%, transparent)"
      : "none",
    backgroundColor: "var(--color-wash)",
    fontSize: 13,
    color: "var(--color-text)",
    transition: "border-color 150ms, box-shadow 150ms",
    ":hover": {
      borderColor: state.isFocused ? accent : "var(--color-line-strong)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    paddingInline: 10,
    paddingBlock: 0,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  input: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),
  dropdownIndicator: (base) => ({
    ...base,
    padding: "0 8px",
    color: "var(--color-ink-3)",
    ":hover": { color: "var(--color-text)" },
  }),
  clearIndicator: (base) => ({
    ...base,
    padding: "0 4px",
    color: "var(--color-ink-3)",
    ":hover": { color: "var(--color-text)" },
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 30,
    padding: 4,
    borderRadius: "var(--g-r-card)",
    backgroundColor: "var(--g-menu)",
    color: "var(--color-text)",
    border: "1px solid var(--color-line-strong)",
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.4)",
  }),
  menuList: (base) => ({ ...base, padding: 0 }),
  option: (base, state) => ({
    ...base,
    borderRadius: "var(--g-r-ctl)",
    fontSize: 13,
    backgroundColor: state.isSelected
      ? accent
      : state.isFocused
        ? "var(--color-wash)"
        : "transparent",
    color: state.isSelected ? "var(--color-on-accent)" : "var(--color-text)",
    cursor: state.isDisabled ? "not-allowed" : base.cursor,
    opacity: state.isDisabled ? 0.5 : 1,
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--color-ink-3)",
  }),
};

export const Select: React.FC<SelectProps> = React.memo(
  ({
    value,
    options,
    placeholder,
    disabled,
    isLoading,
    isClearable = true,
    onChange,
    onBlur,
    className = "",
    isCreatable,
    formatCreateLabel,
    onCreateOption,
  }) => {
    const selectValue = React.useMemo(() => {
      if (!value) return null;
      const existing = options.find((option) => option.value === value);
      if (existing) return existing;
      return { value, label: value, isDisabled: false };
    }, [value, options]);

    const handleChange = (
      option: SingleValue<SelectOption>,
      action: ActionMeta<SelectOption>,
    ) => {
      onChange(option?.value ?? null, action);
    };

    const sharedProps: Partial<ReactSelectProps<SelectOption, false>> = {
      className,
      classNamePrefix: "app-select",
      value: selectValue,
      options,
      onChange: handleChange,
      placeholder,
      isDisabled: disabled,
      isLoading,
      onBlur,
      isClearable,
      styles: selectStyles,
    };

    if (isCreatable) {
      return (
        <CreatableSelect<SelectOption, false>
          {...sharedProps}
          onCreateOption={onCreateOption}
          formatCreateLabel={formatCreateLabel}
        />
      );
    }

    return <SelectComponent<SelectOption, false> {...sharedProps} />;
  },
);

Select.displayName = "Select";
