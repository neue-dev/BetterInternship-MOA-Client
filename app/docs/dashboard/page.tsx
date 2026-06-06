"use client";

import { useState } from "react";
import { HeaderIcon, HeaderText } from "@/components/ui/text";
import { Newspaper, Pen, Clock, Check, CircleSlash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSignatoryProfile } from "../auth/provider/signatory.ctx";
import { IMyForm, useMyForms } from "@/components/docs/forms/myforms.ctx";
import MyFormsTable from "@/components/docs/dashboard/FormTable";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";

export default function DocsDashboardPage() {
  const profile = useSignatoryProfile();
  const { forms, loading, error } = useMyForms();
  const isLoggedIn = Boolean(profile?.email);
  const isCoordinator = Boolean(profile.coordinatorId);
  const [activeTab, setActiveTab] = useState("needs_signing");

  const statuses = [
    {
      id: "needs_signing",
      label: "Needs signing",
      icon: Pen,
      countClass: "bg-warning text-white",
      filter: (form: IMyForm) => {
        const lastUnsignedSigningParty = form.signing_parties
          .toSorted((a, b) => a.order - b.order)
          .find((signingParty) => !signingParty.signed);
        const mySigningParty = form.signing_parties.find(
          (signingParty) =>
            signingParty.signatory_account?.email === profile.email && !signingParty.signed
        );

        return (
          lastUnsignedSigningParty?._id === mySigningParty?._id &&
          !form.signed_document_id &&
          !form.rejection_reason
        );
      },
    },
    {
      id: "completed",
      label: "Completed",
      icon: Check,
      filter: (form: IMyForm) => {
        return Boolean(form.signed_document_id);
      },
    },
    {
      id: "cancelled",
      label: "Cancelled",
      icon: CircleSlash2,
      filter: (form: IMyForm) => {
        return Boolean(form.rejection_reason);
      },
    },
    {
      id: "pending_signatures",
      label: "Pending other signatures",
      icon: Clock,
      filter: (form: IMyForm) => {
        const lastUnsignedSigningParty = form.signing_parties
          .toSorted((a, b) => a.order - b.order)
          .find((signingParty) => !signingParty.signed);
        const mySigningParty = form.signing_parties.find(
          (signingParty) =>
            signingParty.signatory_account?.email === profile.email && !signingParty.signed
        );

        return lastUnsignedSigningParty?._id !== mySigningParty?._id && !form.rejection_reason;
      },
    },
  ];
  const allFormsTab = {
    id: "all",
    label: "All forms",
    icon: Newspaper,
  };

  if (profile.loading || !isLoggedIn) {
    return <Loader>Loading dashboard...</Loader>;
  }

  return (
    <div className="max-w-8xl container mx-auto flex h-full min-h-0 flex-col gap-6 overflow-hidden px-4 pt-6 pb-4 sm:px-10 sm:pt-16 sm:pb-6">
      {/* Header */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-3">
          <HeaderIcon icon={Newspaper} />
          <HeaderText>Forms</HeaderText>
        </div>
        <p className="text-muted-foreground text-sm sm:text-base">
          View and sign internship forms.
        </p>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="text-sm text-gray-600">Loading signed documents...</div>
        ) : error ? (
          <div className="text-sm text-red-600">Failed to load signed documents.</div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-2">
            {/* Tabs with External Arrows */}
            <div className="scrollbar-hide flex shrink-0 flex-row gap-1.5 overflow-x-auto border-b border-slate-200 pb-1">
              {statuses.map((status) => {
                const IconComponent = status.icon;
                const count = forms.filter(status.filter).length;
                const isActive = activeTab === status.id;

                return (
                  <button
                    key={status.id}
                    onClick={() => setActiveTab(status.id)}
                    title={status.label}
                    className={cn(
                      "flex w-fit shrink-0 items-center gap-2 rounded-[0.33em] border border-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors",
                      isActive
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "hover:border-primary/20 hover:bg-primary/10 hover:text-primary text-slate-600"
                    )}
                  >
                    <IconComponent
                      className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-400")}
                    />
                    {status.label}
                    {status.id === "needs_signing" && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                          status.countClass
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={() => setActiveTab(allFormsTab.id)}
                className={cn(
                  "flex w-fit shrink-0 items-center gap-2 rounded-[0.33em] border border-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  activeTab === allFormsTab.id
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "hover:border-primary/20 hover:bg-primary/10 hover:text-primary text-slate-600"
                )}
              >
                <Newspaper
                  className={cn(
                    "h-4 w-4",
                    activeTab === allFormsTab.id ? "text-white" : "text-slate-400"
                  )}
                />
                {allFormsTab.label}
              </button>
            </div>

            {/* Content */}
            {activeTab === "all" && (
              <Card className="min-h-0 flex-1 p-3">
                <MyFormsTable rows={forms} isCoordinator={isCoordinator} />
              </Card>
            )}

            {statuses.map((status) => {
              return activeTab === status.id ? (
                <Card key={status.id} className="min-h-0 flex-1 p-3">
                  <MyFormsTable
                    rows={forms.filter(status.filter)}
                    isCoordinator={isCoordinator}
                    exportEnabled
                    exportLabel={status.label}
                    exportFormName={""}
                  />
                </Card>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
