/**
 * @ Author: BetterInternship
 * @ Create Time: 2025-06-14 23:30:09
 * @ Modified time: 2025-11-15 23:49:19
 * @ Description:
 *
 * Stateful dropdown group component.
 */

import { Button } from "@/components/ui/button";
import { useAppContext } from "@/lib/ctx-app";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import React, {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDetectClickOutside } from "react-detect-click-outside";

/**
 * The group context interface.
 * What's available in the group context to other components.
 */
interface IDropdownGroupContext {
  activeDropdown: string;
  setActiveDropdown: (dropdown: string) => void;
}
const DropdownGroupContext = createContext<IDropdownGroupContext>({} as IDropdownGroupContext);

/**
 * A wrapper around the contents of a dropdown option.
 *
 * @component
 */
type IDropdownOptionProps = {
  children?: React.ReactNode;
  highlighted?: boolean;
  disabled?: boolean;
  href?: string;
  on_click?: () => void;
};
export const DropdownOption = ({ children }: IDropdownOptionProps) => {
  return <>{children}</>;
};

/**
 * Creates a standard button dropdowns must use with mobile optimization.
 * Not meant to be used elsewhere.
 *
 * @component
 */
const DropdownOptionButton = ({
  children,
  set_is_open,
  size = "xs",
}: {
  children: React.ReactElement<IDropdownOptionProps>;
  set_is_open: (is_open: boolean) => void;
  size?: "xs" | "sm" | "md" | "lg";
}) => {
  const router = useRouter();
  const { isMobile: is_mobile } = useAppContext();
  const [scrolling, setScrolling] = useState(false);
  const dropdown_button_ref = useRef<HTMLInputElement>({} as HTMLInputElement);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      set_is_open(false);
      children.props.on_click && children.props.on_click();
      children.props.href && router.push(children.props.href);
    },
    [children.props, router, set_is_open]
  );

  const onTouchStart = (e: any) => {
    e.stopPropagation();
    setScrolling(true);
  };

  const onTouchEnd = (e: any) => {
    e.stopPropagation();
    setScrolling(false);
  };

  useEffect(() => {
    const dropdown_button = dropdown_button_ref.current;
    if (!dropdown_button) return;

    // Attach passive touchstart handler
    dropdown_button.addEventListener("touchstart", onTouchStart, {
      passive: true,
    });

    dropdown_button.addEventListener("touchend", onTouchEnd, {
      passive: true,
    });

    // Cleanup on unmount
    return () => {
      dropdown_button.removeEventListener("touchstart", onTouchStart);
      dropdown_button.removeEventListener("touchend", onTouchEnd);
    };
  }, [onTouchStart]);

  return (
    <button
      // @ts-ignore
      ref={dropdown_button_ref}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2 text-left text-gray-700 transition-colors hover:bg-gray-100",
        is_mobile ? "touch-manipulation py-3 active:bg-gray-200" : "",
        `text-${size}`,
        children.props.highlighted ? "text-blue-500" : ""
      )}
      onClick={(e) => !scrolling && handleClick(e)}
    >
      <div className="w-full">{children}</div>
    </button>
  );
};

/**
 * This component creates a context provider for dropdowns inside it to use.
 * The dropdowns inside can modify the active dropdown when they're clicked.
 * This way, only one dropdown in the group is active at a time.
 *
 * @component
 */
export const DropdownGroup = ({ children }: { children: React.ReactNode }) => {
  const [activeDropdown, setActiveDropdown] = useState("");
  const group_dropdown_context: IDropdownGroupContext = {
    activeDropdown,
    setActiveDropdown,
  };

  return <DropdownGroupContext value={group_dropdown_context}>{children}</DropdownGroupContext>;
};

interface IRadioDropdownOption<ID> {
  id: ID;
  name: string;
}

/**
 * This represents a single dropdown inside the group with mobile optimization.
 * Inherits the provided context (if there is none, that's fine).
 *
 * @component
 */
