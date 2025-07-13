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



function restoreHighlights() {
  chrome.storage.local.get([window.location.href], (result) => {
    const highlights = result[window.location.href] || [];

    highlights.forEach(({ xpath, html, text }) => {
      const container = getNodeByXPath(xpath);
      if (!container) return;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      for (const node of textNodes) {
        if (node.parentNode && node.parentNode.classList.contains("webmarker-highlight")) continue;

        const index = node.textContent.indexOf(text);
        if (index !== -1) {
          const before = node.textContent.slice(0, index);
          const after = node.textContent.slice(index + text.length);

          const beforeNode = document.createTextNode(before);
          const afterNode = document.createTextNode(after);

          const wrapper = document.createElement("div");
          wrapper.innerHTML = html;
          const highlightNode = wrapper.firstChild;

          node.replaceWith(beforeNode, highlightNode, afterNode);
          break;
        }
      }
    });
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
});

window.addEventListener("load", () => {
  setTimeout(restoreHighlights, 500); // Delay helps with some dynamic pages
});


