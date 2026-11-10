export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // ১. URL ভ্যালিডেশন ও SSRF প্রোটেকশন
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    // শুধুমাত্র http এবং https অ্যালাউ করা হবে
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
    
    const hostname = parsedUrl.hostname.toLowerCase();
    // লোকালহোস্ট এবং ইন্টারনাল আইপি ব্লক করা
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new Error('Access to internal network is not allowed');
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid or unsafe URL' });
  }

  try {
    // ২. Timeout (৫ সেকেন্ড) সেট করা
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vaenorix-Preview-Bot/1.0'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch the URL' });
    }

    // ৩. রেসপন্স সাইজ লিমিট (সর্বোচ্চ ৫০০KB পড়বে)
    let html = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedLength = 0;
    
    while(true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedLength += value.length;
      html += decoder.decode(value, { stream: true });
      if (receivedLength > 500 * 1024) { // 500KB Limit
        break;
      }
    }
    
    // ৪. মেটা ট্যাগ এক্সট্রাক্ট করা
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : url;
    
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1] : 'No description available';
    
    const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
    const image = imageMatch ? imageMatch[1] : null;
    
    res.status(200).json({ title, description, image, url });
  } catch (error) {
    console.error('Preview error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    res.status(500).json({ error: 'Failed to fetch preview' });
  }
      }
