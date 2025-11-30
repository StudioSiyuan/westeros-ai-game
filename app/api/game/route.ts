import { z } from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { gameState, action, locationName } = await req.json();
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) return new Response(JSON.stringify({ error: "No API Key" }), { status: 500 });

  // 1. 构造提示词
  const systemPrompt = `
    你是一款《权力的游戏》(冰与火之歌) 文字RPG的 DM。
    
    【当前信息】
    地点: ${locationName}
    坐标: [${gameState.position.x}, ${gameState.position.y}]
    HP: ${gameState.hp}, 精力: ${gameState.energy}
    物品: ${gameState.inventory.join(', ')}
    
    【玩家行动】
    "${action}"
    
    【任务】
    生成一段简短的剧情（50字以内），并给出3个后续选项。
    如果地点是"临冬城"、"君临"等名城，请描述对应的繁华或破败景象。
    如果精力<10，提示玩家疲惫。
    
    请严格只输出纯 JSON 格式（不要Markdown标记）：
    {
      "scene_text": "剧情内容...",
      "location": "${locationName}",
      "hp_change": 0,
      "energy_change": 0,
      "item_gained": null,
      "choices": [
        { "title": "选项1", "desc": "...", "risk": "low" },
        { "title": "选项2", "desc": "...", "risk": "high" },
        { "title": "选项3", "desc": "...", "risk": "high" }
      ]
    }
  `;

  try {
    // 2. 核心修改：使用 gemini-2.0-flash (这是你列表里有的模型)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Google报错:", errText);
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;
    
    // 清理 JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return Response.json(JSON.parse(text));

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "连接失败" }), { status: 500 });
  }
}