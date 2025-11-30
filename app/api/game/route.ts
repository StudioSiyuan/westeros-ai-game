import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

export const maxDuration = 60;

const gameSchema = z.object({
  scene_text: z.string().describe("剧情描述"),
  location: z.string().describe("地点"),
  hp_change: z.number().describe("生命变化"),
  energy_change: z.number().describe("精力变化"),
  item_gained: z.string().optional().describe("获得物品"),
  item_lost: z.string().optional().describe("失去物品"),
  choices: z.array(z.object({
    title: z.string(),
    desc: z.string(),
    risk: z.enum(['low', 'high', 'extreme'])
  })).length(3)
});

export async function POST(req: Request) {
  const { gameState, action } = await req.json();

  const systemPrompt = `
    你是一款《权力的游戏》背景生存游戏DM。
    玩家状态: HP:${gameState.hp}, 精力:${gameState.energy}, 物品:${gameState.inventory.join(',')}, 前情:${gameState.history.slice(-500)}
    玩家行动: "${action}"
    请推演后果。
  `;

  try {
    const result = await generateObject({
      model: google('gemini-pro'), // 使用 Google 模型，速度快且免费
      schema: gameSchema,
      prompt: systemPrompt,
    });
    return result.toJsonResponse();
  } catch (error) {
    console.error("AI Error:", error);
    return new Response(JSON.stringify({ error: "AI连接失败" }), { status: 500 });
  }
}