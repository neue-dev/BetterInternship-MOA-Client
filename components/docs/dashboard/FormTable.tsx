"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download, Hourglass, ChevronDown, Sheet, ExternalLink } from "lucide-react";
import { IMyForm, useMyForms } from "../forms/myforms.ctx";
import { IFormSignatory } from "@betterinternship/core/forms";
import { useSignatoryProfile } from "@/app/docs/auth/provider/signatory.ctx";
import { resolveSignedUrl } from "@/lib/signed-url";
import { useFormsControllerGetBulkFormProcesses } from "@/app/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { downloadFormsAsCsv } from "./CsvExporter";
import { RowEntry } from "@/lib/types";
import useModalRegistry from "@/components/modal-registry";

export type FormRow = {
  form_label: string;
  form_name: string;
  timestamp: string;
  url?: string;
  inputs?: Record<string, unknown>;
};

export function getDisplayValue(info: Record<string, unknown>, section: string, key: string) {
  if (!info) return "—";
  const composed = `${section}.${key}:default`;
  const val = info[composed];
  if (val !== undefined && val !== null) return toDisplayString(val);
}

const toDisplayString = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return `${value}`;
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
};

export const createBaseFormColumns = (): ColumnDef<IMyForm>[] => [
  {
    accessorKey: "label",
    header: "Form",
    cell: (info) => info.getValue(),
  },
  {
    accessorKey: "timestamp",
    header: "Generated At",
    cell: (info) => formatDate(new Date(info.getValue() as string), "MM/dd/yyyy hh:mm a"),
  },
  {
    id: "requester",
    header: "Requester",
    accessorFn: (row) => getDisplayValue(row.display_information!, "student", "full-name"),
    cell: (info) => info.getValue(),
    enableSorting: true,
  },
];

/**
 * Form columns for coordinators.
 * Contains additional info about student and company.
 *
 * @returns
 */
const createCoordinatorFormColumns = (
  profile: IFormSignatory,
  onViewRejectedDetails: (form: IMyForm) => void
): ColumnDef<IMyForm>[] => [
  ...createBaseFormColumns(),
  {
    id: "student_id",
    header: "Student ID",
    accessorFn: (row) => getDisplayValue(row.display_information!, "student", "id-number"),
    cell: (info) => info.getValue(),
    enableSorting: true,
  },
  {
    id: "entity",
    header: "Company",
    accessorFn: (row) => getDisplayValue(row.display_information!, "entity", "legal-name"),
    cell: (info) => info.getValue(),
    enableSorting: true,
  },
  ...createActionColumns(profile, onViewRejectedDetails),
];

/**
 * Non-coordinator cols.
 *
 * @returns
 */
const createNonCoordintatorColumns = (
  profile: IFormSignatory,
  onViewRejectedDetails: (form: IMyForm) => void
): ColumnDef<IMyForm>[] => [
  ...createBaseFormColumns(),
  ...createActionColumns(profile, onViewRejectedDetails),
];

/**
 * A column for the actions you can perform on a form.
 *
 * @returns
 */
const createActionColumns = (
  profile: IFormSignatory,
  onViewRejectedDetails: (form: IMyForm) => void
): ColumnDef<IMyForm>[] => [
  {
    id: "actions",
    header: "Actions",
    cell: (info) => {
      const myForm = info.row.original;
      const lastUnsignedSigningParty = myForm.signing_parties
        .toSorted((a, b) => a.order - b.order)
        .find((signingParty) => !signingParty.signed);
      const mySigningParty = myForm.signing_parties.find(
        (signingParty) =>
          signingParty.signatory_account?.email === profile.email && !signingParty.signed
      );

      if (myForm.signed_document_id) {
        return (
          <Button
            size="sm"
            onClick={async () => {
              const url = await resolveSignedUrl(myForm.latest_document_url!);
              window.open(url, "_blank");
            }}
            className="flex items-center gap-2"
          >
            Download
            <Download className="h-4 w-4" />
          </Button>
        );
      } else if (myForm.rejection_reason) {
        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewRejectedDetails(myForm)}
            className="flex items-center gap-2"
          >
            View Details
            <ExternalLink className="h-4 w-4" />
          </Button>
        );
      } else if (lastUnsignedSigningParty?._id !== mySigningParty?._id) {
        return (
          <Button size="sm" variant="outline" disabled className="flex items-center gap-1">
            Pending
            <Hourglass className="h-4 w-4" />
          </Button>
        );
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_URL;
        const pendingLink = `${baseUrl}sign?form-process-id=${myForm.form_process_id}&signing-party-id=${mySigningParty?._id}`;
        return (
          <a href={pendingLink} target="_blank">
            <Button
              size="sm"
              className="bg-warning hover:bg-warning/90 relative flex items-center gap-1 text-white"
            >
              Sign Now
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        );
      }
    },
  },
];

