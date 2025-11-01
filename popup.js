let isRunning = false;

document.getElementById('startBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
  
  isRunning = true;
  updateUI();
});

document.getElementById('stopBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'stop' });
  
  isRunning = false;
  updateUI();
});

function updateUI() {
  document.getElementById('startBtn').disabled = isRunning;
  document.getElementById('stopBtn').disabled = !isRunning;
  document.getElementById('status').classList.toggle('active', isRunning);
  document.getElementById('status').textContent = isRunning ? '🔄 جاري الاستخراج...' : 'جاهز للبدء';
}

// استقبال التحديثات من content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateStats') {
    document.getElementById('domainsCount').textContent = message.domains;
    document.getElementById('pagesCount').textContent = message.pages;
  }
  
  if (message.action === 'completed') {
    isRunning = false;
    updateUI();
    document.getElementById('status').textContent = '✅ اكتمل!';
  }
});

