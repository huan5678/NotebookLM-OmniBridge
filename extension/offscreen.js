chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type !== "OFFSCREEN_FETCH") return false;

  (async function() {
    try {
      console.log("[OFFSCREEN] fetching:", msg.url);
      var resp = await fetch(msg.url, {
        method: msg.method || "GET",
        credentials: "include",
        headers: msg.headers || {},
        body: msg.body || undefined,
        redirect: "follow",
      });
      var text = await resp.text();
      console.log("[OFFSCREEN] response:", resp.status, resp.url.slice(0, 100));
      sendResponse({ ok: resp.ok, status: resp.status, url: resp.url, text: text });
    } catch (err) {
      console.log("[OFFSCREEN] error:", err);
      sendResponse({ ok: false, status: 0, url: "", text: "", error: String(err) });
    }
  })();

  return true;
});

console.log("[OFFSCREEN] ready");
