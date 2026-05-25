"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getPartyColorByIndex } from "@/lib/party-colors";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { IFormSigningParty } from "@betterinternship/core/forms";

const ARROW_PX = 10;
const SCROLL_STEP = 120;

type RecipientTabBarProps = {
  parties: IFormSigningParty[];
  selectedPartyId: string | null;
  onSelectParty: (id: string) => void;
};

export function RecipientTabBar({ parties, selectedPartyId, onSelectParty }: RecipientTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    syncScrollState();
    el.addEventListener("scroll", syncScrollState, { passive: true });
    const ro = new ResizeObserver(syncScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncScrollState);
      ro.disconnect();
    };
  }, [parties]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -SCROLL_STEP : SCROLL_STEP,
      behavior: "smooth",
    });
  };

  if (!parties.length) return null;

  return (
    <div className="relative flex h-9 flex-shrink-0 items-stretch overflow-hidden border-b border-slate-200 bg-white">
      {canScrollLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-12 bg-gradient-to-r from-white to-transparent" />
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 z-30 flex h-full w-7 items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className="flex flex-1 items-stretch overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {parties.map((party, index) => {
          const isActive = party._id === selectedPartyId;
          const color = getPartyColorByIndex(index);
          const isFirst = index === 0;

          const clipPath = isFirst
            ? `polygon(0 0, calc(100% - ${ARROW_PX}px) 0, 100% 50%, calc(100% - ${ARROW_PX}px) 100%, 0 100%)`
            : `polygon(0 0, calc(100% - ${ARROW_PX}px) 0, 100% 50%, calc(100% - ${ARROW_PX}px) 100%, 0 100%, ${ARROW_PX}px 50%)`;

          return (
            <div
              key={party._id}
              className="relative flex-shrink-0"
              style={{
                marginLeft: isFirst ? 0 : -ARROW_PX,
                zIndex: isActive ? parties.length + 1 : parties.length - index,
              }}
            >
              {/* Darker copy shifted right — peeks out at the arrow edge to create a visible border */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  transform: "translateX(2px)",
                  backgroundColor: isActive ? color.hex : "#cbd5e1",
                  clipPath,
                }}
              />
              <button
                type="button"
                onClick={() => onSelectParty(party._id)}
                title={party.signatory_title}
                className={cn(
                  "relative flex h-full cursor-pointer items-center text-xs font-semibold transition-colors",
                  isActive
                    ? "text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                )}
                style={{
                  paddingLeft: isFirst ? 14 : 14 + ARROW_PX,
                  paddingRight: 14 + ARROW_PX,
                  clipPath,
                  ...(isActive ? { backgroundColor: color.hex } : {}),
                }}
              >
                <span className="max-w-[140px] truncate">{party.signatory_title}</span>
              </button>
            </div>
          );
        })}
      </div>

      {canScrollRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-12 bg-gradient-to-l from-white to-transparent" />
          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 z-30 flex h-full w-7 items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
