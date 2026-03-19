import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type PdfColumn = {
  header: string;
  dataKey: string;
};

type PdfOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  columns: PdfColumn[];
  rows: Record<string, unknown>[];
};

export function exportReportPdf({
  title,
  subtitle,
  filename,
  columns,
  rows,
}: PdfOptions) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "letter",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, marginX, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    subtitle || `Generated ${new Date().toLocaleString()}`,
    marginX,
    54
  );

  autoTable(doc, {
    startY: 70,
    margin: { left: marginX, right: marginX },
    head: [columns.map((col) => col.header)],
    body: rows.map((row) =>
      columns.map((col) => {
        const value = row[col.dataKey];
        return value === null || value === undefined ? "" : String(value);
      })
    ),
    styles: {
      fontSize: 8,
      cellPadding: 5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      textColor: [15, 23, 42],
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageNumber = doc.getCurrentPageInfo().pageNumber;

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(
        `Page ${pageNumber} of ${pageCount}`,
        pageWidth - 90,
        doc.internal.pageSize.getHeight() - 20
      );
    },
  });

  doc.save(filename);
}
