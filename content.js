function getXPath(node) {
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  const parts = [];
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (sibling.nodeName === node.nodeName) index++;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(`${node.nodeName}[${index}]`);
    node = node.parentNode;
  }
  return '/' + parts.join('/');
}

function getNodeByXPath(path) {
  return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}
console.log("📌 WebMarker content script loaded");


function highlightSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  const selectedText = selection.toString();
  if (!selectedText.trim()) return;

  const span = document.createElement("span");
  span.className = "webmarker-highlight";
  span.style.backgroundColor = "yellow";

  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  } catch (err) {
    alert("Highlight failed. Try selecting inside one paragraph.");
    return;
  }

  // Save the xpath of the parent container
  const containerXpath = getXPath(span.parentNode);
  const innerHtml = span.outerHTML;

  chrome.storage.local.get([window.location.href], (data) => {
    const highlights = data[window.location.href] || [];
    highlights.push({
      xpath: containerXpath,
      html: innerHtml,
      text: selectedText
    });
    chrome.storage.local.set({ [window.location.href]: highlights });
  });

  selection.removeAllRanges();
}



function pprestoreHighlights() {
  chrome.storage.local.get([window.location.href], (result) => {
    let highlights = result[window.location.href] || [];

    // Sort longer highlights first
    highlights.sort((a, b) => b.text.length - a.text.length);

    for (const { xpath, html, text } of highlights) {
      const container = getNodeByXPath(xpath);
      if (!container) continue;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentNode.classList.contains("webmarker-highlight")) {
          textNodes.push(node);
        }
      }

      const fullText = textNodes.map(n => n.textContent).join("");
      const matchIndex = fullText.indexOf(text);
      if (matchIndex === -1) continue;

      let pos = 0;
      let startNode, startOffset, endNode, endOffset;
      for (let node of textNodes) {
        const len = node.textContent.length;

        if (!startNode && pos + len >= matchIndex) {
          startNode = node;
          startOffset = matchIndex - pos;
        }
        if (startNode && pos + len >= matchIndex + text.length) {
          endNode = node;
          endOffset = matchIndex + text.length - pos;
          break;
        }

        pos += len;
      }

      if (!startNode || !endNode) continue;

      try {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);

        // Confirm selected text matches stored text
        const selectedText = range.toString().trim();
        if (selectedText !== text.trim()) continue;

        // Create a fresh highlight span (not from stored HTML)
        const span = document.createElement("span");
        span.className = "webmarker-highlight";
        span.style.backgroundColor = "yellow";

        // Wrap safely
        range.surroundContents(span);
      } catch (err) {
        console.warn("⚠️ Could not restore highlight:", err);
      }
    }
  });
}

function clearHighlights() {
  document.querySelectorAll(".webmarker-highlight").forEach((el) => {
    const text = document.createTextNode(el.textContent);
    el.replaceWith(text);
  });
  chrome.storage.local.remove(window.location.href);
}

chrome.runtime.onMessage.addListener((msg) => {
  console.log("Got message:", msg);
  if (msg.action === "highlight") highlightSelection();
  if (msg.action === "clearHighlights") clearHighlights();
  if (msg.action === "pprestoreHighlights") pprestoreHighlights();
});

let restored = false;

function safeRestore() {
  if (!restored) {
    restored = true;
    pprestoreHighlights();
  }
}
// Fallback timer
setTimeout(safeRestore, 5000);
//to observe dynamic DOM changes
const observer = new MutationObserver(() => {
  const text = document.body.innerText;
  if (text && text.length > 1000) {
    safeRestore();        // Restore once meaningful content appears
    observer.disconnect(); // Stop observing
  }
});

observer.observe(document.body, { childList: true, subtree: true });