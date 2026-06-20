export function PdfPageHeader({
  pageNumber,
}: {
  pageNumber: number;
}) {
  return (
    <div className="text-muted-foreground border-b px-3 py-2 text-xs">
      Page {pageNumber}
    </div>
  );
}
