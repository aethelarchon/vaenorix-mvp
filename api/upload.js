export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ১. Authorization হেডার চেক করা
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  
  const token = authHeader.split('Bearer ')[1];

  // ২. Firebase ID Token ভেরিফাই করা (REST API দিয়ে)
  // নোট: index.html এ যে API key আছে, সেটাই এখানে ব্যবহার করা হচ্ছে
  const firebaseApiKey = "AIzaSyB4SxkLnozpPFv7O_jGljLvNXQW-Lbnapc"; 
  
  try {
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyData.users || verifyData.users.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }

  // ৩. ইমেজ ডেটা চেক ও সাইজ লিমিট (সর্বোচ্চ ২MB)
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image is required' });
  }

  // Base64 স্ট্রিং থেকে আনুমানিক সাইজ বের করা (১ ক্যারেক্টার ≈ ০.৭৫ বাইট)
  const sizeInBytes = image.length * 0.75;
  if (sizeInBytes > 2 * 1024 * 1024) { // 2MB
    return res.status(413).json({ error: 'Image is too large. Maximum size is 2MB.' });
  }

  // ৪. ImgBB API Key চেক
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ImgBB API key not configured on server' });
  }

  // ৫. ImgBB-তে আপলোড করা
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
