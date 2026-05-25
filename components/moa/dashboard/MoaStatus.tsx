"use client";
import { useState } from "react";
import StatusBadge from "../../shared/StatusBadge";
import type { MoaStatus } from "@/types/moa";
import { MoaRequest } from "@/types/db";
import { formatWhen } from "@/lib/format";
import {
  useDocsControllerGetMoaSignedDocument,
  useEntityMoaControllerGetOneThreadLatestDocument,
} from "@/app/api";
import { Button } from "@/components/ui/button";
import CustomCard from "@/components/shared/CustomCard";
import { useRouter } from "next/navigation";
import { SidebarOpen, Copy, Check, Download } from "lucide-react";

type Props = {
  requests: MoaRequest[];
  loading?: boolean;
  title?: string;
};

const statusUpdates: Record<string, string> = {
  pending: "Your MOA is currently under review.",
  approved: "Your MOA is currently active.",
  denied: "Your MOA request has been denied. Click to review their feedback.",
  "waiting-for-school": "Waiting for university feedback.",
  "waiting-for-entity": "The university has provided feedback on your request. Review it now.",
};

const toneByOutcome: Record<string, string> = {
  approved: "bg-supportive/5 border-supportive",
  denied: "bg-destructive/5 border-destructive",
  pending: "bg-warning/5 border-warning",
  "waiting-for-school": "bg-primary/5 border-primary",
  "waiting-for-entity": "bg-primary/5 border-primary",
};

export default function MoaStatus({ requests, loading }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const moa = (requests ?? []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];

  const signedDocument = useDocsControllerGetMoaSignedDocument(moa?.id ?? "", {
    query: { staleTime: 1000 },
  });

  const latestDocument = useEntityMoaControllerGetOneThreadLatestDocument(moa?.thread_id, {
    query: { enabled: !!moa?.thread_id },
  });

  if (!loading && !moa) return <></>;

  const tone = toneByOutcome[moa?.outcome ?? ""] ?? "bg-white";
  const verificationCode = (signedDocument.data?.signedDocument?.verification_code as string) ?? "";

  async function copyVerification() {
    if (!verificationCode) return;
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <section className="space-y-4">
      {loading ? (
        <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          Loading...
        </div>
      ) : (
        <CustomCard className={`border ${tone}`}>
          <div className="flex flex-row items-start justify-between">
            {/* Left side */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div className="text-muted-foreground flex flex-col gap-1">
                <StatusBadge status={moa.outcome ?? ""} className="text-md w-fit" />
                {moa.outcome === "approved" ? (
                  <span className="">
                    Document Verification Code:{" "}
                    <button
                      type="button"
                      onClick={copyVerification}
                      title="Click to copy"
                      className="text-foreground focus-visible:ring-primary/40 inline-flex items-center gap-2 rounded-[0.33em] border bg-white/70 px-2 py-1 font-mono text-sm hover:cursor-pointer hover:bg-white focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <span>{verificationCode || "loading..."}</span>
                      {copied ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </span>
                ) : (
                  <div className="text-lg font-bold tracking-tight">
                    {statusUpdates[moa?.outcome ?? ""] ?? "-"}
                  </div>
                )}
                <span className="text-xs">
                  Requested at <span className="font-bold">{formatWhen(moa.timestamp)}</span>
                </span>
              </div>
            </div>

            {/* Right side */}
            <div className="flex flex-col items-end">
              {moa.outcome === "approved" && (
                <Button asChild>
                  <a
                    href={(signedDocument.data?.signedDocument?.url as string) ?? "/not-found"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Download MOA
                  </a>
                </Button>
              )}
              {moa.outcome === "waiting-for-entity" && (
                <Button scheme="secondary" onClick={() => router.push("/dashboard/review")}>
                  Review Request
                  <SidebarOpen />
                </Button>
              )}
            </div>
          </div>
        </CustomCard>
      )}
    </section>
  );
}
