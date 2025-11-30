'use client';

import { useState, useEffect } from 'react';

// --- 纯文本维斯特洛地图 ---
const WORLD_MAP = [
  ['鬼影森林', '绝境长城', '黑城堡',   '颤抖海',   '永冬之地'],
  ['冰湾',     '狼林',     '临冬城',   '恐怖堡',   '狭海'],
  ['铁群岛',   '凯岩城',   '三叉戟河', '鹰巢城',   '狭海'],
  ['落日之海', '河湾地',   '君临城',   '黑水湾',   '龙石岛'],
  ['落日之海', '高庭',     '赤红山脉', '多恩阳戟', '夏日之海']
];

const GRID_SIZE = 5;

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  
  // 初始状态
  const [state, setState] = useState({
    hp: 100,
    energy: 100,
    inventory: ["诏书"],
    position: { x: 2, y: 1 }, // 临冬城
    visited: ["2-1"], 
    history: ""
  });

  const [text, setText] = useState("你站在临冬城的城墙上，看着国王的队伍远去。凛冬将至。");
  const [choices, setChoices] = useState([
    { title: "城内打听", desc: "寻找机会", risk: "low" },
    { title: "前往狼林", desc: "狩猎", risk: "high" }
  ]);

  const getCurrentLocationName = (x: number, y: number) => {
    return WORLD_MAP[y][x];
  };

  async function movePlayer(dx: number, dy: number) {
    if (loading) return;
    const newX = state.position.x + dx;
    const newY = state.position.y + dy;

    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) return;

    const posKey = `${newX}-${newY}`;
    const locationName = getCurrentLocationName(newX, newY);
    
    const newState = {
      ...state,
      position: { x: newX, y: newY },
      energy: Math.max(0, state.energy - 10),
      visited: !state.visited.includes(posKey) ? [...state.visited, posKey] : state.visited
    };

    setState(newState);
    await triggerAI(newState, `抵达了 ${locationName}`, locationName);
  }

  async function handleChoice(choiceTitle: string) {
    const locName = getCurrentLocationName(state.position.x, state.position.y);
    await triggerAI(state, choiceTitle, locName);
  }

  async function triggerAI(currentState: any, action: string, locationName: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ 
          gameState: currentState, 
          action: action,
          locationName: locationName 
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setState(prev => ({
        ...prev,
        hp: Math.min(100, Math.max(0, prev.hp + (data.hp_change || 0))),
        energy: Math.min(100, Math.max(0, prev.energy + (data.energy_change || 0))),
        inventory: data.item_gained ? [...prev.inventory, data.item_gained] : prev.inventory
      }));

      setText(data.scene_text);
      setChoices(data.choices || []);
    } catch (e) {
      // 纯文本风格的报错
      setText(">> 系统错误: 与旧神失去连接。请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-gray-300 font-mono p-4 flex flex-col items-center leading-relaxed">
      
      {/* 1. 顶部状态栏 (纯文字) */}
      <div className="w-full max-w-lg border border-gray-700 p-2 mb-4 text-xs md:text-sm grid grid-cols-3 gap-2">
        <div>HP: {state.hp}/100</div>
        <div className="text-center">ENG: {state.energy}/100</div>
        <div className="text-right">LOC: {getCurrentLocationName(state.position.x, state.position.y)}</div>
        <div className="col-span-3 border-t border-gray-800 pt-1 mt-1 text-gray-500">
          物品: {state.inventory.join(', ') || "无"}
        </div>
      </div>

      {/* 2. 纯字符地图 */}
      <div className="w-full max-w-lg border border-gray-700 p-4 mb-4 bg-gray-900/50">
        <div className="text-center text-gray-500 mb-2 text-xs">--- WESTEROS MAP ---</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
          {WORLD_MAP.map((row, y) => (
            row.map((name, x) => {
              const isPlayerHere = x === state.position.x && y === state.position.y;
              const isVisited = state.visited.includes(`${x}-${y}`);
              
              // 地图显示逻辑：
              // 玩家位置显示为 [ 我 ]
              // 去过的地方显示名称 [临冬]
              // 没去过的地方显示 [ ?? ]
              let content = " ?? ";
              let style = "text-gray-700 border-gray-800";

              if (isPlayerHere) {
                content = " 我 ";
                style = "text-white border-white bg-gray-800 font-bold";
              } else if (isVisited) {
                content = name.substring(0, 2); // 只取前两个字保持整齐
                style = "text-gray-400 border-gray-600";
              }

              return (
                <div key={`${x}-${y}`} className={`border ${style} text-[10px] md:text-xs h-10 flex items-center justify-center`}>
                  {content}
                </div>
              )
            })
          ))}
        </div>
        
        {/* 纯字符方向键 */}
        <div className="flex justify-center gap-4 mt-4 text-sm">
          <button onClick={() => movePlayer(0, -1)} disabled={loading} className="hover:text-white">[ 北 ]</button>
          <div className="flex gap-4">
            <button onClick={() => movePlayer(-1, 0)} disabled={loading} className="hover:text-white">[ 西 ]</button>
            <button onClick={() => movePlayer(1, 0)} disabled={loading} className="hover:text-white">[ 东 ]</button>
          </div>
          <button onClick={() => movePlayer(0, 1)} disabled={loading} className="hover:text-white">[ 南 ]</button>
        </div>
      </div>

      {/* 3. 剧情文本区域 */}
      <div className="w-full max-w-lg border-t border-b border-gray-700 py-6 mb-6 min-h-[150px]">
        {loading ? (
          <span className="animate-pulse">>> 正在推演命运...</span>
        ) : (
          <p className="whitespace-pre-wrap">{text}</p>
        )}
      </div>

      {/* 4. 选项列表 (纯文字列表) */}
      <div className="w-full max-w-lg space-y-2">
        {choices.map((c, i) => (
          <button
            key={i}
            onClick={() => handleChoice(c.title)}
            disabled={loading}
            className="w-full text-left border border-gray-800 hover:border-gray-500 hover:bg-gray-900 p-3 transition-colors group"
          >
            <span className="text-gray-500 group-hover:text-white mr-2">{i + 1}.</span>
            <span className="font-bold text-gray-300 group-hover:text-white">{c.title}</span>
            <span className="float-right text-xs text-gray-600 pt-1 group-hover:text-gray-400">
              [{c.risk === 'high' ? '高风险' : '安全'}]
            </span>
            <div className="text-xs text-gray-600 pl-5 mt-1 group-hover:text-gray-500">
              {c.desc}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 text-[10px] text-gray-700">
        v1.0 | TERMINAL_UI | ONLINE
      </div>
    </div>
  );
}