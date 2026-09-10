const axios = require('axios');
const cheerio = require('cheerio');

const testUrls = [
  'https://www.instagram.com/reels/DdErmMsAXHZ/',
  'https://www.instagram.com/p/DdGndsDjnQ5/',
];

async function runTests() {
  for (const url of testUrls) {
    console.log('\n====================================');
    console.log('Testing Instagram URL:', url);

    // 1. SnapInsta / FastDL scraper
    try {
      const form = new URLSearchParams();
      form.append('url', url);
      form.append('action', 'post');

      const res = await axios.post('https://snapinsta.app/action.php', form.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://snapinsta.app/'
        },
        timeout: 8000
      });
      if (res.data) {
        const $ = cheerio.load(res.data);
        const downloadBtn = $('a[download]').attr('href') || $('a.btn-download').attr('href');
        const imgThumb = $('img.card-img-top').attr('src');
        console.log('1. SnapInsta Download URL:', downloadBtn ? downloadBtn.substring(0, 100) : 'NONE');
        console.log('   SnapInsta Thumb:', imgThumb ? imgThumb.substring(0, 100) : 'NONE');
      }
    } catch (e) {
      console.log('1. SnapInsta Error:', e.message);
    }

    // 2. InstaVideoSave endpoint
    try {
      const res = await axios.get(`https://instavideosave.net/api/video?url=${encodeURIComponent(url)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      });
      if (res.data) {
        console.log('2. InstaVideoSave data:', JSON.stringify(res.data).substring(0, 200));
      }
    } catch (e) {
      console.log('2. InstaVideoSave Error:', e.message);
    }

    // 3. DDInstagram JSON API
    try {
      const shortcode = url.split('/p/')[1] || url.split('/reel/')[1] || url.split('/reels/')[1];
      const code = shortcode ? shortcode.split('/')[0].split('?')[0] : '';
      if (code) {
        const res = await axios.get(`https://api.ddinstagram.com/post/${code}`, {
          headers: { 'User-Agent': 'TelegramBot' },
          timeout: 8000
        });
        if (res.data) {
          console.log('3. DDInstagram API:', JSON.stringify(res.data).substring(0, 200));
        }
      }
    } catch (e) {
      console.log('3. DDInstagram Error:', e.message);
    }
  }
}

runTests();
