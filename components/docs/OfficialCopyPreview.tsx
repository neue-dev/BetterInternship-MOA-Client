/**
 * OfficialCopyPreview
 *
 * Card wrapper displaying the final signed PDF for download.
 * Renders FormFillPdfViewer inside a fixed-height container with
 * an "Official Copy Preview" header and a download button.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { File as FileIcon, Loader2 } from "lucide-react";
import { Download } from "lucide-react";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { FormFillPdfViewer } from "@betterinternship/core/pdf-viewer";

export function OfficialCopyPreview({
  title,
  viewUrl,
  downloadUrl,
}: {
  title: string;
  viewUrl: string;
  downloadUrl?: string;
}) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);

  async function downloadPdf(url: string, filename: string = "document.pdf") {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const blob = await response.blob(); // get file data
      const blobUrl = URL.createObjectURL(blob); // create local URL

      const a = document.createElement("a"); // create anchor
      a.href = blobUrl;
      a.download = (filename || url.split("/").pop()) ?? ""; // default name
      document.body.appendChild(a);
      a.click(); // trigger download

      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl); // clean up
    } catch (err) {
      console.error("Download failed:", err);
    }
    setLoading(false);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileIcon className="h-5 w-5" />
            <span>Official Copy Preview</span>
          </div>

          {/* Actions */}
          <div className="hidden flex-wrap gap-2 text-sm sm:flex">
            {downloadUrl && (
              <Button disabled={loading} onClick={() => void downloadPdf(viewUrl, `${title}.pdf`)}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download PDF
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {downloadUrl && (
          <div className="sm:hidden">
            <Button
              className="w-full"
              disabled={loading}
              onClick={() => void downloadPdf(viewUrl, `${title}.pdf`)}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </Button>
          </div>
        )}
        <div className="h-[68vh] w-full overflow-hidden rounded border bg-slate-100 sm:h-[80vh]">
          <FormFillPdfViewer
            documentUrl={viewUrl}
            blocks={[]}
            values={{}}
            scale={isMobile ? 0.5 : 0.9}
            showToolbar={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}
