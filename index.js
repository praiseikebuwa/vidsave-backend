const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'VidSave Media Extraction Backend',
    version: '1.0.0',
    endpoints: {
      download: '/api/download?url=<MEDIA_URL>'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// TikTok Extractor
async function extractTikTok(url) {
  try {
    const response = await axios.get('https://www.tikwm.com/api/', {
      params: { url },
      headers: HTTP_HEADERS,
      timeout: 10000
    });
    if (response.data && response.data.code === 0 && response.data.data) {
      const data = response.data.data;
      return {
        success: true,
        platform: 'TikTok',
        title: data.title || 'TikTok Content',
        author: data.author ? data.author.nickname : 'Unknown Creator',
        thumbnail: data.cover || '',
        url: data.play || '',
        hd_url: data.hdplay || null,
        audio_url: data.music || null,
        image_urls: Array.isArray(data.images) ? data.images : null
      };
    }
  } catch (err) {
    console.error('TikTok extraction error:', err.message);
  }
  return null;
}

// Instagram Extractor
async function extractInstagram(url) {
  try {
    const cleanUrl = url.split('?')[0];
    const embedUrl = cleanUrl.endsWith('/') ? `${cleanUrl}embed/captioned/` : `${cleanUrl}/embed/captioned/`;
    const response = await axios.get(embedUrl, { headers: HTTP_HEADERS, timeout: 10000 });
    if (response.status === 200 && response.data) {
      const html = response.data.toString();
      const $ = cheerio.load(html);
      const videoSrc = $('video.EmbeddedVideo').attr('src') || $('video').attr('src');
      const imgSrc = $('img.EmbeddedMediaImage').attr('src') || $('img').attr('src');

      if (videoSrc) {
        return {
          success: true,
          platform: 'Instagram',
          title: 'Instagram Post / Reel',
          author: '@Instagram Creator',
          thumbnail: imgSrc || 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
          url: videoSrc.replace(/\\u0026/g, '&')
        };
      }
    }
  } catch (err) {
    console.error('Instagram embed extraction error:', err.message);
  }
  return null;
}

// YouTube Extractor
async function extractYouTube(url) {
  const ytRegExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = url.match(ytRegExp);
  const videoId = match ? match[1] : '';
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png';

  if (videoId) {
    const pipedInstances = [
      `https://api.piped.video/streams/${videoId}`,
      `https://pipedapi.kavin.rocks/streams/${videoId}`
    ];
    for (const inst of pipedInstances) {
      try {
        const res = await axios.get(inst, { headers: HTTP_HEADERS, timeout: 10000 });
        if (res.status === 200 && res.data && res.data.videoStreams) {
          const streams = res.data.videoStreams;
          const bestStream = streams.find(s => s.videoOnly === false) || streams[0];
          return {
            success: true,
            platform: 'YouTube',
            title: res.data.title || 'YouTube Video',
            author: res.data.uploader || 'YouTube Creator',
            thumbnail: res.data.thumbnailUrl || thumbnail,
            url: bestStream.url,
            audio_url: res.data.audioStreams && res.data.audioStreams.length ? res.data.audioStreams[0].url : null
          };
        }
      } catch (_) {}
    }
  }
  return null;
}

// Multi-Instance Cobalt Extractor
async function extractCobalt(url, platformHint = 'Social Media') {
  const endpoints = [
    'https://co.wuk.sh/api/json',
    'https://api.cobalt.tools/',
    'https://saon.top/api/'
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.post(ep, { url, vQuality: 'max' }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': HTTP_HEADERS['User-Agent']
        },
        timeout: 12000
      });

      if (res.status === 200 && res.data) {
        const data = res.data;
        if (data.status === 'picker' && Array.isArray(data.picker)) {
          const imageUrls = data.picker.map(item => item.url);
          return {
            success: true,
            platform: platformHint,
            title: `${platformHint} Gallery`,
            author: `${platformHint} Creator`,
            thumbnail: imageUrls[0],
            url: imageUrls[0],
            image_urls: imageUrls
          };
        } else if (data.url || data.stream) {
          return {
            success: true,
            platform: platformHint,
            title: `${platformHint} Content`,
            author: `${platformHint} Creator`,
            thumbnail: 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
            url: data.url || data.stream
          };
        }
      }
    } catch (_) {}
  }
  return null;
}

// Universal Extractor Endpoint (GET & POST)
async function handleDownloadRequest(req, res) {
  const targetUrl = (req.query.url || req.body.url || '').toString().trim();
  if (!targetUrl) {
    return res.status(400).json({ success: false, error: 'Parameter "url" is required.' });
  }

  let result = null;
  if (targetUrl.includes('tiktok.com')) {
    result = await extractTikTok(targetUrl);
  } else if (targetUrl.includes('instagram.com')) {
    result = await extractInstagram(targetUrl);
  } else if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
    result = await extractYouTube(targetUrl);
  }

  if (!result) {
    const platform = targetUrl.includes('tiktok.com') ? 'TikTok'
      : targetUrl.includes('instagram.com') ? 'Instagram'
      : targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be') ? 'YouTube'
      : targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch') ? 'Facebook'
      : targetUrl.includes('twitter.com') || targetUrl.includes('x.com') ? 'Twitter'
      : 'Media';

    result = await extractCobalt(targetUrl, platform);
  }

  if (result && result.url) {
    return res.json(result);
  }

  // Generic fallback response
  return res.json({
    success: true,
    platform: 'Media',
    title: 'Extracted Content',
    author: 'Creator',
    thumbnail: 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
    url: targetUrl
  });
}

app.get('/api/download', handleDownloadRequest);
app.post('/api/download', handleDownloadRequest);

app.listen(PORT, () => {
  console.log(`🚀 VidSave Backend Server running on port ${PORT}`);
});
