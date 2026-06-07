import { NextRequest, NextResponse } from "next/server";
import { flattenData } from "@/lib/dataProcessor";
import { buildCsv } from "@/lib/csv";

export async function POST(request: NextRequest) {
  try {
    const { tableData, visibleColumns } = await request.json();
    
    const flatData = flattenData(tableData);
    
    // Filter columns if specified
    const filteredData = flatData.map((row) => {
      if (!visibleColumns || visibleColumns.length === 0) return row;
      
      const filteredRow: Record<string, any> = {};
      visibleColumns.forEach((col: string) => {
        if (col in row) {
          filteredRow[col] = row[col];
        }
      });
      return filteredRow;
    });

    // Convert to CSV
    if (filteredData.length === 0) {
      return NextResponse.json({ error: "No data to export" }, { status: 400 });
    }

    const headers = Object.keys(filteredData[0]);
    const csv = buildCsv(headers, filteredData);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="export.csv"',
      },
    });
  } catch (error) {
    console.error("Error exporting CSV:", error);
    return NextResponse.json(
      { error: "Failed to export CSV" },
      { status: 500 }
    );
  }
}
