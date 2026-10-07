export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  // Vercel Environment Variable থেকে Key নেবে
  const apiKey = process.env.IMGBB_API_KEY; 

  const formData = new FormData();
  formData.append('image', image);

  try {
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
                                 }
