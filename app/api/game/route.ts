import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 30;

const gameSchema = z.object({
  scene_text: z.string().describe("剧情描述"),
  location: z.string().describe("当前地点"),
  hp_change: z.number().describe("生命值变化(负数扣血)"),
  energy_change: z.number().describe("精力变化(负数扣精)"),
  item_gained: z.string().optional().describe("获得的物品名"),
  item_lost: z.string().optional().describe("失去的物品名"),
  choices: z.array(z.object({
    title: z.string(),
    desc: z.string(),
    risk: z.enum(['low', 'high', 'extreme'])
  })).length(3)
});

export async function POST(req: Request) {
  const { gameState, action } = await req.json();

  const systemPrompt = `
    你是一款《权力的游戏》背景生存文字游戏DM。
    
    【玩家状态】
    HP:${gameState.hp}, 精力:${gameState.energy}
    地点:${gameState.location}
    物品:${gameState.inventory.join(', ')}
    前情:${gameState.history.slice(-500)}
    
    【玩家行动】
    "${action}"
    
    请推演后果。如果玩家做蠢事，请给予惩罚。
  `;

  try {
    const result = await generateObject({
      model: google('gemini-1.5-flash'),
      schema: gameSchema,
      prompt: systemPrompt,
    });
    return result.toJsonResponse();
  } catch (error) {
    return new Response(JSON.stringify({ error: "API Error" }), { status: 500 });
  }
}