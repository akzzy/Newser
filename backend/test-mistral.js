import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("No API key");
    
    const client = new Mistral({ apiKey });
    console.log("Testing mistral-medium-2508...");
    
    const res = await client.chat.complete({
      model: 'mistral-medium-2508',
      messages: [{ role: 'user', content: 'Say hi' }]
    });
    
    console.log("Success:", res.choices[0].message.content);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
