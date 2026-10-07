export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  const apiKey = process.env.IMGBB_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'ImgBB API key not configured' });
  }

  const formData = new URLSearchParams();
  formData.append('image', image);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const data = await response.json();
    
    if (!data.success) {
         return res.status(400).json({ error: data.error?.message || 'ImgBB upload failed' });
    }
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
  }
