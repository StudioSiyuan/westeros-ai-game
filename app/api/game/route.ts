import { z } from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
  // 接收 locationName (具体的维斯特洛地名)
  const { gameState, action, locationName } = await req.json(); 
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) return new Response(JSON.stringify({ error: "No API Key" }), { status: 500 });

  const systemPrompt = `
    你是一款《权力的游戏》(冰与火之歌) 文字RPG的 DM。
    
    【当前剧情背景】
    玩家身处：${locationName}
    (坐标: [${gameState.position.x}, ${gameState.position.y}])
    玩家状态: HP ${gameState.hp}, 精力 ${gameState.energy}
    持有物品: ${gameState.inventory.join(', ')}
    
    【玩家行动】
    "${action}"
    
    【生成要求】
    1. **必须结合维斯特洛的地理设定**。
       - 如果在【临冬城】：涉及史塔克家族、寒冷、狼。
       - 如果在【君临】：涉及兰尼斯特、金袍子、肮脏的街道、政治阴谋。
       - 如果在【绝境长城】：涉及守夜人、异鬼传说。
       - 如果在【多恩】：涉及炎热、沙蛇、美酒。
    2. 只有在玩家选择"探索"或"移动"到新区域时，才描述环境。
    3. 风格冷酷写实，不要废话。
    
    请输出纯 JSON:
    {
      "scene_text": "剧情描述（中文）",
      "location": "${locationName}",
      "hp_change": 数字,
      "energy_change": 数字,
      "item_gained": "物品名" 或 null,
      "choices": [
        { "title": "选项1", "desc": "简短描述", "risk": "low" },
        { "title": "选项2", "desc": "简短描述", "risk": "high" },
        { "title": "选项3", "desc": "简短描述", "risk": "high" }
      ]
    }
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
      })
    });

    if (!response.ok) throw new Error("API Error");
    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return Response.json(JSON.parse(text));

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "API Error" }), { status: 500 });
  }
}