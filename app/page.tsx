'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

// --- 配置 ---
const MAP_WIDTH = 60;
const MAP_HEIGHT = 80;
const VIEW_SIZE = 10;

// --- 地形定义 ---
type TileType = 'SNOW' | 'WALL' | 'FOREST' | 'PLAIN' | 'WATER' | 'MOUNTAIN' | 'DESERT' | 'CITY';

interface Tile {
  char: string;
  color: string;
  type: TileType;
  name?: string;
}

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  
  // 滚动日志引用
  const logsEndRef = useRef<HTMLDivElement>(null);

  // --- 1. 地图生成 (保持不变) ---
  const worldMap = useMemo(() => {
    const map: Tile[][] = [];
    const noise = (x: number, y: number) => Math.sin(x * 0.1) + Math.cos(y * 0.1);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        let tile: Tile = { char: '.', color: 'text-gray-600', type: 'PLAIN' };
        
        // 地形生成逻辑
        const shapeNoise = Math.sin(y * 0.05) * 5;
        if (x < 5 + shapeNoise || x > MAP_WIDTH - 5 - shapeNoise) {
          tile = { char: '~', color: 'text-blue-800', type: 'WATER' };
        } else if (y === 15) {
          tile = { char: '#', color: 'text-blue-200 font-bold', type: 'WALL' };
        } else if (y < 15) {
          const n = Math.random();
          tile = n > 0.8 ? { char: '^', color: 'text-gray-400', type: 'MOUNTAIN' } : { char: '*', color: 'text-white', type: 'SNOW' };
        } else if (y >= 15 && y < 40) {
          const n = noise(x, y);
          if (n > 0.5) tile = { char: 'T', color: 'text-green-800', type: 'FOREST' };
          else tile = { char: '.', color: 'text-gray-500', type: 'PLAIN' };
        } else if (y >= 40 && y < 60) {
          if (Math.abs(noise(x, y)) < 0.1) tile = { char: '~', color: 'text-blue-500', type: 'WATER' };
          else if (Math.random() > 0.8) tile = { char: 'T', color: 'text-green-600', type: 'FOREST' };
          else tile = { char: '.', color: 'text-green-900', type: 'PLAIN' };
        } else {
          tile = { char: ':', color: 'text-yellow-700', type: 'DESERT' };
        }
        row.push(tile);
      }
      map.push(row);
    }

    // 城市坐标
    const cities = [
      { x: 28, y: 15, char: 'Π', color: 'text-white', name: '黑城堡' },
      { x: 25, y: 26, char: 'Σ', color: 'text-gray-300', name: '临冬城' }, // 出生点
      { x: 45, y: 35, char: 'Ψ', color: 'text-gray-400', name: '鹰巢城' },
      { x: 10, y: 40, char: 'Φ', color: 'text-yellow-600', name: '凯岩城' },
      { x: 35, y: 55, char: '👑', color: 'text-yellow-500', name: '君临城' },
    ];

    cities.forEach(c => {
      if(map[c.y] && map[c.y][c.x]) {
        map[c.y][c.x] = { char: c.char, color: `${c.color} font-bold animate-pulse`, type: 'CITY', name: c.name };
      }
    });

    return map;
  }, []);

  // --- 状态定义 ---
  const [player, setPlayer] = useState({ x: 25, y: 26, hp: 100, energy: 100, inventory: ["生锈铁剑"] });
  const [aiText, setAiText] = useState("正在初始化维斯特洛大陆...");
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  // 关键修复：找回选项状态
  const [choices, setChoices] = useState([
    { title: "环顾四周", desc: "观察环境", risk: "low" },
    { title: "检查背包", desc: "整理物资", risk: "low" }
  ]);

  // --- 初始化：开局自动触发一次 AI ---
  useEffect(() => {
    // 延迟 1秒 让组件渲染完再触发
    const timer = setTimeout(() => {
      triggerAI("游戏开始，描述我所在的临冬城周边环境", "临冬城郊外");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // 自动滚动日志
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLogs]);

  const addLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, msg].slice(-20)); // 保留最近20条
  };

  // --- 核心逻辑 ---

  const move = async (dx: number, dy: number) => {
    if (loading) return;
    const nx = player.x + dx;
    const ny = player.y + dy;

    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return;

    // 简单更新位置
    setPlayer(prev => ({ ...prev, x: nx, y: ny, energy: Math.max(0, prev.energy - 1) }));
    
    // 获取地形信息
    const tile = worldMap[ny][nx];
    let locationName = "荒野";
    if (tile.type === 'CITY') locationName = tile.name || "城市";
    if (tile.type === 'WALL') locationName = "绝境长城";
    
    addLog(`> 移动至 [${nx}, ${ny}] ${locationName}`);

    // 移动后立刻触发 AI，生成新剧情
    await triggerAI(`移动到了 ${locationName} (地形: ${tile.type})`, locationName);
  };

  const handleChoice = async (choiceTitle: string) => {
    addLog(`> 执行: ${choiceTitle}`);
    const tile = worldMap[player.y][player.x];
    const locName = tile.name || "荒野";
    await triggerAI(choiceTitle, locName);
  };

  const triggerAI = async (action: string, locationName: string) => {
    setLoading(true);
    setAiText("..."); // 清空文本表示正在思考
    
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ 
          gameState: { hp: player.hp, energy: player.energy, inventory: player.inventory, position: player, history: "" }, 
          action: action,
          locationName: locationName
        }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      // 逐字显示效果 (简单的替换)
      setAiText(data.scene_text);
      
      // 更新数值
      if (data.hp_change) setPlayer(p => ({ ...p, hp: Math.min(100, Math.max(0, p.hp + data.hp_change)) }));
      if (data.item_gained) {
        setPlayer(p => ({ ...p, inventory: [...p.inventory, data.item_gained] }));
        addLog(`+ 获得: ${data.item_gained}`);
      }
      
      // 关键修复：更新选项按钮
      setChoices(data.choices || []);

    } catch (e) {
      setAiText("与旧神的连接微弱... (请重试)");
      setChoices([{ title: "重试", desc: "重新连接", risk: "low" }]);
    } finally {
      setLoading(false);
    }
  };

  // --- 渲染视口 ---
  const renderViewport = () => {
    const grid = [];
    const startX = player.x - VIEW_SIZE;
    const startY = player.y - VIEW_SIZE;
    
    for (let y = startY; y <= startY + VIEW_SIZE * 2; y++) {
      const row = [];
      for (let x = startX; x <= startX + VIEW_SIZE * 2; x++) {
        // 边界
        if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) {
          row.push(<span key={`${x}-${y}`} className="text-gray-900">   </span>);
          continue;
        }
        
        // 玩家
        if (x === player.x && y === player.y) {
          row.push(<span key={`${x}-${y}`} className="text-yellow-400 font-bold animate-pulse"> @ </span>);
          continue;
        }

        const tile = worldMap[y][x];
        row.push(
          <span key={`${x}-${y}`} className={`${tile.color} cursor-default`} title={tile.type}>
            {` ${tile.char} `}
          </span>
        );
      }
      grid.push(<div key={y} className="flex">{row}</div>);
    }
    return grid;
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 font-mono flex flex-col md:flex-row items-stretch overflow-hidden">
      
      {/* 左侧：地图区域 (固定宽度) */}
      <div className="md:w-1/2 border-r border-gray-800 flex flex-col bg-[#050505] relative">
        <div className="absolute top-2 left-2 text-[10px] text-gray-600 border border-gray-800 px-2 py-1">WORLD MAP</div>
        
        {/* 地图视口 */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-xs leading-none whitespace-pre bg-black p-4 border-2 border-gray-900 rounded shadow-2xl">
            {renderViewport()}
          </div>
        </div>

        {/* 移动控制键盘 */}
        <div className="h-48 border-t border-gray-800 flex flex-col items-center justify-center bg-gray-900/30">
          <div className="text-xs mb-2 text-gray-500">移动控制 (消耗精力)</div>
          <div className="grid grid-cols-3 gap-2">
            <div></div>
            <button onClick={() => move(0, -1)} disabled={loading} className="w-12 h-12 border border-gray-600 hover:bg-gray-700 hover:text-white rounded active:bg-gray-600 transition-colors">N</button>
            <div></div>
            <button onClick={() => move(-1, 0)} disabled={loading} className="w-12 h-12 border border-gray-600 hover:bg-gray-700 hover:text-white rounded active:bg-gray-600 transition-colors">W</button>
            <button onClick={() => move(0, 1)} disabled={loading} className="w-12 h-12 border border-gray-600 hover:bg-gray-700 hover:text-white rounded active:bg-gray-600 transition-colors">S</button>
            <button onClick={() => move(1, 0)} disabled={loading} className="w-12 h-12 border border-gray-600 hover:bg-gray-700 hover:text-white rounded active:bg-gray-600 transition-colors">E</button>
          </div>
        </div>
      </div>

      {/* 右侧：剧情与交互 (自适应宽度) */}
      <div className="md:w-1/2 flex flex-col bg-black">
        
        {/* 1. 状态栏 */}
        <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 text-xs font-bold uppercase tracking-widest bg-gray-900">
          <div className="flex gap-4">
            <span className="text-red-500">HP {player.hp}</span>
            <span className="text-blue-500">ENG {player.energy}</span>
          </div>
          <div className="text-gray-500">
            LOC [{player.x}, {player.y}]
          </div>
        </div>

        {/* 2. 剧情文本 (可滚动) */}
        <div className="flex-1 p-6 overflow-y-auto font-serif text-base md:text-lg leading-relaxed text-gray-200">
          {loading ? (
            <div className="animate-pulse flex space-x-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
            </div>
          ) : (
            <p>{aiText}</p>
          )}
        </div>

        {/* 3. 互动按钮区域 (关键修复！) */}
        <div className="min-h-[160px] border-t border-gray-800 p-4 bg-gray-900/20">
          <div className="text-[10px] text-gray-500 mb-2 uppercase">Actions / 行动</div>
          <div className="grid gap-2">
            {choices.map((c, i) => (
              <button
                key={i}
                onClick={() => handleChoice(c.title)}
                disabled={loading}
                className="w-full text-left border border-gray-700 bg-gray-900 hover:bg-gray-800 hover:border-yellow-600 p-3 rounded transition-all group flex justify-between items-center"
              >
                <div>
                  <span className="text-yellow-500 font-bold mr-2 group-hover:text-yellow-400">&gt; {c.title}</span>
                  <span className="text-gray-500 text-xs">{c.desc}</span>
                </div>
                {c.risk === 'high' && <span className="text-[10px] text-red-500 border border-red-900 px-1 rounded">RISK</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 4. 系统日志 */}
        <div className="h-32 border-t border-gray-800 bg-black p-2 font-mono text-[10px] text-green-700 overflow-y-auto">
          {consoleLogs.map((log, i) => (
            <div key={i} className="mb-1 opacity-70 border-l-2 border-green-900 pl-2">{log}</div>
          ))}
          <div ref={logsEndRef} />
        </div>

      </div>
    </div>
  );
}