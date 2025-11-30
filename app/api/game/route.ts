import { z } from 'zod';

export const maxDuration = 60;

export async function POST(req: Request) {
  const { gameState, action, mapInfo } = await req.json(); // 接收 mapInfo
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) return new Response(JSON.stringify({ error: "No API Key" }), { status: 500 });

  // 这里的 Prompt 更加侧重环境生成
  const systemPrompt = `
    你是一款《权力的游戏》背景的 Roguelike 生存游戏 DM。
    
    【玩家状态】
    HP:${gameState.hp}, 精力:${gameState.energy}
    当前坐标: [${gameState.position.x}, ${gameState.position.y}]
    地形类型: ${mapInfo.biome} (例如: 森林/废墟/城堡/河流)
    
    【玩家行动】
    "${action}"
    
    【任务】
    请生成这一格发生的事件。
    1. 如果是第一次进入该坐标，生成一个环境描述 + 随机遭遇（敌人/宝物/NPC）。
    2. 如果是"搜索"，生成获得物品或遭遇陷阱的结果。
    3. 必须简短有力（100字以内）。
    
    请严格输出 JSON:
    {
      "scene_text": "剧情描述",
      "location": "地点名 (如: 黑暗森林深处)",
      "hp_change": 数字,
      "energy_change": 数字,
      "item_gained": "物品名" 或 null,
      "enemy_encountered": boolean (是否遇到敌人),
      "choices": [
        { "title": "搜索区域", "desc": "消耗精力寻找物资", "risk": "low" },
        { "title": "原地休息", "desc": "恢复少量体力", "risk": "low" },
        { "title": "设下陷阱", "desc": "防御潜在敌人", "risk": "high" }
      ]
    }
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
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