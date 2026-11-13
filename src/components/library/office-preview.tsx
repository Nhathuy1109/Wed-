import { useEffect, useState } from "react";

export type OfficeKind = "docx" | "xlsx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "text/csv",
];

/** Nhận diện file Word (.docx) / Excel (.xlsx, .xls, .xlsm, .csv) theo đuôi file hoặc mime. */
export function officeKind(name: string, mime: string): OfficeKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx") || mime === DOCX_MIME) return "docx";
  if (/\.(xlsx|xls|xlsm|csv)$/.test(lower) || XLSX_MIMES.includes(mime)) return "xlsx";
  return null;
}

const MAX_ROWS = 2000;
const MAX_COLS = 60;

const DOCX_STYLE = `
  body{font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111;background:#fff;margin:0;padding:20px;word-wrap:break-word}
  img{max-width:100%;height:auto}
  table{border-collapse:collapse;max-width:100%}
  td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}
  h1,h2,h3{line-height:1.3}
  a{color:#1a56db}
`;

type Sheet = { name: string; rows: string[][]; truncated: boolean };

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "docx"; html: string }
  | { status: "xlsx"; sheets: Sheet[] };

export function OfficePreview({
  url,
  name,
  kind,
  heightClass = "h-[78vh]",
}: {
  url: string;
  name: string;
  kind: OfficeKind;
  heightClass?: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [active, setActive] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    setActive(0);

    async function load() {
      const buffer = await (await fetch(url)).arrayBuffer();
      if (kind === "docx") {
        const mammoth = (await import("mammoth/mammoth.browser")).default;
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (alive) setState({ status: "docx", html: result.value });
        return;
      }
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheets: Sheet[] = workbook.SheetNames.map((sheetName) => {
        const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        });
        const truncated = raw.length > MAX_ROWS || raw.some((row) => row.length > MAX_COLS);
        const rows = raw.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLS).map((cell) => String(cell ?? "")));
        return { name: sheetName, rows, truncated };
      });
      if (alive) setState({ status: "xlsx", sheets });
    }

    load().catch(() => {
      if (alive) setState({ status: "error", message: "Không đọc được file này. Hãy tải về để mở bằng Word/Excel." });
    });
    return () => {
      alive = false;
    };
  }, [url, kind]);

  if (state.status === "loading") {
    return <p className="text-muted">Đang mở {kind === "docx" ? "file Word" : "file Excel"}…</p>;
  }
  if (state.status === "error") {
    return <p className="text-muted">{state.message}</p>;
  }
  if (state.status === "docx") {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${DOCX_STYLE}</style></head><body>${state.html}</body></html>`;
    // sandbox rỗng: không chạy script, không truy cập origin của trang → an toàn với file người khác gửi.
    return <iframe title={name} sandbox="" srcDoc={doc} className={`${heightClass} w-full rounded-2xl border border-line bg-white`} />;
  }

  const sheet = state.sheets[Math.min(active, state.sheets.length - 1)];
  return (
    <div>
      {state.sheets.length > 1 ? (
        <div role="tablist" className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {state.sheets.map((item, index) => (
            <button
              key={item.name + index}
              type="button"
              role="tab"
              aria-selected={index === active}
              onClick={() => setActive(index)}
              className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${index === active ? "border-accent bg-pink text-accent" : "border-pink-deep bg-surface"}`}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`${heightClass} overflow-auto rounded-2xl border border-line bg-white text-[#111]`}>
        {sheet && sheet.rows.length ? (
          <table className="border-collapse text-sm">
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row" className="sticky left-0 border border-[#ccc] bg-[#f3f3f3] px-2 py-1 text-xs font-normal text-[#666]">
                    {r + 1}
                  </th>
                  {row.map((cell, c) => (
                    <td key={c} className="max-w-[320px] border border-[#ddd] px-2 py-1 whitespace-pre-wrap align-top">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-sm text-[#666]">Trang tính trống.</p>
        )}
      </div>
      {sheet?.truncated ? (
        <p className="mt-2 text-sm text-muted">
          Chỉ hiển thị {MAX_ROWS} dòng và {MAX_COLS} cột đầu. Tải về để xem đầy đủ.
        </p>
      ) : null}
    </div>
  );
}
