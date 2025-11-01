(function() {
  if (window.domainExtractorRunning) {
    console.log('⚠️ المستخرج يعمل بالفعل');
    return;
  }
  
  window.domainExtractorRunning = true;
  
  let allDomains = [];
  let currentPage = 1;
  let isProcessing = false;
  let shouldStop = false;

  const excludedDomains = [
    'namecheap.com', 'godaddy.com', 'spaceship.com', 'name.com', 'gname.com',
    'sedo.com', 'dan.com', 'afternic.com', 'dynadot.com', 'google.com',
    'expireddomains.net', 'archive.org', 'web.archive.org', 'facebook.com',
    'twitter.com', 'linkedin.com', 'youtube.com', 'instagram.com'
  ];

  async function extractDomainsFromCurrentPage() {
    if (isProcessing || shouldStop) return;
    
    isProcessing = true;
    console.log(`📄 معالجة الصفحة ${currentPage}...`);
    
    try {
      let pageDomains = extractDomainsFromHTML(document);
      
      console.log(`✅ عثر على ${pageDomains.length} نطاق في الصفحة ${currentPage}`);
      console.log(`📊 إجمالي: ${allDomains.length} نطاق`);
      
      updateStats();
      
      if (shouldStop) {
        downloadDomains();
        return;
      }
      
      let nextPageUrl = findNextPageUrl();
      
      if (nextPageUrl) {
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchAndProcessPage(nextPageUrl);
      } else {
        console.log('🏁 اكتملت جميع الصفحات!');
        downloadDomains();
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
      downloadDomains();
    }
  }

  async function fetchAndProcessPage(url) {
    if (shouldStop) {
      downloadDomains();
      return;
    }
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      let pageDomains = extractDomainsFromHTML(doc);
      
      console.log(`✅ ${pageDomains.length} نطاق - الصفحة ${currentPage}`);
      console.log(`📊 إجمالي: ${allDomains.length}`);
      
      updateStats();
      
      if (shouldStop) {
        downloadDomains();
        return;
      }
      
      let nextPageUrl = findNextPageUrl(doc);
      
      if (nextPageUrl) {
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchAndProcessPage(nextPageUrl);
      } else {
        console.log('🏁 اكتمل الاستخراج!');
        downloadDomains();
      }
    } catch (error) {
      console.error('❌ خطأ:', error);
      downloadDomains();
    }
  }

  function extractDomainsFromHTML(doc) {
    let pageDomains = [];
    let rows = doc.querySelectorAll('table tr');
    
    rows.forEach(row => {
      const firstCell = row.querySelector('td:first-child');
      if (!firstCell) return;
      
      const link = firstCell.querySelector('a');
      if (!link) return;
      
      let text = link.textContent.trim().replace(/\s+/g, '');
      
      for (let excluded of excludedDomains) {
        if (text.includes(excluded)) {
          text = text.split(excluded)[0];
        }
      }
      
      const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
      
      if (text && domainPattern.test(text)) {
        const domain = text.toLowerCase();
        
        if (!/^\d+\.\d+$/.test(domain) && 
            !excludedDomains.includes(domain) &&
            !allDomains.includes(domain) &&
            domain.length >= 4 && domain.length <= 63) {
          
          pageDomains.push(domain);
          allDomains.push(domain);
        }
      }
    });
    
    return pageDomains;
  }

  function findNextPageUrl(doc = document) {
    const selectors = [
      'a[title="Next Page"]',
      '.pagination .next',
      '.pagination a[rel="next"]',
      'a.next:not(.disabled)'
    ];
    
    for (let selector of selectors) {
      let button = doc.querySelector(selector);
      if (button && button.href) return button.href;
    }
    
    const allLinks = Array.from(doc.querySelectorAll('a'));
    const nextLink = allLinks.find(link => {
      const text = link.textContent.trim().toLowerCase();
      const hasNext = text === 'next' || text === 'next »' || text === '»';
      const notDisabled = !link.classList.contains('disabled');
      return hasNext && notDisabled && link.href;
    });
    
    return nextLink ? nextLink.href : null;
  }

  function downloadDomains() {
    const uniqueDomains = [...new Set(allDomains)].sort();
    
    const fileContent = `# تصدير النطاقات
# التاريخ: ${new Date().toISOString().split('T')[0]}
# الوقت: ${new Date().toLocaleTimeString('ar-SA')}
# إجمالي النطاقات: ${uniqueDomains.length}
# عدد الصفحات: ${currentPage}
# 
${uniqueDomains.join('\n')}`;
    
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `domains_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ تم التحميل! ${uniqueDomains.length} نطاق`);
    
    chrome.runtime.sendMessage({ 
      action: 'completed',
      domains: uniqueDomains.length,
      pages: currentPage
    });
    
    window.domainExtractorRunning = false;
    isProcessing = false;
  }

  function updateStats() {
    chrome.runtime.sendMessage({ 
      action: 'updateStats',
      domains: allDomains.length,
      pages: currentPage
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'stop') {
      shouldStop = true;
      console.log('⏹️ إيقاف...');
      if (!isProcessing) {
        downloadDomains();
      }
    }
  });

  console.log('🚀 بدء الاستخراج...');
  extractDomainsFromCurrentPage();
})();