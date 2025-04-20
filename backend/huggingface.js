// huggingface.js
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));


const HF_API_KEY = process.env.HF_API_KEY;

// async function extractEntities(text) {
//   const response = await fetch('https://api-inference.huggingface.co/models/dbmdz/bert-large-cased-finetuned-conll03-english', {
//     method: 'POST',
//     headers: {
//       'Authorization': `Bearer ${HF_API_KEY}`,
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({ inputs: text })
//   });

//   const data = await response.json();
//   return data;
// }
async function extractEntities(text) {
    const response = await fetch('https://api-inference.huggingface.co/models/dbmdz/bert-large-cased-finetuned-conll03-english', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text })
    });
  
    const raw = await response.text();
    console.log('🪵 Hugging Face Raw Response:', raw);
  
    try {
      const data = JSON.parse(raw);
      return data;
    } catch (err) {
      console.error('❌ Failed to parse JSON from Hugging Face:', err);
      throw new Error('Hugging Face API response is not JSON. Check your API key and endpoint.');
    }
  }
  
module.exports = { extractEntities };
