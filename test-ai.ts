import OpenAI from 'openai';
const client = new OpenAI({
  baseURL: process.env.AI_BASE_URL,
  apiKey: process.env.AI_API_KEY,
});
async function test() {
  try {
    const res = await client.chat.completions.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'hi' }],
    });
    console.log('成功:', res.choices[0].message.content);
  } catch (err: any) {
    console.log('失败:', err.message);
    console.log('详情:', JSON.stringify(err.error || err, null, 2));
  }
}
test();
