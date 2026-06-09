import Cerebras from '@cerebras/cerebras_cloud_sdk';

const client = new Cerebras({ apiKey: 'csk-6yvexm49hhkrrp83e5dtmyf3n8vwhymh4vpvmff5ydxyvhmv' });

try {
  const completion = await client.chat.completions.create({
    model: 'gpt-oss-120b',
    messages: [{ role: 'user', content: 'Say hello in one word.' }],
    max_tokens: 2048
  });
  console.log('SUCCESS');
  console.log('Full choice:', JSON.stringify(completion.choices[0], null, 2));
  console.log('Tokens used:', completion.usage?.total_tokens);
  console.log('Time to first token (ms):', completion.time_info?.queue_time);
} catch (e) {
  console.error('FAILED:', e.message);
}
