import axios from 'axios';
import('dotenv/config').then(async () => {
  try {
    const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
      model: 'meta/llama-3.3-70b-instruct',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
      }
    });
    console.log('SUCCESS:', response.data.choices[0].message.content);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
  }
});
