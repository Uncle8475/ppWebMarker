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

      // Collect all text nodes inside the container (depth-first)
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.parentNode.classList.contains("webmarker-highlight")) {
          textNodes.push(node);
        }
      }

      // Combine text of all nodes to search for full highlighted text
      const fullText = textNodes.map(n => n.textContent).join("");
      const matchIndex = fullText.indexOf(text);
      if (matchIndex === -1) return;

      // Figure out where the match starts and ends across text nodes
      let currentPos = 0;
      let startNode, startOffset, endNode, endOffset;
      for (let node of textNodes) {
        const len = node.textContent.length;
        if (!startNode && currentPos + len >= matchIndex) {
          startNode = node;
          startOffset = matchIndex - currentPos;
        }
        if (currentPos + len >= matchIndex + text.length) {
          endNode = node;
          endOffset = matchIndex + text.length - currentPos;
          break;
        }
        currentPos += len;
      }

      // Create the range
      const range = document.createRange();
      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
      } catch (e) {
        console.warn("Skipping invalid range", e);
        return;
      }

      // Create highlight element
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      const highlightNode = wrapper.firstChild;

      // Extract content and wrap
      // const contents = range.extractContents();
      // highlightNode.appendChild(contents);
      // range.insertNode(highlightNode);

      //upar wali 3 lines se 2 bar restore ho raha tha highlight

      range.deleteContents();
      range.insertNode(highlightNode);
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


