import React from "react";
import { CheckIcon } from "lucide-react";
import { Badge } from "./badge";

export const Timeline = ({ children }: { children: React.ReactNode }) => {
  return <div className="space-y-1">{children}</div>;
};

interface TimelineItemProps {
  number: number;
  title: string | React.ReactNode;
  subtitle?: React.ReactNode;
  isLast?: boolean;
  children?: React.ReactNode;
  isMe?: boolean;
}

export const TimelineItem = ({
  number,
  title,
  subtitle,
  isLast = false,
  children,
  isMe = false,
}: TimelineItemProps) => {
  const isCheckmark = number === -1;

  return (
    <div className="flex-start flex gap-2.5">
      <div className="flex flex-col items-center">
        {isCheckmark ? (
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 font-semibold text-white">
            <CheckIcon className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
              isMe ? "bg-primary" : "bg-gray-400"
            }`}
          >
            {number}
          </div>
        )}
        {!isLast && <div className="mt-0.5 h-6 w-0.5 bg-gray-200" />}
      </div>

      <div className="flex flex-1 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex min-h-5 min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 text-sm leading-5 break-words text-gray-700 sm:text-base">
              {title}
            </div>
            {isMe && (
              <Badge
                type="primary"
                className="bg-primary text-primary-foreground border-transparent"
              >
                You
              </Badge>
            )}
          </div>
          {subtitle && (
            <div className="mb-1.5 text-[11px] text-gray-500 sm:text-xs">{subtitle}</div>
          )}
        </div>
        {children && <div className="flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
};
