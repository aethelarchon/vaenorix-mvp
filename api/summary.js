export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  // ১. URL ভ্যালিডেশন ও SSRF প্রোটেকশন
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
    const hostname = parsedUrl.hostname.toLowerCase();
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
    // ২. Timeout (৮ সেকেন্ড)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Vaenorix-Summary-Bot/1.0' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch the URL' });
    }

    // ৩. রেসপন্স সাইজ লিমিট (সর্বোচ্চ ১MB)
    let html = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedLength = 0;
    
    while(true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedLength += value.length;
      html += decoder.decode(value, { stream: true });
      if (receivedLength > 1024 * 1024) { // 1MB Limit
        break;
      }
    }

    // ৪. HTML থেকে শুধু টেক্সট বের করা এবং লিমিট করা
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 3000);
    
    if (text.length < 100) {
       return res.status(400).json({ error: 'Not enough text to summarize' });
    }

    // ৫. HuggingFace API কল
    const hfResponse = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-cnn', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          max_length: 100,
          min_length: 30
        }
      })
    });
    
    const data = await hfResponse.json();
    
    // HuggingFace যদি লোডিং অবস্থায় থাকে (মডেল লোড হতে সময় লাগে)
    if (data.error && data.error.includes('currently loading')) {
       return res.status(503).json({ error: 'AI model is loading, please try again in 20 seconds' });
    }

    const summary = data[0]?.summary_text || 'Could not generate summary';
    
    res.status(200).json({ summary });
  } catch (error) {
    console.error('Summary error:', error);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    res.status(500).json({ error: 'Failed to generate summary' });
  }
        }
