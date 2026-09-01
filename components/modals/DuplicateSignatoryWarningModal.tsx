import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";

type DuplicateSignatoryWarningModalProps = {
  previousRoles: string[];
  currentRole: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const formatRoleList = (roles: string[]) => {
  if (roles.length === 1) return roles[0];
  if (roles.length === 2) return `${roles[0]} and ${roles[1]}`;
  return `${roles.slice(0, -1).join(", ")}, and ${roles.at(-1)}`;
};

export const DuplicateSignatoryWarningModal = ({
  previousRoles,
  currentRole,
  onCancel,
  onConfirm,
}: DuplicateSignatoryWarningModalProps) => {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="mt-2 flex justify-center">
        <AlertTriangle className="h-14 w-14 text-amber-700" aria-hidden="true" />
      </div>
      <div className="rounded-[0.33em] border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-6">
        <p className="leading-6">
          You&apos;ve already signed this form as the{" "}
          <span className="font-semibold">{formatRoleList(previousRoles)}</span>.
        </p>
        <p className="mt-3 leading-6">
          Are you sure you also want to sign it as the{" "}
          <span className="font-semibold">{currentRole}</span>?
        </p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm}>Continue</Button>
      </div>
    </div>
  );
};
