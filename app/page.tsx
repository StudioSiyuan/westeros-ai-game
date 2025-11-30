'use client';

import { useState, useEffect, useMemo } from 'react';

// --- 配置 ---
const MAP_WIDTH = 60;  // 地图总宽
const MAP_HEIGHT = 80; // 地图总高 (维斯特洛是长条形的)
const VIEW_SIZE = 10;  // 视口半径 (实际显示 21x21 格子)

// --- 地形定义 ---
type TileType = 'SNOW' | 'WALL' | 'FOREST' | 'PLAIN' | 'WATER' | 'MOUNTAIN' | 'DESERT' | 'CITY';

interface Tile {
  char: string;
  color: string;
  type: TileType;
  name?: string; // 城市名
}

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "> 系统启动...",
    "> 加载维斯特洛大陆数据...",
    "> 凛冬将至..."
  ]);

  // --- 1. 生成大地图 (只在初始化时运行一次) ---
  const worldMap = useMemo(() => {
    const map: Tile[][] = [];
    
    // 噪声辅助函数 (简单的伪随机)
    const noise = (x: number, y: number) => Math.sin(x * 0.1) + Math.cos(y * 0.1);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        let tile: Tile = { char: '.', color: 'text-gray-600', type: 'PLAIN' };
        
        // --- 地理生成逻辑 (模拟维斯特洛地形) ---
        
        // 1. 大海 (地图左右两侧)
        // 维斯特洛形状大概是中间宽两头窄，这里简单模拟
        const shapeNoise = Math.sin(y * 0.05) * 5;
        if (x < 5 + shapeNoise || x > MAP_WIDTH - 5 - shapeNoise) {
          tile = { char: '~', color: 'text-blue-800', type: 'WATER' };
        }
        
        // 2. 绝境长城 (y=15)
        else if (y === 15) {
          tile = { char: '#', color: 'text-blue-200 font-bold', type: 'WALL' };
        }
        
        // 3. 塞外 (y < 15) -> 雪地
        else if (y < 15) {
          const n = Math.random();
          tile = n > 0.8 ? { char: '^', color: 'text-gray-400', type: 'MOUNTAIN' } 
                 : { char: '*', color: 'text-white', type: 'SNOW' };
        }
        
        // 4. 北境 (15 < y < 40) -> 森林与寒冷
        else if (y >= 15 && y < 40) {
          const n = noise(x, y);
          if (n > 0.5) tile = { char: 'T', color: 'text-green-800', type: 'FOREST' }; // 狼林
          else if (Math.random() > 0.9) tile = { char: '^', color: 'text-gray-500', type: 'MOUNTAIN' };
          else tile = { char: '.', color: 'text-gray-500', type: 'PLAIN' };
        }
        
        // 5. 中部/河间地 (40 <= y < 60) -> 平原与河流
        else if (y >= 40 && y < 60) {
          if (Math.abs(noise(x, y)) < 0.1) tile = { char: '~', color: 'text-blue-500', type: 'WATER' }; // 三叉戟河
          else if (Math.random() > 0.8) tile = { char: 'T', color: 'text-green-600', type: 'FOREST' };
          else tile = { char: '.', color: 'text-green-900', type: 'PLAIN' }; // 肥沃土地
        }
        
        // 6. 多恩/南部 (y >= 60) -> 沙漠与山脉
        else {
          if (Math.random() > 0.7) tile = { char: 'A', color: 'text-red-900', type: 'MOUNTAIN' }; // 赤红山脉
          else tile = { char: ':', color: 'text-yellow-700', type: 'DESERT' };
        }

        row.push(tile);
      }
      map.push(row);
    }

    // --- 放置名城 (硬编码坐标) ---
    const cities = [
      { x: 30, y: 5, char: 'Ω', color: 'text-purple-400', name: '瑟恩山谷' },
      { x: 28, y: 15, char: 'Π', color: 'text-white', name: '黑城堡' },
      { x: 25, y: 25, char: 'Σ', color: 'text-gray-300', name: '临冬城' },
      { x: 45, y: 35, char: 'Ψ', color: 'text-gray-400', name: '鹰巢城' },
      { x: 10, y: 40, char: 'Φ', color: 'text-yellow-600', name: '凯岩城' },
      { x: 35, y: 55, char: '👑', color: 'text-yellow-500', name: '君临城' }, // 特殊Emoji
      { x: 20, y: 65, char: '🌹', color: 'text-green-500', name: '高庭' },
      { x: 40, y: 75, char: '☀️', color: 'text-orange-500', name: '阳戟城' },
    ];

    cities.forEach(c => {
      if(map[c.y] && map[c.y][c.x]) {
        map[c.y][c.x] = { char: c.char, color: `${c.color} font-bold animate-pulse`, type: 'CITY', name: c.name };
      }
    });

    return map;
  }, []);

  // --- 玩家状态 ---
  const [player, setPlayer] = useState({
    x: 25, y: 26, // 出生在临冬城附近
    hp: 100,
    energy: 100,
    inventory: ["生锈铁剑", "半块面包"],
  });

  const [aiText, setAiText] = useState("你站在临冬城外的雪原上。寒风刺骨，你的冒险刚刚开始。");

  // --- 辅助：添加日志 ---
  const addLog = (msg: string) => {
    setConsoleLogs(prev => [msg, ...prev].slice(0, 6)); // 只保留最新6条
  };

  // --- 移动逻辑 ---
  const move = async (dx: number, dy: number) => {
    if (loading) return;
    
    const nx = player.x + dx;
    const ny = player.y + dy;

    // 碰撞检测
    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) {
      addLog(">> 无法通过：已到达世界边缘");
      return;
    }

    const targetTile = worldMap[ny][nx];
    if (targetTile.type === 'WATER' && targetTile.char === '~' && Math.random() > 0.2) {
      // 简单阻挡，除非有船(暂未实现)
      addLog(">> 前方是深水，无法通过");
      return;
    }

    // 更新位置
    setPlayer(prev => ({ ...prev, x: nx, y: ny, energy: Math.max(0, prev.energy - 1) }));
    
    // 构造环境描述发给 AI
    let locationName = "荒野";
    if (targetTile.type === 'CITY') locationName = targetTile.name || "未知城市";
    else if (targetTile.type === 'FOREST') locationName = "密林";
    else if (targetTile.type === 'SNOW') locationName = "雪原";
    else if (targetTile.type === 'WALL') locationName = "绝境长城脚下";

    addLog(`>> 移动至 [${nx}, ${ny}] - ${locationName}`);

    // 触发 AI (防抖：每移动5步或遇到特殊地形触发一次，这里为了演示每次都触发，但只在遇到城市时强制触发)
    if (targetTile.type === 'CITY' || Math.random() > 0.7) {
      await triggerAI(locationName, targetTile.type);
    }
  };

  // --- AI 请求 ---
  const triggerAI = async (locName: string, biome: string) => {
    setLoading(true);
    setAiText("正在观察四周...");
    
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ 
          gameState: { hp: player.hp, energy: player.energy, inventory: player.inventory, position: player, history: "" }, 
          action: `移动到了 ${locName} (${biome})`,
          locationName: locName
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setAiText(data.scene_text);
        if (data.hp_change) setPlayer(p => ({ ...p, hp: Math.min(100, Math.max(0, p.hp + data.hp_change)) }));
        if (data.item_gained) {
            setPlayer(p => ({ ...p, inventory: [...p.inventory, data.item_gained] }));
            addLog(`>> 获得: ${data.item_gained}`);
        }
      }
    } catch(e) {
      setAiText("...风雪太大，看不清周围。");
    } finally {
      setLoading(false);
    }
  };

  // --- 渲染视口 ---
  const renderViewport = () => {
    const grid = [];
    const startX = player.x - VIEW_SIZE;
    const startY = player.y - VIEW_SIZE;
    const endX = player.x + VIEW_SIZE;
    const endY = player.y + VIEW_SIZE;

    for (let y = startY; y <= endY; y++) {
      const row = [];
      for (let x = startX; x <= endX; x++) {
        // 玩家位置
        if (x === player.x && y === player.y) {
          row.push(<span key={`${x}-${y}`} className="text-yellow-400 font-bold animate-pulse"> @ </span>);
          continue;
        }

        // 边界外
        if (y < 0 || y >= MAP_HEIGHT || x < 0 || x >= MAP_WIDTH) {
          row.push(<span key={`${x}-${y}`} className="text-gray-900">   </span>); // 空白
          continue;
        }

        const tile = worldMap[y][x];
        // 渲染 Tile
        row.push(
          <span key={`${x}-${y}`} className={`${tile.color} select-none`}>
            {` ${tile.char} `}
          </span>
        );
      }
      grid.push(<div key={y} className="flex">{row}</div>);
    }
    return grid;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300 font-mono flex flex-col items-center justify-center p-2 overflow-hidden">
      
      {/* 1. 游戏主容器 */}
      <div className="w-full max-w-3xl border border-gray-800 bg-black shadow-2xl flex flex-col md:flex-row">
        
        {/* 左侧：地图视口 */}
        <div className="p-4 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col items-center justify-center bg-[#050505]">
          <div className="text-[10px] text-gray-600 mb-2 tracking-widest">- WORLD MAP -</div>
          <div className="font-mono text-xs md:text-sm leading-none whitespace-pre bg-black p-2 border border-gray-900 rounded">
            {renderViewport()}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div></div>
            <button onClick={() => move(0, -1)} className="w-10 h-10 border border-gray-700 hover:bg-gray-800 rounded text-gray-400">↑</button>
            <div></div>
            <button onClick={() => move(-1, 0)} className="w-10 h-10 border border-gray-700 hover:bg-gray-800 rounded text-gray-400">←</button>
            <button onClick={() => move(0, 1)} className="w-10 h-10 border border-gray-700 hover:bg-gray-800 rounded text-gray-400">↓</button>
            <button onClick={() => move(1, 0)} className="w-10 h-10 border border-gray-700 hover:bg-gray-800 rounded text-gray-400">→</button>
          </div>
        </div>

        {/* 右侧：信息面板 */}
        <div className="flex-1 flex flex-col">
          
          {/* 状态栏 */}
          <div className="p-4 border-b border-gray-800 grid grid-cols-2 gap-4 text-xs font-bold tracking-wider">
            <div className="text-red-500">HP: {player.hp}/100</div>
            <div className="text-blue-500 text-right">ENG: {player.energy}</div>
            <div className="col-span-2 text-gray-500 font-normal">
              LOC: [{player.x}, {player.y}] <span className="text-yellow-600 ml-2">{loading ? "..." : ""}</span>
            </div>
          </div>

          {/* 剧情输出 (类似老式终端) */}
          <div className="flex-1 p-4 min-h-[200px] text-sm leading-relaxed text-gray-300 font-serif">
            <p className="mb-4 text-yellow-100/90">{aiText}</p>
            {loading && <span className="animate-pulse text-gray-600">_</span>}
          </div>

          {/* 滚动日志 */}
          <div className="h-32 bg-gray-900/50 p-2 overflow-hidden border-t border-gray-800 text-[10px] font-mono text-gray-500">
            {consoleLogs.map((log, i) => (
              <div key={i} className="mb-1 opacity-80">{log}</div>
            ))}
          </div>

        </div>
      </div>

      <div className="mt-2 text-[10px] text-gray-800">
        WASD / Arrow Keys to Move (需点击按钮)
      </div>
    </div>
  );
}