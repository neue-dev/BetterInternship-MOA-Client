// app/docs/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import { Search, SearchCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VerificationDetailsCard } from "@/components/docs/VerificationDetailsCard";
import { OfficialCopyPreview } from "@/components/docs/OfficialCopyPreview";
import { SignedOrExternalDocumentInfo, useDocsControllerGetByVerificationCode } from "../api";
import { useSearchParams } from "next/navigation";
import { HeaderIcon, HeaderText } from "@/components/ui/text";

const SerialSchema = z
  .string()
  .trim()
  .regex(
    /^(?:IOM-)?\d{10}-[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}$/,
    "Serial must be 10-8-8 characters (e.g., 0123456789-abcdefgh-1234abcd), optionally prefixed with IOM-",
  );

export default function VerifyDocsPage() {
  return (
    <Suspense>
      <VerifyDocsPageContent />
    </Suspense>
  );
}

function VerifyDocsPageContent() {
  const [serial, setSerial] = useState("");
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  const [result, setResult] = useState<SignedOrExternalDocumentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedDocument = useDocsControllerGetByVerificationCode(serial);
  const searchParams = useSearchParams();

  useEffect(() => {
    const verificationCode = searchParams.get("verification-code");
    if (verificationCode) setSerial(verificationCode);
  }, [searchParams]);

  useEffect(() => {
    const doc = signedDocument.data?.signedDocument;
    if (doc) setResult(doc ?? {});
    setLoading(signedDocument.isFetching);
  }, [signedDocument]);

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const parsed = SerialSchema.safeParse(serial);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid serial");
      return;
    }
  }

  return (
    <div className="w-full overflow-x-hidden bg-slate-50/60">
      <section className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl py-5 sm:px-6 sm:py-6">
          {/* FORM: centered on first load; pinned to top after search */}
          {!result ? (
            <div className="flex min-h-[62vh] items-center justify-center">
              <div className="w-full max-w-3xl">
                {/* Header on the form */}
                <div className="mb-6 space-y-2">
                  <div className="flex items-center gap-3">
                    <HeaderIcon icon={SearchCheck} />
                    <HeaderText> Document Verifier </HeaderText>
                  </div>
                  <p className="text-sm text-muted-foreground sm:text-base">
                    Enter the <strong>Serial Number</strong> printed on the document to check its
                    authenticity.
                  </p>
                </div>

                <form
                  onSubmit={handleVerify}
                  className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row"
                >
                  <Input
                    value={serial}
                    placeholder="0123456789-0123abcd-4567defa"
                    onChange={(v) => (setSerial(v.target.value), setResult(null))}
                    aria-invalid={!!error}
                    className="h-12 flex-1 font-mono"
                  />
                  <Button type="submit" className="h-12 sm:w-40" disabled={loading}>
                    <Search className="mr-2 h-4 w-4" /> {loading ? "Verifying..." : "Verify"}
                  </Button>
                </form>

                {error && (
                  <p className="mt-2 text-center text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-5">
              {/* Header stays above the form when pinned */}
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center gap-3">
                  <HeaderIcon icon={SearchCheck} />
                  <HeaderText> Document Verifier </HeaderText>
                </div>
                <p className="text-muted-foreground text-sm">
                  Enter the <strong>Serial Number</strong> printed on the document to check its
                  authenticity.
                </p>
              </div>

              <form
                onSubmit={handleVerify}
                className="mx-auto flex w-full flex-col gap-3 sm:flex-row"
              >
                <Input
                  value={serial}
                  onChange={(v) => setSerial(v.target.value)}
                  aria-invalid={!!error}
                  className="h-12 flex-1"
                />
                <Button type="submit" className="h-12 sm:w-40" disabled={loading}>
                  <Search className="mr-2 h-4 w-4" /> {loading ? "Verifying..." : "Verify"}
                </Button>
              </form>
              {error && (
                <p className="mt-2 text-center text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          {/* RESULTS */}
          {result ? (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
              {/* Left: document data */}
              <div className="min-w-0">
                <VerificationDetailsCard document={result} />
              </div>
              {/* Right: PDF viewer */}
              <div className="w-full max-w-full min-w-0 xl:sticky xl:top-24 xl:self-start">
                <div className="w-full max-w-full">
                  <OfficialCopyPreview
                    title={result.form_label ?? "Signed Document"}
                    viewUrl={result.url}
                    downloadUrl={result.url}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
