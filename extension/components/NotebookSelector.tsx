import React, { useState } from "react"
import { bgSend } from "~lib/messaging"
import type { Notebook } from "~lib/types"

interface Props {
  notebooks: Notebook[]
  current: string | null
  onChange: (id: string) => void
  onRefresh?: () => void
}

export function NotebookSelector({ notebooks, current, onChange, onRefresh }: Props) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await bgSend({ type: "NOTEBOOKLM_CREATE", name: newName.trim() })
      setNewName("")
      onRefresh?.()
    } catch (err) {
      console.error("Create notebook failed:", err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 4 }}>
        <select
          value={current ?? ""}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setNewName("")
              // Focus will shift to input below
            } else {
              onChange(e.target.value)
            }
          }}
          style={{
            flex: 1,
            padding: 8,
            background: "#0f3460",
            color: "#eee",
            border: "1px solid #e94560",
            borderRadius: 6,
            fontSize: 13,
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
        <button
          onClick={() => setNewName((v) => (v === "" ? " " : ""))}
          title="建立新 Notebook"
          style={{
            padding: "4px 8px",
            background: "#0f3460",
            color: "#e94560",
            border: "1px solid #e94560",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          +
        </button>
      </div>

      {newName !== "" && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input
            autoFocus
            value={newName.trim() ? newName : ""}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="新 Notebook 名稱..."
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{
              flex: 1,
              padding: 6,
              background: "#0f3460",
              color: "#eee",
              border: "1px solid #533483",
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: "4px 10px",
              background: "#533483",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {creating ? "..." : "建立"}
          </button>
          <button
            onClick={() => setNewName("")}
            style={{
              padding: "4px 8px",
              background: "transparent",
              color: "#888",
              border: "1px solid #444",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            取消
          </button>
        </div>
      )}
    </div>
  )
}
