import React, { useState } from "react"
import { bgSend } from "~lib/messaging"
import { t } from "~lib/i18n"
import type { Notebook } from "~lib/types"

interface Props {
  notebooks: Notebook[]
  current: string | null
  onChange: (id: string) => void
  onRefresh?: () => void
  children?: React.ReactNode
}

export function NotebookSelector({ notebooks, current, onChange, onRefresh, children }: Props) {
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
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <select
          value={current ?? ""}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setNewName("")
            } else {
              onChange(e.target.value)
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 8,
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-accent)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <option value="" disabled>
            {t("notebook_select_placeholder")}
          </option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.title}
              {nb.is_owner ? "" : t("notebook_readonly")}
            </option>
          ))}
        </select>
        <button
          onClick={() => setNewName((v) => (v === "" ? " " : ""))}
          title={t("notebook_create_title")}
          style={{
            flexShrink: 0,
            padding: "4px 8px",
            background: "var(--bg-input)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          +
        </button>
        {children}
      </div>

      {newName !== "" && (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <input
            autoFocus
            value={newName.trim() ? newName : ""}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("notebook_new_placeholder")}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{
              flex: 1,
              padding: 6,
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            style={{
              padding: "4px 10px",
              background: "var(--accent)",
              color: "var(--accent-text)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {creating ? "..." : t("notebook_create_btn")}
          </button>
          <button
            onClick={() => setNewName("")}
            style={{
              padding: "4px 8px",
              background: "transparent",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t("notebook_cancel")}
          </button>
        </div>
      )}
    </div>
  )
}
