import React, { useEffect } from "react"
import "~style.css"
import { initTheme } from "~lib/theme"
import { SidePanel } from "~components/SidePanel"

function SidePanelPage() {
  useEffect(() => { initTheme() }, [])
  return <SidePanel />
}

export default SidePanelPage
