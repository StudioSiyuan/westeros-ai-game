import { z } from 'zod';

export const maxDuration = 60;

// 定义我们想要的数据格式（用于提示词）
const schemaDescription = `
请严格输出纯 JSON 格式，不要包含 Markdown 标记（如 \`\`\`json）。
JSON 结构如下：
{
  "scene_text": "剧情描述字符串",
  "location": "地点字符串",
  "hp_change": 数字(负数扣血),
  "energy_change": 数字(负数扣精),
  "item_gained": "物品名(可选)",
  "item_lost": "物品名(可选)",
  "choices": [
    { "title": "选项1", "desc": "描述", "risk": "low"或"high" },
    { "title": "选项2", "desc": "描述", "risk": "low"或"high" },
    { "title": "选项3", "desc": "描述", "risk": "low"或"high" }
  ]
}
`;

export async function POST(req: Request) {
  const { gameState, action } = await req.json();
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: "后端没找到 Key" }), { status: 500 });
  }

  // 1. 构造提示词
  const systemPrompt = `
    你是一款《权力的游戏》背景生存游戏DM。
    玩家状态: HP:${gameState.hp}, 精力:${gameState.energy}, 物品:${gameState.inventory.join(',')}, 前情:${gameState.history.slice(-500)}
    玩家行动: "${action}"
    
    请推演后果。如果玩家做蠢事，请给予惩罚。
    ${schemaDescription}
  `;

  try {
    // 2. 直接向 Google 发送 HTTP 请求 (绕过所有 SDK 兼容性问题)
    // 使用 gemini-1.5-flash，这是最稳的模型
    // 把原来的 1.5 改成 2.0，这是你列表里明确存在的模型
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemPrompt }]
        }],
        generationConfig: {
          response_mime_type: "application/json" // 强制 Google 返回 JSON
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Google API 报错:", errorData);
      throw new Error(`Google API Error: ${response.status}`);
    }

    const data = await response.json();
    
    // 3. 解析结果
    const text = data.candidates[0].content.parts[0].text;
    // 清理可能的 Markdown 标记
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    return Response.json(result);

  } catch (error: any) {
    console.error("处理失败:", error);
    return new Response(JSON.stringify({ error: "连接断开，请重试" }), { status: 500 });
  }
}