document.getElementById("highlightBtn").addEventListener("click", () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "highlight" });
  });
});

document.getElementById("clearBtn").addEventListener("click", () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "clearHighlights" });
  });
});

document.getElementById("refresh").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "pprestoreHighlights" });
  });
});

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  loadHighlights(tabs[0].url);
});

function loadHighlights(url) {
  chrome.storage.local.get([url], (data) => {
    const highlights = data[url] || [];
    const list = document.getElementById("highlightItems");
    list.innerHTML = "";

    if (highlights.length === 0) {
      const li = document.createElement("p");
      li.textContent = "No highlights found.";
      li.style.color = "#888";
      li.style.fontStyle = "italic";
      list.appendChild(li);
      return;
    }

    highlights.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = `${item.text}`;
      list.appendChild(li);
    });
  });
}
