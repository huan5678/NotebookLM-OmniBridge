/**
 * Offscreen document for making authenticated fetch requests to Google.
 *
 * MV3 service workers cannot send cookies with fetch(). This offscreen
 * document runs in a real browsing context where credentials:"include" works.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "OFFSCREEN_FETCH") return false

  ;(async () => {
    try {
      const resp = await fetch(msg.url, {
        method: msg.method || "GET",
        credentials: "include",
        headers: msg.headers || {},
        body: msg.body || undefined,
        redirect: "follow",
      })

      const text = await resp.text()
      sendResponse({
        ok: resp.ok,
        status: resp.status,
        url: resp.url,
        text,
      })
    } catch (err) {
      sendResponse({
        ok: false,
        status: 0,
        url: "",
        text: "",
        error: String(err),
      })
    }
  })()

  return true // keep channel open for async response
})
