import "./palette-select.css";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Radix items cannot use an empty string as their value, so "" maps to a sentinel.
const EMPTY_VALUE = "__palette-select-empty__";

export type PaletteSelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type PaletteSelectProps = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: PaletteSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * Palette-styled dropdown used in place of native <select>. The popup is
 * portalled above the game dialog layer so it stays clickable inside dialogs.
 */
export function PaletteSelect({
  id,
  value,
  onValueChange,
  options,
  disabled,
  placeholder,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: PaletteSelectProps) {
  return (
    <Select
      value={value === "" ? EMPTY_VALUE : value}
      onValueChange={(next) => onValueChange(next === EMPTY_VALUE ? "" : next)}
      disabled={disabled ?? false}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn("palette-select-trigger", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper" className="palette-select-content" style={{ zIndex: 150 }}>
        {options.map((option) => (
          <SelectItem
            key={option.value === "" ? EMPTY_VALUE : option.value}
            value={option.value === "" ? EMPTY_VALUE : option.value}
            disabled={option.disabled ?? false}
            className="palette-select-item"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
