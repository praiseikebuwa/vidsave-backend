const axios = require('axios');
const cheerio = require('cheerio');

async function testDdIg(shortcode) {
  console.log('\n--- Testing shortcode:', shortcode);
  const userAgents = [
    'TelegramBot (like TwitterBot)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Twitterbot/1.0'
  ];

  for (const ua of userAgents) {
    try {
      const url = `https://ddinstagram.com/reel/${shortcode}/`;
      console.log(`Trying UA "${ua.substring(0, 20)}" at ${url}`);
      const res = await axios.get(url, {
        headers: { 'User-Agent': ua, 'Accept': 'text/html' },
        timeout: 5000
      });
      console.log('  Status:', res.status, 'HTML len:', res.data.length);
      const $ = cheerio.load(res.data);
      const video = $('meta[property="og:video"]').attr('content') || $('meta[property="og:video:secure_url"]').attr('content');
      const image = $('meta[property="og:image"]').attr('content');
      console.log('  OG Video:', video ? video.substring(0, 100) : 'NONE');
      console.log('  OG Image:', image ? image.substring(0, 100) : 'NONE');
      if (video || image) break;
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
}

testDdIg('DdErmMsAXHZ');
testDdIg('DdGndsDjnQ5');
