'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, Map as MapIcon, Compass, Search, ShieldAlert, Skull } from 'lucide-react';

// --- 维斯特洛地图配置 ---
// 5x5 网格，对应维斯特洛大陆从北到南
// 符号：🧱长城 🐺临冬城 🦁凯岩城 🦅鹰巢城 👑君临 🌹高庭 ☀️多恩 🦑铁群岛
const WORLD_MAP = [
  ['🥶 鬼影森林', '🧱 绝境长城', '🏰 黑城堡',   '🌊 颤抖海',   '❄️ 永冬之地'],
  ['🌊 冰湾',     '🌲 狼林',     '🐺 临冬城',   '🏔️ 恐怖堡',   '🌊 狭海'],
  ['🦑 铁群岛',   '🦁 凯岩城',   '⚔️ 三叉戟河', '🦅 鹰巢城',   '🌊 狭海'],
  ['🌊 落日之海', '🌾 河湾地',   '👑 君临城',   '🚢 黑水湾',   '🐲 龙石岛'],
  ['🌊 落日之海', '🌹 高庭',     '🏜️ 赤红山脉', '☀️ 多恩阳戟', '🌊 夏日之海']
];

const GRID_SIZE = 5;

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  
  // 初始状态：玩家出生在 [2,1] 临冬城
  const [state, setState] = useState({
    hp: 100,
    energy: 100,
    inventory: ["国王劳勃的诏书"], // 开局道具
    position: { x: 2, y: 1 }, 
    visited: ["2-1"], 
    history: ""
  });

  const [text, setText] = useState("你站在临冬城的城墙上，看着国王的队伍远去。作为一名微不足道的侍从，你的命运即将改变。");
  const [choices, setChoices] = useState([
    { title: "在城内打听", desc: "寻找赚取路费的机会", risk: "low" },
    { title: "前往狼林狩猎", desc: "获取食物，但有危险", risk: "high" }
  ]);

  // --- 获取当前格子的具体地名 ---
  const getCurrentLocationName = (x: number, y: number) => {
    const raw = WORLD_MAP[y][x]; // 例如 "🐺 临冬城"
    return raw.split(' ')[1];    // 返回 "临冬城"
  };

  // --- 移动逻辑 ---
  async function movePlayer(dx: number, dy: number) {
    if (loading) return;
    
    const newX = state.position.x + dx;
    const newY = state.position.y + dy;

    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) return;

    // 某些地方无法进入（比如纯粹的大海），这里暂不限制，让AI处理落水剧情
    
    const posKey = `${newX}-${newY}`;
    const locationName = getCurrentLocationName(newX, newY);
    
    const newState = {
      ...state,
      position: { x: newX, y: newY },
      energy: Math.max(0, state.energy - 10), // 长途旅行消耗更多精力
      visited: !state.visited.includes(posKey) ? [...state.visited, posKey] : state.visited
    };

    setState(newState);
    
    // 触发 AI：传入地名
    await triggerAI(newState, `抵达了 ${locationName}`, locationName);
  }

  // --- 选项逻辑 ---
  async function handleChoice(choiceTitle: string) {
    const locName = getCurrentLocationName(state.position.x, state.position.y);
    await triggerAI(state, choiceTitle, locName);
  }

  // --- AI 交互 ---
  async function triggerAI(currentState: any, action: string, locationName: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ 
          gameState: currentState, 
          action: action,
          locationName: locationName // 关键：告诉AI我们在哪
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
      alert("连接断开");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-gray-300 font-sans p-4 flex flex-col items-center">
      
      {/* 顶部 HUD */}
      <div className="w-full max-w-md bg-gray-900 border-b-4 border-gray-800 p-4 mb-6 flex justify-between items-center shadow-lg">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Health</span>
          <span className="text-red-600 font-bold font-mono text-lg">{state.hp}</span>
        </div>
        <div className="flex flex-col text-center">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Location</span>
          <span className="text-yellow-600 font-bold text-lg">
            {getCurrentLocationName(state.position.x, state.position.y)}
          </span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Energy</span>
          <span className="text-blue-500 font-bold font-mono text-lg">{state.energy}</span>
        </div>
      </div>

      {/* --- 维斯特洛地图 --- */}
      <div className="relative bg-gray-900 p-2 rounded-lg border border-gray-800 shadow-2xl mb-6 select-none">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
          {WORLD_MAP.map((row, y) => (
            row.map((cellRaw, x) => {
              const [icon, name] = cellRaw.split(' ');
              const isPlayerHere = x === state.position.x && y === state.position.y;
              const isVisited = state.visited.includes(`${x}-${y}`);
              
              return (
                <div 
                  key={`${x}-${y}`}
                  className={`
                    w-14 h-14 md:w-16 md:h-16 flex flex-col items-center justify-center rounded cursor-help transition-all duration-300 relative
                    ${isPlayerHere ? 'bg-yellow-900/40 border border-yellow-600 z-10 scale-105' : 'bg-gray-800/50 border border-gray-800'}
                    ${!isVisited && !isPlayerHere ? 'opacity-30 blur-[1px]' : 'opacity-100'}
                  `}
                  title={name}
                >
                  <span className="text-2xl">{isPlayerHere ? '♟️' : icon}</span>
                  {/* 只在去过的地方或当前位置显示名字 */}
                  {(isVisited || isPlayerHere) && (
                    <span className="text-[8px] mt-1 text-gray-400 scale-75 whitespace-nowrap">{name}</span>
                  )}
                </div>
              )
            })
          ))}
        </div>

        {/* 移动控制 (覆盖在地图上层) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
           {/* 这里可以放一些特效，暂时留空 */}
        </div>
      </div>

      {/* 剧情与操作 */}
      <div className="w-full max-w-md space-y-4">
        
        {/* 控制板 */}
        <div className="flex justify-center gap-4 py-2 bg-gray-900/50 rounded-lg border border-gray-800">
          <button onClick={() => movePlayer(0, -1)} disabled={loading} className="w-12 h-12 bg-gray-800 rounded hover:bg-gray-700 active:bg-gray-600 text-xl border border-gray-700">⬆️</button>
          <div className="flex gap-2">
            <button onClick={() => movePlayer(-1, 0)} disabled={loading} className="w-12 h-12 bg-gray-800 rounded hover:bg-gray-700 active:bg-gray-600 text-xl border border-gray-700">⬅️</button>
            <button onClick={() => movePlayer(0, 1)} disabled={loading} className="w-12 h-12 bg-gray-800 rounded hover:bg-gray-700 active:bg-gray-600 text-xl border border-gray-700">⬇️</button>
            <button onClick={() => movePlayer(1, 0)} disabled={loading} className="w-12 h-12 bg-gray-800 rounded hover:bg-gray-700 active:bg-gray-600 text-xl border border-gray-700">➡️</button>
          </div>
        </div>

        <div className="bg-gray-900 p-5 rounded-lg border border-gray-800 min-h-[120px] shadow-inner">
          <AnimatePresence mode='wait'>
            <motion.div
              key={text}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-lg leading-relaxed text-gray-300 font-serif"
            >
              {loading ? <span className="flex items-center gap-2 text-yellow-600"><Compass className="animate-spin"/> 渡鸦正在飞行...</span> : text}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="grid gap-3">
          {choices.map((c, i) => (
            <button
              key={i}
              onClick={() => handleChoice(c.title)}
              disabled={loading}
              className="w-full bg-gray-900 border border-gray-700 hover:border-yellow-700 p-4 rounded text-left transition-all active:bg-gray-800 group"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-200 group-hover:text-yellow-500">{c.title}</span>
                <span className={`text-xs px-2 py-1 rounded ${c.risk === 'high' ? 'bg-red-900/30 text-red-500' : 'bg-green-900/30 text-green-500'}`}>
                  {c.risk === 'high' ? '高风险' : '安全'}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}