export const GroupableRadioDropdown = <ID extends number | string>({
  name,
  options,
  onChange,
  disabled,
  defaultValue = null,
  size = "sm",
  className = "",
  fallback = "Select option",
  onBlur,
}: {
  name: string;
  options: IRadioDropdownOption<ID>[];
  onChange: (option: ID) => void;
  defaultValue?: ID | ID[] | null;
  disabled?: boolean | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  fallback?: string;
  onBlur?: () => void;
}) => {
  const { isMobile } = useAppContext();
  const { activeDropdown, setActiveDropdown } = useContext(DropdownGroupContext);
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const ref = useDetectClickOutside({
    onTriggered: () => {
      if (!isOpen) return;
      setIsOpen(false);
      onBlur?.();
    },
  });

  // Just so it's not stuck at the first default when the default changes
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  /**
   * Activates dropdown
   */
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(!isOpen);
      setActiveDropdown?.(name);
    },
    [isOpen, name, setActiveDropdown]
  );

  /**
   * Changes dropdown value
   */
  const handleChange = useCallback(
    (option: ID) => {
      setValue(option);
      onChange(option);
      setIsOpen(false);
    },
    [onChange]
  );

  // Check if it's still the active dropdown
  useEffect(() => {
    if (activeDropdown !== name) setIsOpen(false);
  }, [activeDropdown, name]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        size={size}
        onClick={handleClick}
        onTouchEnd={(e) => e.stopPropagation()}
        className="flex w-full flex-row justify-between"
      >
        {(value || value === 0) && options.filter((o) => o.id === value)[0] ? (
          <span className="overflow-hidden text-ellipsis">
            {options.filter((o) => o.id === value)[0]?.name}
          </span>
        ) : (
          <span className="font-normal text-gray-500">{fallback}</span>
        )}
        <ChevronDown
          className={cn("h-4 w-4 text-gray-600 transition-transform", isOpen ? "rotate-180" : "")}
        />
      </Button>

      {isOpen && (
        <div
          className={cn(
            "absolute overflow-hidden rounded-md border border-gray-100 bg-white shadow-xl",
            "z-[9999] transition-all duration-200 ease-out", // Add smooth animation
            isMobile ? "min-w-full" : "min-w-[200px]",
            className
          )}
        >
          <div
            className={cn(
              "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 relative z-[100] max-h-64 overflow-y-auto overscroll-contain"
            )}
          >
            {options.map((option, index) => (
              <DropdownOptionButton key={index} set_is_open={setIsOpen} size={size}>
                <DropdownOption
                  highlighted={value === option.id}
                  on_click={() => handleChange(option.id)}
                >
                  {option.name}
                </DropdownOption>
              </DropdownOptionButton>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * This creates a dropdown menu for navigating with improved mobile support.
 *
 * @component
 */
export const GroupableNavDropdown = ({
  display,
  content,
  children,
  className = "",
  showArrow = true,
}: {
  display?: React.ReactNode;
  content?: React.ReactNode;
  children?: React.ReactElement<IDropdownOptionProps> | React.ReactElement<IDropdownOptionProps>[];
  className?: string;
  showArrow?: boolean;
}) => {
  const { isMobile: is_mobile } = useAppContext();
  const [is_open, set_is_open] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{
    x: number;
    y: number;
    target: EventTarget | null;
  } | null>(null);

  // Close dropdown handler
  const closeDropdown = useCallback(() => {
    set_is_open(false);
  }, []);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !is_mobile &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    if (is_open && !is_mobile) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [is_open, is_mobile, closeDropdown]);

  // Mobile touch handlers
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!is_mobile || !is_open) return;

      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        target: e.target,
      };
    },
    [is_mobile, is_open]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!is_mobile || !is_open || !touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const startTouch = touchStartRef.current;

      // Calculate touch movement
      const deltaX = Math.abs(touch.clientX - startTouch.x);
      const deltaY = Math.abs(touch.clientY - startTouch.y);
      const isSwipe = deltaX > 10 || deltaY > 10;

      // Check if touch is outside dropdown area
      const target = e.target as Element;
      const isOutsideDropdown =
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target);

      // Close if touch ended outside and wasn't a swipe
      if (!isSwipe && isOutsideDropdown) {
        closeDropdown();
      }

      touchStartRef.current = null;
    },
    [is_mobile, is_open, closeDropdown]
  );

  // Set up mobile touch listeners
  useEffect(() => {
    if (is_mobile && is_open) {
      document.addEventListener("touchstart", handleTouchStart);
      document.addEventListener("touchend", handleTouchEnd);

      return () => {
        document.removeEventListener("touchstart", handleTouchStart);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [is_mobile, is_open, handleTouchStart, handleTouchEnd]);

  // Prevent event propagation for dropdown content
  const handleDropdownInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  // Toggle dropdown
  const handleButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      set_is_open(!is_open);
    },
    [is_open]
  );

  return (
    <div className={cn("relative z-[100]", className)} ref={dropdownRef}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        className="relative z-[1000] flex h-12 items-center gap-2 px-3"
        onClick={handleButtonClick}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {display}
        {showArrow && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-600 transition-transform",
              is_open ? "rotate-180" : ""
            )}
          />
        )}
      </Button>

      {is_open && (
        <div
          className={cn(
            "absolute right-0 z-[1000] mt-2 rounded-[0.33em] border border-gray-200 bg-white shadow-lg",
            is_mobile ? "w-56" : "w-48", // Slightly wider on mobile for better touch targets
            className
          )}
          onClick={handleDropdownInteraction}
          onTouchStart={handleDropdownInteraction}
          onTouchEnd={handleDropdownInteraction}
        >
          <div
            className={cn(
              "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 relative z-[1000] max-h-64 overflow-y-auto overscroll-contain py-1",
              is_mobile ? "max-h-80" : "max-h-64"
            )}
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "#9ca3af #f3f4f6",
            }}
          >
            {content}

            {Children.map(children, (child, index) => {
              return (
                <DropdownOptionButton key={index} set_is_open={set_is_open}>
                  {child ? child : <></>}
                </DropdownOptionButton>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
