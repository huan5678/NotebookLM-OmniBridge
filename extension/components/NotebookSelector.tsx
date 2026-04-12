import React from "react"
import type { Notebook } from "~lib/types"

interface Props {
  notebooks: Notebook[]
  current: string | null
  onChange: (id: string) => void
}

export function NotebookSelector({ notebooks, current, onChange }: Props) {
  if (notebooks.length === 0) {
    return (
      <p style={{ color: "#888", fontSize: 12, margin: "0 0 8px" }}>
        尚無 Notebook，請先在 NotebookLM 建立
      </p>
    )
  }

  return (
    <select
      value={current ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: 8,
        background: "#0f3460",
        color: "#eee",
        border: "1px solid #e94560",
        borderRadius: 6,
        fontSize: 13,
        marginBottom: 8,
      }}
    >
      <option value="" disabled>
        選擇 Notebook...
      </option>
      {notebooks.map((nb) => (
        <option key={nb.id} value={nb.id}>
          {nb.title}
          {nb.is_owner ? "" : " (唯讀)"}
        </option>
      ))}
    </select>
  )
}
