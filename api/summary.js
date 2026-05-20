export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url);
    const html = await response.text();
    
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
    
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
    const summary = data[0]?.summary_text || 'Could not generate summary';
    
    res.status(200).json({ summary });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
                              }
