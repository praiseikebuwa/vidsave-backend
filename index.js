const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'VidSave Media Extraction Backend',
    version: '1.2.0',
    endpoints: {
      download: '/api/download?url=<MEDIA_URL>'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 1. TikTok Extractor (TikWM)
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

// 2. Instagram Extractor with Multi-Engine Pipeline (Video & Photo/Carousel Support)
async function extractInstagram(url) {
  const cleanUrl = url.split('?')[0].replace('/reels/', '/reel/');

  // Engine 1: Instagram Embed HTML Scraper
  try {
    const embedUrl = cleanUrl.endsWith('/') ? `${cleanUrl}embed/captioned/` : `${cleanUrl}/embed/captioned/`;
    const response = await axios.get(embedUrl, { headers: HTTP_HEADERS, timeout: 8000 });
    if (response.status === 200 && response.data) {
      const html = response.data.toString();
      const videoMatch = html.match(/class="EmbeddedVideo"[^>]*src="([^"]+)"/) ||
                         html.match(/<video[^>]*src="([^"]+)"/) ||
                         html.match(/"video_url":"([^"]+)"/);
      const thumbMatch = html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/) ||
                         html.match(/<img[^>]*src="([^"]+)"/);

      if (videoMatch && videoMatch[1]) {
        const videoUrl = videoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
        if (videoUrl && videoUrl !== url) {
          const thumbUrl = thumbMatch ? thumbMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '') : '';
          return {
            success: true,
            platform: 'Instagram',
            title: 'Instagram Video',
            author: '@Instagram Creator',
            thumbnail: thumbUrl || 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
            url: videoUrl
          };
        }
      } else if (thumbMatch && thumbMatch[1]) {
        const thumbUrl = thumbMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
        if (thumbUrl && thumbUrl !== url) {
          return {
            success: true,
            platform: 'Instagram',
            title: 'Instagram Photo',
            author: '@Instagram Creator',
            thumbnail: thumbUrl,
            url: thumbUrl,
            image_urls: [thumbUrl]
          };
        }
      }
    }
  } catch (err) {
    console.error('Instagram embed error:', err.message);
  }

  // Engine 2: InstaFix / DDInstagram OpenGraph Proxy
  try {
    const target = url.replace('instagram.com', 'ddinstagram.com');
    const ddRes = await axios.get(target, {
      headers: { 'User-Agent': 'TelegramBot (like TwitterBot)', 'Accept': 'text/html' },
      timeout: 8000
    });
    if (ddRes.status === 200 && ddRes.data) {
      const html = ddRes.data.toString();
      const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/) ||
                         html.match(/<meta property="og:video:secure_url" content="([^"]+)"/);
      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);

      if (videoMatch && videoMatch[1] && videoMatch[1] !== url) {
        return {
          success: true,
          platform: 'Instagram',
          title: 'Instagram Video',
          author: '@Instagram Creator',
          thumbnail: imageMatch ? imageMatch[1] : 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
          url: videoMatch[1]
        };
      } else if (imageMatch && imageMatch[1] && imageMatch[1] !== url) {
        return {
          success: true,
          platform: 'Instagram',
          title: 'Instagram Photo',
          author: '@Instagram Creator',
          thumbnail: imageMatch[1],
          url: imageMatch[1],
          image_urls: [imageMatch[1]]
        };
      }
    }
  } catch (err) {
    console.error('DDInstagram error:', err.message);
  }

  // Engine 3: Direct OpenGraph Web Scraper (fallback for IG post links)
  try {
    const ogRes = await axios.get(cleanUrl, { headers: HTTP_HEADERS, timeout: 8000 });
    if (ogRes.status === 200 && ogRes.data) {
      const html = ogRes.data.toString();
      const videoMatch = html.match(/<meta property="og:video" content="([^"]+)"/) ||
                         html.match(/<meta property="og:video:secure_url" content="([^"]+)"/);
      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/) ||
                         html.match(/<meta name="twitter:image" content="([^"]+)"/);
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/) ||
                        html.match(/<meta name="description" content="([^"]+)"/);

      const title = titleMatch ? titleMatch[1].replace(/&quot;/g, '"') : 'Instagram Content';
      const author = descMatch ? (descMatch[1].split(' ')[0] || '@Instagram Creator') : '@Instagram Creator';

      if (videoMatch && videoMatch[1] && videoMatch[1] !== url) {
        return {
          success: true,
          platform: 'Instagram',
          title: title,
          author: author,
          thumbnail: imageMatch ? imageMatch[1] : 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
          url: videoMatch[1]
        };
      } else if (imageMatch && imageMatch[1] && imageMatch[1] !== url) {
        const imgUrl = imageMatch[1].replace(/&amp;/g, '&');
        return {
          success: true,
          platform: 'Instagram',
          title: title,
          author: author,
          thumbnail: imgUrl,
          url: imgUrl,
          image_urls: [imgUrl]
        };
      }
    }
  } catch (err) {
    console.error('Instagram OpenGraph error:', err.message);
  }

  // Engine 4: FastDL Public API Endpoint
  try {
    const fastDlRes = await axios.post('https://v3.fastdl.app/api/convert', { url }, {
      headers: { 'Content-Type': 'application/json', 'User-Agent': HTTP_HEADERS['User-Agent'] },
      timeout: 8000
    });
    if (fastDlRes.data && fastDlRes.data.url && Array.isArray(fastDlRes.data.url) && fastDlRes.data.url.length > 0) {
      const mediaItem = fastDlRes.data.url[0];
      if (mediaItem && mediaItem.url && mediaItem.url !== url) {
        return {
          success: true,
          platform: 'Instagram',
          title: 'Instagram Content',
          author: '@Instagram Creator',
          thumbnail: 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
          url: mediaItem.url
        };
      }
    }
  } catch (err) {
    console.error('FastDL error:', err.message);
  }

  return null;
}

