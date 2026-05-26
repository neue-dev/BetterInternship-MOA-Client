import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, FileText, Hash, PaperclipIcon, ShieldAlert, User } from "lucide-react";
import { MetaRow } from "./MetaRow";
import { formatWhen } from "@/lib/format";
import { Badge } from "../ui/badge";

interface DocResponse {
  url: string;
  signatories?: { name: string; title?: string; email?: string; signedDate?: string | number }[];
  date_made?: string;
  form_label?: string;
  uploaded_at?: string;
  code?: string;
  verification_code?: string;
}

function PeopleList({ list }: { list?: DocResponse["signatories"] }) {
  if (!list || list.length === 0) return <>--</>;
  return (
    <div className="space-y-3">
      {list.map((p, i) => (
        <div key={i}>
          <span className="font-semibold">{p.name}</span>
          <div className="flex flex-col">
            {p.email && <code className="font-mono text-xs text-blue-700/80">{p.email}</code>}
            {p.title && <div className="text-xs text-gray-500">{p.title}</div>}
            {p.signedDate && (
              <code className="text-xs text-gray-500">{formatWhen(p.signedDate as string)}</code>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function VerificationDetailsCard({ document }: { document: DocResponse }) {
  const date = document.date_made || document.uploaded_at;
  const hasSignatures = !!document.signatories?.length;
  console.log(document);

  return (
    <Card className="bg-white">
      {hasSignatures && (
        <CardHeader className="">
          <CardTitle className="flex items-center gap-2">
            <Badge type="supportive" className="gap-1.5 text-sm">
              {hasSignatures ? (
                <ShieldAlert className="h-4 w-4" />
              ) : (
                <PaperclipIcon className="h-4 w-4" />
              )}
              {hasSignatures ? "Signed Document" : "Filled-out Document"}
            </Badge>
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className="space-y-5">
        <div className="grid gap-3">
          <MetaRow
            icon={<Hash className="h-4 w-4" />}
            label="Serial"
            value={document.verification_code ?? document.code}
          />
          <MetaRow
            icon={<FileText className="h-4 w-4" />}
            label="Title"
            value={document.form_label ?? "Unspecified Document"}
          />
          {date && (
            <MetaRow
              icon={<Clock className="h-4 w-4" />}
              label="Signed On"
              value={formatWhen(date)}
            />
          )}
          {document.signatories?.length ? (
            <MetaRow
              icon={<User className="h-4 w-4" />}
              label="Signatories"
              value={<PeopleList list={document.signatories} />}
            />
          ) : (
            <MetaRow
              icon={<User className="h-4 w-4" />}
              label="Signatories"
              value={<div className="italic ">No signatories</div>}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
