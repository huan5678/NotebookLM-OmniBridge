/**
 * Helper for Extension ↔ Background messaging
 */
export async function bgSend<T = unknown>(msg: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res: { success: boolean; data?: T; error?: string }) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (res?.success) resolve(res.data as T)
      else reject(new Error(res?.error ?? "Unknown error"))
    })
  })
}