// 3. YouTube Extractor with Multi-Instance Cluster & oEmbed Fallback
async function extractYouTube(url) {
  const ytRegExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{4,15})/;
  const match = url.match(ytRegExp);
  const videoId = match ? match[1] : '';
  const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png';

  if (videoId) {
    // Engine 1: Invidious Instances Cluster
    const invidiousInstances = [
      `https://inv.tux.pizza/api/v1/videos/${videoId}`,
      `https://invidious.nerdvpn.de/api/v1/videos/${videoId}`,
      `https://invidious.drgns.space/api/v1/videos/${videoId}`
    ];
    for (const inst of invidiousInstances) {
      try {
        const res = await axios.get(inst, { headers: HTTP_HEADERS, timeout: 8000 });
        if (res.status === 200 && res.data && res.data.formatStreams) {
          const streams = res.data.formatStreams;
          const bestStream = streams[streams.length - 1];
          if (bestStream && bestStream.url) {
            return {
              success: true,
              platform: 'YouTube',
              title: res.data.title || 'YouTube Video',
              author: res.data.author || 'YouTube Channel',
              thumbnail: thumbnail,
              url: bestStream.url
            };
          }
        }
      } catch (_) {}
    }

    // Engine 2: Piped Instances Cluster
    const pipedInstances = [
      `https://api.piped.video/streams/${videoId}`,
      `https://pipedapi.kavin.rocks/streams/${videoId}`
    ];
    for (const inst of pipedInstances) {
      try {
        const res = await axios.get(inst, { headers: HTTP_HEADERS, timeout: 8000 });
        if (res.status === 200 && res.data && res.data.videoStreams) {
          const streams = res.data.videoStreams;
          const bestStream = streams.find(s => s.videoOnly === false) || streams[0];
          if (bestStream && bestStream.url) {
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
        }
      } catch (_) {}
    }
  }

  // Engine 3: YouTube Official oEmbed API (Guaranteed Title, Creator & Thumbnail)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await axios.get(oembedUrl, { timeout: 8000 });
    if (res.status === 200 && res.data) {
      const title = res.data.title || 'YouTube Content';
      const author = res.data.author_name || 'YouTube Creator';
      const thumb = res.data.thumbnail_url || thumbnail;
      return {
        success: true,
        platform: 'YouTube',
        title: title,
        author: author,
        thumbnail: thumb,
        url: url,
      };
    }
  } catch (err) {
    console.error('YouTube oEmbed error:', err.message);
  }

  return null;
}

// 4. Facebook Extractor
async function extractFacebook(url) {
  try {
    const res = await axios.get(url, { headers: HTTP_HEADERS, timeout: 8000 });
    if (res.status === 200 && res.data) {
      const html = res.data.toString();
      const sdMatch = html.match(/sd_src\s*:\s*"([^"]+)"/) || html.match(/browser_native_sd_url\s*:\s*"([^"]+)"/);
      const hdMatch = html.match(/hd_src\s*:\s*"([^"]+)"/) || html.match(/browser_native_hd_url\s*:\s*"([^"]+)"/);

      const videoUrl = hdMatch ? hdMatch[1] : (sdMatch ? sdMatch[1] : null);
      if (videoUrl) {
        return {
          success: true,
          platform: 'Facebook',
          title: 'Facebook Video',
          author: 'Facebook Creator',
          thumbnail: 'https://cdn-icons-png.flaticon.com/512/124/124010.png',
          url: videoUrl.replace(/\\/g, '')
        };
      }
    }
  } catch (err) {
    console.error('Facebook extraction error:', err.message);
  }
  return null;
}

// 5. Multi-Instance Cobalt Extractor Network
async function extractCobalt(url, platformHint = 'Social Media') {
  const endpoints = [
    'https://co.wuk.sh/api/json',
    'https://api.cobalt.tools/',
    'https://saon.top/api/'
  ];

  for (const ep of endpoints) {
    try {
      const res = await axios.post(ep, { url }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': HTTP_HEADERS['User-Agent']
        },
        timeout: 10000
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
        } else if ((data.url || data.stream) && (data.url !== url && data.stream !== url)) {
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
  } else if (targetUrl.includes('facebook.com') || targetUrl.includes('fb.watch')) {
    result = await extractFacebook(targetUrl);
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

  if (result && (result.url || (result.image_urls && result.image_urls.length > 0))) {
    return res.json(result);
  }

  return res.status(422).json({
    success: false,
    error: 'Could not extract direct media download URL for this link. Please check the URL or try another link.'
  });
}

app.get('/api/download', handleDownloadRequest);
app.post('/api/download', handleDownloadRequest);

app.listen(PORT, () => {
  console.log(`🚀 VidSave Backend Server v1.2.0 running on port ${PORT}`);
});
