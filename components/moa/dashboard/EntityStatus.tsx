"use client";

import { useMemo } from "react";
import CustomCard from "@/components/shared/CustomCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyEntityForSchool, useEntityReconsider, DEFAULT_SCHOOL_ID } from "@/app/api/entity.api";
import { formatWhen } from "@/lib/format";
import { Clock, ShieldCheck, XCircle } from "lucide-react";

export type EntityApprovalStatus = "approved" | "pending" | "not-approved";

type Props = {
  status?: EntityApprovalStatus | string | null;
  entityName?: string;
  requestedAt?: string;
  approvedAt?: string;
  expiryAt?: string | Date | null;
  loading?: boolean;
  compact?: boolean;
  className?: string;
  action?: React.ReactNode;
};

const toneByStatus: Record<string, string> = {
  approved: "bg-supportive/5 border-supportive",
  pending: "bg-warning/5 border-warning",
  "not-approved": "bg-destructive/5 border-destructive",
};

const titleByStatus: Record<string, string> = {
  approved: "Approved with the University",
  pending: "Pending University Approval",
  "not-approved": "Not Approved",
};

const blurbByStatus: Record<string, string> = {
  approved: "This entity is cleared for partnerships.",
  pending: "Awaiting university review.",
  "not-approved": "Not cleared for partnerships at this time.",
};

function asDate(d?: string | Date | null): Date | null {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function daysUntil(date?: string | Date | null): number | null {
  const dt = asDate(date);
  if (!dt) return null;
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/* -------------------------- Presentational card -------------------------- */
export default function EntityStatus({
  status: rawStatus,
  entityName,
  requestedAt,
  approvedAt,
  expiryAt,
  loading,
  compact,
  className,
  action,
}: Props) {
  const status = (rawStatus || "").toString().toLowerCase();
  const tone = toneByStatus[status] ?? "bg-white border-border";
  const title = titleByStatus[status] ?? "Status";
  const blurb = blurbByStatus[status] ?? "";

  const expiryDays = useMemo(() => daysUntil(expiryAt), [expiryAt]);
  const isExpiringSoon = typeof expiryDays === "number" && expiryDays <= 60 && expiryDays >= 0;

  if (loading && !status) {
    return (
      <div className="text-muted-foreground rounded-md border border-dashed p-6">
        Loading account status...
      </div>
    );
  }

  return (
    <CustomCard className={`border ${tone} "p-4" ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-4">
        {/* Left */}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Current Account Status</Badge>
          </div>

          <div className="text-foreground mt-1 text-base font-semibold tracking-tight">{title}</div>

          {!compact && <p className="text-muted-foreground text-sm">{blurb}</p>}

          {/* Meta rows */}
          <div className="text-muted-foreground mt-1 space-y-1 text-xs">
            {status === "approved" && (
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Effective {approvedAt ? <b>{formatWhen(approvedAt)}</b> : <i>—</i>} </span>
              </div>
            )}

            {status === "pending" && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Requested {requestedAt ? <b>{formatWhen(requestedAt)}</b> : <i>—</i>}</span>
              </div>
            )}

            {status === "not-approved" && (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4" aria-hidden="true" />
                <span>Contact your MOA office for next steps.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomCard>
  );
}

/* ------------------------ Smart wrapper (self) ------------------------ */

function toEntityApprovalStatus(
  outcome?: string | null,
  hasAnyRecord = false
): EntityApprovalStatus {
  const s = (outcome ?? "").toLowerCase();
  if (!s && !hasAnyRecord) return "not-approved";
  if (s === "approved" || s === "active" || s === "valid") return "approved";
  if (s === "denied" || s === "rejected" || s === "not-approved") return "not-approved";
  return "pending";
}

type RequestRow = {
  id: string;
  entity_id: string;
  school_id: string;
  timestamp?: string;
  processed_date?: string | null;
  outcome?: string | null;
};

/** Fetches status and renders the card + in-card reconsider action */
export function EntityStatusSelf({ schoolId }: { schoolId?: string }) {
  const sid = schoolId ?? DEFAULT_SCHOOL_ID;

  const {
    entity, 
    latestRequest, 
    latestOutcome, 
    relationStatus,
    isLoading,
    refetch,
  } = useMyEntityForSchool(sid) as any;

  const { reconsider, isPending } = useEntityReconsider();

  const hasAnyRecord = Array.isArray(entity) ? entity.length > 0 : Boolean(entity);

  const entityName =
    (entity as any)?.legal_identifier ??
    (entity as any)?.display_name ??
    (latestRequest as RequestRow | null)?.entity_id ??
    "-";

  // Prefer the normalized bucket from the hook; fall back to local mapping
  const status: EntityApprovalStatus =
    relationStatus ?? toEntityApprovalStatus(latestOutcome, hasAnyRecord);

  async function handleReconsider() {
    await reconsider({ schoolId: sid });
    await refetch?.();
  }

  if (status === "approved") return null;

  return (
    <EntityStatus
      entityName={entityName}
      status={status}
      requestedAt={latestRequest?.timestamp}
      approvedAt={latestRequest?.processed_date ?? undefined}
      loading={isLoading}
      action={
        status === "not-approved" ? (
          <Button onClick={handleReconsider} disabled={isPending} className="w-full sm:w-auto">
            {isPending ? "Requesting..." : "Request reconsideration"}
          </Button>
        ) : null
      }
    />
  );
}
