import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface DropdownOption {
  value: string;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  className?: string;
  menuClassName?: string;
  selectedValue: string | null;
  onSelect: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onOpen?: () => void;
  /** Where the menu opens: below the button (default), or above it. */
  placement?: "below" | "above";
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  className = "",
  menuClassName,
  placeholder = "Select an option...",
  disabled = false,
  onOpen,
  placement = "below",
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  );

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  // Opens upward when the page (or window) has no room for the menu below.
  const [above, setAbove] = useState(placement === "above");
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      onOpen?.();
      const trigger = triggerRef.current?.getBoundingClientRect();
      const box = triggerRef.current
        ?.closest(".overflow-y-auto")
        ?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
      if (trigger) {
        const roomBelow = box.bottom - trigger.bottom;
        const roomAbove = trigger.top - box.top;
        setAbove(
          placement === "above"
            ? roomAbove > 120 || roomAbove > roomBelow
            : roomBelow < 260 && roomAbove > roomBelow,
        );
      }
    }
    setIsOpen(!isOpen);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !isOpen || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      className={`relative ${className}`}
      ref={dropdownRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        ref={triggerRef}
        className={`g-sel w-full text-start transition-[border-color,background-color] duration-150 ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label || placeholder}</span>
        <span className="g-selchev" aria-hidden="true">
          <i className="g-ic g-i-updown g-mac-only" />
          <i
            className={`g-ic g-i-chev g-pc-only transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {isOpen && !disabled && (
        <div
          role="listbox"
          className={`g-menu absolute ${above ? "bottom-full mb-1" : "top-full mt-1"} ${
            menuClassName ?? "end-0"
          }`}
        >
          {options.length === 0 ? (
            <div className="px-2 py-1.5 text-[13px] text-ink-3">
              {t("common.noOptionsFound")}
            </div>
          ) : (
            options.map((option) => {
              const isChosen = selectedValue === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isChosen}
                  className={`g-mopt ${isChosen ? "on" : ""} ${
                    option.disabled ? "cursor-not-allowed opacity-50" : ""
                  }`}
                  onClick={() => handleSelect(option.value)}
                  disabled={option.disabled}
                >
                  <i className="g-ic g-i-check g-mcheck" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{option.label}</span>
                    {option.description && (
                      <span className="g-mdesc2 whitespace-normal">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
