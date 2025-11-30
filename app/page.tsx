'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, Map as MapIcon, Compass, Footprints, Search, Tent, ShieldAlert } from 'lucide-react';

// 地图配置
const GRID_SIZE = 5; // 5x5 地图
const CELL_SIZE = 60; // 格子大小

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  
  // 初始状态
  const [state, setState] = useState({
    hp: 100,
    energy: 100,
    inventory: ["生锈匕首"],
    position: { x: 2, y: 2 }, // 玩家出生在地图中心
    visited: ["2-2"], // 记录去过的坐标 "x-y"
    history: ""
  });

  const [text, setText] = useState("你身处维斯特洛的荒野之中。四周迷雾重重，你需要探索这片土地，活下去。");
  const [choices, setChoices] = useState([
    { title: "搜索区域", desc: "看看有什么东西", risk: "low" },
    { title: "原地休息", desc: "恢复体力", risk: "low" }
  ]);

  // 地图生成 (简单随机地形)
  const [mapData] = useState(() => {
    const biomes = ['🌲 森林', '🏰 废墟', '🌫️ 沼泽', '🏔️ 山地', '💧 河流'];
    const grid: string[][] = [];
    for(let y=0; y<GRID_SIZE; y++){
      const row = [];
      for(let x=0; x<GRID_SIZE; x++){
        row.push(biomes[Math.floor(Math.random() * biomes.length)]);
      }
      grid.push(row);
    }
    // 出生点固定
    grid[2][2] = '🏕️ 营地'; 
    return grid;
  });

  // --- 核心逻辑：移动 ---
  async function movePlayer(dx: number, dy: number) {
    if (loading) return;
    
    const newX = state.position.x + dx;
    const newY = state.position.y + dy;

    // 边界检查
    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) return;

    // 更新位置
    const posKey = `${newX}-${newY}`;
    const isNewArea = !state.visited.includes(posKey);
    
    const newState = {
      ...state,
      position: { x: newX, y: newY },
      energy: Math.max(0, state.energy - 5), // 移动消耗精力
      visited: isNewArea ? [...state.visited, posKey] : state.visited
    };

    setState(newState);
    
    // 触发 AI 事件
    const actionDesc = isNewArea ? `探索新区域` : `回到已知区域`;
    const biome = mapData[newY][newX];
    
    await triggerAI(newState, actionDesc, biome);
  }

  // --- 核心逻辑：执行动作 ---
  async function handleChoice(choiceTitle: string) {
    await triggerAI(state, choiceTitle, mapData[state.position.y][state.position.x]);
  }

  // --- AI 交互 ---
  async function triggerAI(currentState: any, action: string, biome: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ 
          gameState: currentState, 
          action: action,
          mapInfo: { biome } // 把当前格子的地形发给AI
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
    <div className="min-h-screen bg-black text-gray-200 font-sans p-4 flex flex-col items-center">
      
      {/* 顶部状态 */}
      <div className="w-full max-w-md bg-gray-900 p-4 rounded-xl border border-gray-800 flex justify-between mb-4">
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center gap-1"><Heart size={10}/> HP</span>
          <span className="text-red-500 font-bold">{state.hp}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 flex items-center gap-1"><Zap size={10}/> ENERGY</span>
          <span className="text-yellow-500 font-bold">{state.energy}</span>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-xs text-gray-500">LOC</span>
          <span className="text-blue-400 font-mono">[{state.position.x}, {state.position.y}]</span>
        </div>
      </div>

      {/* --- 核心创新：地图显示区域 --- */}
      <div className="relative bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-2xl mb-6">
        <div className="absolute top-2 left-4 text-xs text-gray-500 flex items-center gap-1">
          <MapIcon size={12}/> 世界地图
        </div>
        
        <div 
          className="grid gap-1 mt-4" 
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
        >
          {mapData.map((row, y) => (
            row.map((cell, x) => {
              const isPlayerHere = x === state.position.x && y === state.position.y;
              const isVisited = state.visited.includes(`${x}-${y}`);
              
              return (
                <div 
                  key={`${x}-${y}`}
                  className={`
                    w-12 h-12 flex items-center justify-center text-xl rounded cursor-default transition-all duration-500
                    ${isPlayerHere ? 'bg-blue-900/50 border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110 z-10' : ''}
                    ${!isVisited && !isPlayerHere ? 'bg-gray-950 opacity-20' : 'bg-gray-800'}
                  `}
                >
                  {/* 玩家图标 或 地形图标 或 迷雾 */}
                  {isPlayerHere ? '🧙‍♂️' : (isVisited ? cell.split(' ')[0] : '❓')}
                </div>
              )
            })
          ))}
        </div>

        {/* 方向控制器 */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          <button onClick={() => movePlayer(0, -1)} disabled={loading} className="p-3 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 active:scale-95">⬆️</button>
          <div className="flex gap-16">
            <button onClick={() => movePlayer(-1, 0)} disabled={loading} className="p-3 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 active:scale-95">⬅️</button>
            <button onClick={() => movePlayer(1, 0)} disabled={loading} className="p-3 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 active:scale-95">➡️</button>
          </div>
          <button onClick={() => movePlayer(0, 1)} disabled={loading} className="p-3 bg-gray-800 rounded-full border border-gray-700 hover:bg-gray-700 active:scale-95">⬇️</button>
        </div>
      </div>

      <div className="h-8"></div> {/* 占位符 */}

      {/* 剧情文本 */}
      <div className="w-full max-w-md bg-gray-900/50 p-4 rounded-xl border border-gray-800 min-h-[100px] mb-4 font-serif text-lg leading-relaxed text-gray-200 shadow-inner">
        <AnimatePresence mode='wait'>
            <motion.div
              key={text}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              {loading ? <span className="animate-pulse text-yellow-500">命运计算中...</span> : text}
            </motion.div>
        </AnimatePresence>
      </div>

      {/* 交互按钮 */}
      <div className="w-full max-w-md grid grid-cols-1 gap-3">
        {choices.map((c, i) => (
          <button
            key={i}
            onClick={() => handleChoice(c.title)}
            disabled={loading}
            className="flex items-center justify-between bg-gray-900 border border-gray-800 hover:border-yellow-700 p-4 rounded-lg text-left transition-all active:bg-gray-800"
          >
            <div>
              <div className="font-bold text-gray-200">{c.title}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </div>
            {c.title.includes("搜索") ? <Search size={18} className="text-gray-600"/> : 
             c.title.includes("休息") ? <Tent size={18} className="text-gray-600"/> :
             <ShieldAlert size={18} className="text-gray-600"/>}
          </button>
        ))}
      </div>

    </div>
  );
}