export default function MyFormsTable({
  rows,
  isCoordinator,
  exportEnabled = true,
}: {
  rows: IMyForm[];
  isCoordinator: boolean;
  exportEnabled?: boolean;
  exportLabel?: string;
  exportFormName?: string;
}) {
  const profile = useSignatoryProfile();
  const modalRegistry = useModalRegistry();
  const handleViewRejectedDetails = (form: IMyForm) => {
    modalRegistry.cancelledFormDetails.open(form.rejection_reason);
  };
  const columns = isCoordinator
    ? createCoordinatorFormColumns(profile, handleViewRejectedDetails)
    : createNonCoordintatorColumns(profile, handleViewRejectedDetails);

  const { forms } = useMyForms();
  const [selectedFormTypes, setSelectedFormTypes] = useState<Set<string>>(new Set());
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);

  const formTypes = useMemo(() => {
    return forms.reduce<{ id: string; label: string; formName: string }[]>((acc, form: IMyForm) => {
      const id = form.label;
      if (!id || !!acc.find((tab) => tab.id === id)) return acc;
      acc.push({
        id,
        label: form.label || "Untitled Form",
        formName: form.name,
      });
      return acc;
    }, []);
  }, [forms]);

  // track selected form types
  const handleFormTypeToggle = (formName: string, checked: boolean) => {
    const newSelected = new Set(selectedFormTypes);

    if (checked) {
      newSelected.add(formName);
    } else {
      newSelected.delete(formName);
    }

    setSelectedFormTypes(newSelected);
  };

  // update dropdown open state and clear selected forms
  const handleDropdownOpenChange = (open: boolean) => {
    setIsExportDropdownOpen(open);

    if (!open) {
      setSelectedFormTypes(new Set());
    }
  };

  const { mutateAsync: fetchExportData } = useFormsControllerGetBulkFormProcesses();
  const [isExporting, setIsExporting] = useState(false);

  // export csvs.
  const handleExport = async () => {
    if (!profile?.id || selectedFormTypes.size === 0) return;

    setIsExporting(true);

    try {
      const fetchPromises = Array.from(selectedFormTypes).map(async (formName) => {
        const response = await fetchExportData({
          data: { signatoryId: profile.id, formName },
        });

        // parse and conform variables to RowEntry format.
        if (response && response.processes && response.processes.length > 0) {
          return response.processes.map((process) => {
            const entries: RowEntry[] = [
              { col: "form_label", value: process.formLabel || "Unknown" },
              { col: "form_name", value: process.formName || "Unknown" },
              { col: "timestamp", value: process.createdAt || new Date().toISOString() },
              {
                col: "url",
                value: (typeof process.documentUrl === "string" ? process.documentUrl : "") || "",
              },
            ];

            // spread inputs horizontally into individual RowEntries.
            Object.entries(process.inputs || {}).forEach(([k, v]) => {
              entries.push({ col: k, value: v as string | number | boolean | null });
            });

            return entries;
          });
        }

        return [];
      });

      const results = await Promise.all(fetchPromises);

      const validResults = results.filter((formEntries) => formEntries.length > 0);

      if (validResults.length > 0) {
        setIsExportDropdownOpen(false); // close dropdown
        setSelectedFormTypes(new Set()); // clear selection
        downloadFormsAsCsv(validResults); /// download
      } else {
        toast.info("No signed forms available to export for the selected types.");
      }
    } catch (error) {
      console.error("Export error: ", error);
      toast.error("Failed to fetch export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DataTable
      id="docs-dashboard-forms-table"
      columns={columns}
      data={rows}
      enableColumnVisibility
      initialSorting={[{ id: "timestamp", desc: false }]}
      sortingStorageKey="docs-dashboard-forms-sorting"
      pageSizes={[20, 50]}
      className="h-full"
      toolbarActions={
        exportEnabled ? (
          <DropdownMenu open={isExportDropdownOpen} onOpenChange={handleDropdownOpenChange}>
            <DropdownMenuTrigger asChild>
              <Button
                variant={"outline"}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-10 gap-2"
              >
                <Sheet />
                <span>Export CSV</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuLabel>Select forms to export</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {formTypes.length === 0 ? (
                <div className="text-muted-foreground px-2 py-1.5 text-sm">No forms available.</div>
              ) : (
                formTypes.map((formType) => (
                  <DropdownMenuCheckboxItem
                    key={formType.id}
                    onClick={() => handleFormTypeToggle}
                    checked={selectedFormTypes.has(formType.formName)}
                    onCheckedChange={(checked) => handleFormTypeToggle(formType.formName, checked)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {formType.label}
                  </DropdownMenuCheckboxItem>
                ))
              )}
              <div className="sticky bottom-0 w-full bg-white">
                <DropdownMenuSeparator />
                <Button
                  className="disabled:bg-muted disabled:text-muted-foreground w-full"
                  disabled={selectedFormTypes.size === 0}
                  onClick={() => void handleExport()}
                >
                  <Sheet />
                  {isExporting
                    ? "Downloading..."
                    : selectedFormTypes.size === 0
                      ? `Select forms to export`
                      : `Export ${selectedFormTypes.size} CSV${selectedFormTypes.size === 1 ? "" : "s"}`}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      }
    />
  );
}
