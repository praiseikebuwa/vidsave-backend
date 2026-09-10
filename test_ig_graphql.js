const axios = require('axios');

async function testIgGraphQL(shortcode) {
  console.log('Testing GraphQL for shortcode:', shortcode);

  const hashes = [
    'b3755487065fc2a5b32233f2c5e59b66',
    '2c52e460471b696f8c7b8a7c2c9d7499',
    '17888483320006908'
  ];

  for (const hash of hashes) {
    try {
      const url = `https://www.instagram.com/graphql/query/?query_hash=${hash}&variables=${encodeURIComponent(JSON.stringify({ shortcode }))}`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'X-IG-App-ID': '936619743392459'
        },
        timeout: 6000
      });
      console.log(`Hash ${hash} Status:`, res.status);
      if (res.data && res.data.data && res.data.data.shortcode_media) {
        const media = res.data.data.shortcode_media;
        console.log('  Video URL:', media.video_url ? media.video_url.substring(0, 100) : 'NONE');
        console.log('  Display URL:', media.display_url ? media.display_url.substring(0, 100) : 'NONE');
        return;
      }
    } catch (err) {
      console.log(`Hash ${hash} Error:`, err.message);
    }
  }
}

testIgGraphQL('DdErmMsAXHZ');
testIgGraphQL('DdGndsDjnQ5');
