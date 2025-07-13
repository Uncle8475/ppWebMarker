function highlightSelection() {
  const selection = window.getSelection();
  if (!selection.toString()) return;

  const span = document.createElement("span");
  span.style.backgroundColor = "yellow";
  span.className = "webmarker-highlight";
  span.textContent = selection.toString();

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(span);

  saveHighlights();
}

function saveHighlights() {
  chrome.storage.local.set({
    [window.location.href]: document.body.innerHTML
  });
}

function restoreHighlights() {
  chrome.storage.local.get(window.location.href, (data) => {
    if (data[window.location.href]) {
      document.body.innerHTML = data[window.location.href];
    }
  });
}


function clearHighlights() {
  document.querySelectorAll(".webmarker-highlight").forEach(el => {
    const text = document.createTextNode(el.textContent);
    el.replaceWith(text);
  });
  chrome.storage.local.remove(window.location.href);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "highlight") highlightSelection();
  if (msg.action === "clearHighlights") clearHighlights();
});

window.onload = restoreHighlights;
