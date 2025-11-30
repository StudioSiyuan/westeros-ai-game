'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, MapPin, Backpack, Activity } from 'lucide-react';

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("凛冬将至。你站在柳溪村的废墟前，身后是燃烧的家园。兰尼斯特的军队刚刚离开，你需要活下去。");
  const [choices, setChoices] = useState([
    { title: "搜刮废墟", desc: "寻找残留的食物", risk: "high" },
    { title: "逃入密林", desc: "躲避潜在的敌人", risk: "low" },
    { title: "原地休息", desc: "恢复体力", risk: "high" }
  ]);
  
  const [state, setState] = useState({
    hp: 100, energy: 100, location: "柳溪村废墟", inventory: ["粗布衣"], history: ""
  });

  async function handleAction(action: string) {
    setLoading(true);
    setChoices([]); // 隐藏按钮

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ gameState: state, action }),
      });
      
      const data = await res.json();
      
      if(data.error) throw new Error(data.error);

      // 更新状态
      setState(prev => ({
        ...prev,
        hp: Math.min(100, Math.max(0, prev.hp + data.hp_change)),
        energy: Math.min(100, Math.max(0, prev.energy + data.energy_change)),
        location: data.location,
        inventory: data.item_gained ? [...prev.inventory, data.item_gained] : prev.inventory,
        history: prev.history + " -> " + data.scene_text
      }));

      setText(data.scene_text);
      setChoices(data.choices);

    } catch (e) {
      alert("连接断开，请检查网络或Key配置");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans p-6 flex justify-center">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* 顶部栏 */}
        <header className="flex justify-between text-xs text-gray-500 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2"><MapPin size={14} /> {state.location}</div>
          <div>第 1 天</div>
        </header>

        {/* 状态栏 */}
        <div className="grid grid-cols-2 gap-4 bg-gray-900 p-4 rounded-lg border border-gray-800">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-gray-400"><Heart size={14} className="text-red-500"/> 生命</div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${state.hp}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-gray-400"><Zap size={14} className="text-yellow-500"/> 精力</div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-600 transition-all duration-500" style={{ width: `${state.energy}%` }} />
            </div>
          </div>
          <div className="col-span-2 text-sm text-gray-500 flex gap-2 border-t border-gray-800 pt-2 mt-2">
            <Backpack size={14} /> {state.inventory.join(" · ")}
          </div>
        </div>

        {/* 剧情文本 */}
        <div className="flex-1 text-lg leading-relaxed min-h-[150px]">
          <AnimatePresence mode='wait'>
            <motion.div
              key={text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              {text}
            </motion.div>
          </AnimatePresence>
          {loading && <div className="mt-4 text-yellow-600 animate-pulse text-sm">命运推演中...</div>}
        </div>

        {/* 选项按钮 */}
        <div className="grid gap-3 pb-10">
          {choices.map((c, i) => (
            <button
              key={i}
              onClick={() => handleAction(c.title)}
              disabled={loading}
              className="bg-gray-900 border border-gray-800 hover:border-yellow-700 hover:bg-gray-800 p-4 rounded-lg text-left transition-all"
            >
              <div className="font-bold text-gray-200 mb-1">{c.title}</div>
              <div className="text-sm text-gray-500 flex justify-between">
                <span>{c.desc}</span>
                <span className={c.risk === 'high' ? 'text-red-500' : 'text-green-500'}>
                  {c.risk === 'high' ? '⚠ 高风险' : '✓ 低风险'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}