"use client";

/** Renders any generated document (analysis run or artifact) and downloads it. */

export interface DocSection {
  heading: string;
  method?: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
}

export function Doc({
  tag,
  title,
  subtitle,
  sections,
  onDownload,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  sections: DocSection[];
  onDownload: () => void;
}) {
  return (
    <article className="doc">
      <div className="doc-head">
        <span className="doc-kind">{tag}</span>
        <h3 className="doc-title">{title}</h3>
        {subtitle && <span className="doc-sub">{subtitle}</span>}
        <button className="doc-dl" onClick={onDownload} type="button" title="Download as Markdown">
          ↓ Markdown
        </button>
      </div>
      {sections.map((s, i) => (
        <div key={i} className="doc-section">
          <h4>
            {s.heading}
            {s.method && <span className="method-tag">{s.method}</span>}
          </h4>
          {s.body && <p>{s.body}</p>}
          {s.bullets && s.bullets.length > 0 && (
            <ul>
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
          {s.table && s.table.headers.length > 0 && <Table table={s.table} />}
        </div>
      ))}
    </article>
  );
}

export function Table({ table }: { table: { headers: string[]; rows: string[][] } }) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            {table.headers.map((h, j) => (
              <th key={j}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Serialize a document to Markdown and hand it to the browser. */
export function downloadMarkdown(filename: string, header: string[], sections: DocSection[]) {
  const lines: string[] = [...header, ""];
  for (const s of sections) {
    lines.push(`## ${s.heading}${s.method ? ` _(${s.method})_` : ""}`, "");
    if (s.body) lines.push(s.body, "");
    if (s.bullets?.length) {
      for (const b of s.bullets) lines.push(`- ${b}`);
      lines.push("");
    }
    if (s.table?.headers.length) {
      lines.push(`| ${s.table.headers.join(" | ")} |`);
      lines.push(`| ${s.table.headers.map(() => "---").join(" | ")} |`);
      for (const row of s.table.rows) {
        lines.push(`| ${row.map((c) => c.replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`);
      }
      lines.push("");
    }
  }
  lines.push("---", "_Produced by the Product Intelligence Orchestrator. Claims are graded; gaps are stated. Verify before committing._");

  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
