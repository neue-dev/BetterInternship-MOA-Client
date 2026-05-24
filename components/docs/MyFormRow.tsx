"use client";

import React from "react";
import { Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";

export type FormItem = {
  name: string;
  label: string;
  enabledAutosign: boolean;
  party: string;
  date: string;
};

export default function MyFormRow({
  row,
  onOpenAutoSignForm,
  toggleAutoSign,
  loading,
  index,
}: {
  row: FormItem;
  onOpenAutoSignForm: () => void;
  toggleAutoSign: () => void;
  loading?: boolean;
  index?: number;
}) {
  const isMobile = useIsMobile();

  return (
    <div
      role="row"
      aria-rowindex={index ? index + 2 : undefined}
      className="group rounded-0 grid grid-cols-12 items-center gap-3 p-3"
      tabIndex={0}
    >
      {/* Name */}
      <div role="cell" className="col-span-6 min-w-0 items-center">
        <div className="text-md truncate font-medium">{row.label}</div>
        {row.date && row.enabledAutosign && (
          <p className="text-xs text-gray-500">
            <span className="font-medium">Auto-sign enabled:</span>{" "}
            {new Date(row.date).toLocaleDateString()}{" "}
            {new Date(row.date).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <div role="cell" className="col-span-2"></div>

      {/* Form values */}
      <div role="cell" className="col-span-2 flex items-center justify-center">
        {isMobile ? (
          <Button variant="outline" onClick={onOpenAutoSignForm}>
            <Edit />
          </Button>
        ) : (
          <Button variant="outline" onClick={onOpenAutoSignForm}>
            Edit <Edit />
          </Button>
        )}
      </div>

      {/* Auto-sign toggle */}
      <div role="cell" className="col-span-2">
        <div className="flex items-center justify-center transition-all">
          <Switch
            checked={row.enabledAutosign}
            onCheckedChange={toggleAutoSign}
            disabled={!!loading}
            className="cursor-pointer transition-all hover:opacity-80 hover:shadow-md disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}
