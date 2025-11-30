'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, MapPin, Backpack, Skull, RotateCcw, Dice5, Sword, BookOpen } from 'lucide-react';

export default function GamePage() {
  const [loading, setLoading] = useState(false);
  const [isDead, setIsDead] = useState(false);
  
  // --- 新增状态：控制骰子窗口 ---
  const [showDice, setShowDice] = useState(false);      // 是否显示骰子弹窗
  const [currentChoice, setCurrentChoice] = useState<any>(null); // 当前选中的选项
  const [diceResult, setDiceResult] = useState<number | null>(null); // 骰子点数
  const [rolling, setRolling] = useState(false);        // 是否正在旋转动画中

  // --- 初始状态：新增 stats (属性) ---
  const initialState = {
    hp: 100, 
    energy: 100, 
    // 新增：基础属性 (STR=武力, INT=智力)
    stats: { str: 10, int: 10 },
    location: "柳溪村废墟", 
    inventory: ["粗布衣"], 
    history: "" 
  };

  const [text, setText] = useState("凛冬将至。你站在柳溪村的废墟前，身后是燃烧的家园。你感觉自己很虚弱，但也充满了愤怒。");
  
  // 初始选项带上了 type (检定类型)
  const [choices, setChoices] = useState([
    { title: "搜刮废墟", desc: "寻找残留的食物", risk: "high", type: "str" }, 
    { title: "逃入密林", desc: "躲避潜在的敌人", risk: "low", type: "none" },
    { title: "检查尸体", desc: "寻找有用的线索", risk: "high", type: "int" }
  ]);
  
  const [state, setState] = useState(initialState);

  // 自动读取存档
  useEffect(() => {
    const saved = localStorage.getItem('westeros_save');
    if (saved) {
      const parsed = JSON.parse(saved);
      // 兼容旧存档，如果没有stats则补上
      if (!parsed.stats) parsed.stats = { str: 10, int: 10 };
      if (parsed.hp > 0) {
        setState(parsed);
        setText("（旅途继续……）");
      }
    }
  }, []);

  // 自动保存存档
  useEffect(() => {
    if (state.hp > 0) localStorage.setItem('westeros_save', JSON.stringify(state));
  }, [state]);

  // --- 核心逻辑 1: 点击选项 ---
  function onChoiceClick(choice: any) {
    // 如果是低风险，或者没有指定类型，直接执行
    if (choice.risk === 'low' || !choice.type || choice.type === 'none') {
      executeAction(choice.title, 0); 
      return;
    }
    // 否则弹出骰子窗口
    setCurrentChoice(choice);
    setDiceResult(null);
    setShowDice(true);
  }

  // --- 核心逻辑 2: 执行掷骰子动画 ---
  function rollDice() {
    setRolling(true);
    
    // 1秒后的逻辑
    setTimeout(() => {
      // 生成 1-20 的随机数
      const baseRoll = Math.floor(Math.random() * 20) + 1; 
      setDiceResult(baseRoll);
      setRolling(false);
      
      // 再过 1.5秒 关闭窗口并发送请求
      setTimeout(() => {
        setShowDice(false);
        executeAction(currentChoice.title, baseRoll);
      }, 1500);
    }, 1000);
  }

  // --- 核心逻辑 3: 发送给 AI ---
  async function executeAction(actionTitle: string, roll: number) {
    setLoading(true);
    setChoices([]); 

    // 构建发给 AI 的动作描述字符串
    let detailedAction = actionTitle;
    
    if (roll > 0) {
      // 计算属性加成 (简单算法：(属性值-10)/2 )
      const statBonus = currentChoice.type === 'str' ? Math.floor((state.stats.str - 10) / 2) : 
                        currentChoice.type === 'int' ? Math.floor((state.stats.int - 10) / 2) : 0;
      const total = roll + statBonus;
      
      // 这里的文字会直接发给 AI，让它知道你掷出了多少点
      detailedAction += ` [系统检定: 基础D20=${roll} + 加成=${statBonus} = 最终点数 ${total}]`;
    }

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        body: JSON.stringify({ gameState: state, action: detailedAction }),
      });
      
      const data = await res.json();
      if(data.error) throw new Error(data.error);

      // 更新数值
      const newHp = Math.min(100, Math.max(0, state.hp + data.hp_change));
      const newEnergy = Math.min(100, Math.max(0, state.energy + data.energy_change));

      const newState = {
        ...state,
        hp: newHp,
        energy: newEnergy,
        location: data.location,
        inventory: data.item_gained ? [...state.inventory, data.item_gained] : state.inventory,
        history: state.history + " -> " + data.scene_text,
        stats: state.stats // 保持属性不变(未来可以让AI修改属性)
      };

      if (data.item_lost) {
        newState.inventory = newState.inventory.filter((i: string) => i !== data.item_lost);
      }

      setState(newState);
      setText(data.scene_text);

      if (newHp <= 0) {
        setIsDead(true);
        localStorage.removeItem('westeros_save');
      } else {
        // AI返回的选项可能没有type，前端随机分配一个以增加玩法
        const enhancedChoices = data.choices.map((c: any) => ({
          ...c,
          // 如果AI没返回risk，默认为low；如果有high risk，随机分配力/智检定
          type: (c.risk === 'high' || c.risk === 'extreme') ? (Math.random() > 0.5 ? 'str' : 'int') : 'none'
        }));
        setChoices(enhancedChoices);
      }

    } catch (e) {
      alert("连接断开");
      // 恢复按钮
      setChoices(old => old.length > 0 ? old : [{ title: "重试连接", desc: "网络波动", risk: "low", type: "none" }]); 
    } finally {
      setLoading(false);
    }
  }

  // 重开游戏
  function restartGame() {
    setIsDead(false);
    setState(initialState);
    setText("命运的齿轮重新开始转动……");
    setChoices([
      { title: "搜刮废墟", desc: "寻找残留的食物", risk: "high", type: "str" },
      { title: "逃入密林", desc: "躲避潜在的敌人", risk: "low", type: "none" },
      { title: "检查尸体", desc: "寻找有用的线索", risk: "high", type: "int" }
    ]);
    localStorage.removeItem('westeros_save');
  }

  // --- 界面：死亡画面 ---
  if (isDead) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 animate-in fade-in duration-1000">
        <div className="text-center space-y-6 max-w-md border border-red-900/50 p-10 rounded-2xl bg-red-950/10">
          <Skull className="w-20 h-20 text-red-600 mx-auto" />
          <h1 className="text-4xl font-serif text-red-500 tracking-widest">YOU DIED</h1>
          <p className="text-gray-400 italic">"{text}"</p>
          <button onClick={restartGame} className="flex items-center gap-2 mx-auto px-6 py-3 bg-red-900 hover:bg-red-800 text-white rounded-full transition-all">
            <RotateCcw size={18} /> 重新开始
          </button>
        </div>
      </div>
    );
  }

  // --- 界面：主游戏 ---
  return (
    <div className="min-h-screen bg-black text-gray-200 font-sans p-4 md:p-8 flex justify-center relative overflow-hidden">
      
      {/* 🎲 骰子检定弹窗 (遮罩层) */}
      <AnimatePresence>
        {showDice && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm p-4"
          >
            <div className="bg-gray-900 border border-yellow-600/50 p-8 rounded-2xl text-center max-w-sm w-full shadow-2xl shadow-yellow-900/20 relative">
              <h3 className="text-xl font-bold text-yellow-500 mb-2">命运检定</h3>
              <p className="text-gray-400 text-sm mb-6">正在尝试: {currentChoice?.title}</p>
              
              {/* 骰子动画区域 */}
              <div className="mb-8 flex justify-center perspective-500">
                <motion.div 
                  animate={rolling ? { rotateZ: 360, rotateY: 360, scale: [1, 1.2, 1] } : { rotateZ: 0, rotateY: 0, scale: 1 }}
                  transition={rolling ? { duration: 0.6, repeat: Infinity, ease: "linear" } : { type: "spring", stiffness: 200 }}
                  className={`w-24 h-24 rounded-xl flex items-center justify-center border-4 text-4xl font-bold shadow-lg
                    ${diceResult === null ? 'bg-gray-800 border-gray-600 text-gray-600' : 
                      diceResult >= 10 ? 'bg-green-900/50 border-green-500 text-green-400' : 'bg-red-900/50 border-red-500 text-red-400'}
                  `}
                >
                  {diceResult !== null ? diceResult : <Dice5 size={48} />}
                </motion.div>
              </div>

              {/* 按钮或结果 */}
              {!diceResult && !rolling && (
                <button 
                  onClick={rollDice}
                  className="w-full py-4 bg-yellow-700 hover:bg-yellow-600 text-black font-bold text-lg rounded-xl transition-all shadow-lg shadow-yellow-900/50"
                >
                  掷出命运 (D20)
                </button>
              )}
              
              {diceResult !== null && (
                <div className="space-y-1 animate-in slide-in-from-bottom-2">
                  <div className="text-lg font-bold text-white">
                    {diceResult >= 10 ? "成功概率高" : "情况不妙..."}
                  </div>
                  <div className="text-xs text-gray-500">
                    基础点数 {diceResult} 
                    {currentChoice.type === 'str' ? ` + 武力加成` : currentChoice.type === 'int' ? ` + 智力加成` : ''}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-2xl flex flex-col gap-6 z-10">
        {/* 顶部 */}
        <header className="flex justify-between text-xs text-gray-500 border-b border-gray-800 pb-4 uppercase tracking-widest">
          <div className="flex items-center gap-2 text-yellow-600"><MapPin size={14} /> {state.location}</div>
          <div>Day 1</div>
        </header>

        {/* 状态栏 */}
        <div className="grid grid-cols-2 gap-4 bg-gray-900/50 p-5 rounded-xl border border-gray-800/50">
          <StatusBar icon={<Heart size={12} className="text-red-500"/>} label="HP" value={state.hp} color="bg-red-600" />
          <StatusBar icon={<Zap size={12} className="text-yellow-500"/>} label="Energy" value={state.energy} color="bg-yellow-600" />
          
          {/* 新增属性显示区域 */}
          <div className="col-span-2 grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-gray-800/50">
             <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-950/50 px-3 py-2 rounded border border-gray-800">
                <span className="flex items-center gap-2"><Sword size={14} className="text-blue-400"/> 武力 (STR)</span>
                <span className="text-white font-mono text-sm">{state.stats.str}</span>
             </div>
             <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-950/50 px-3 py-2 rounded border border-gray-800">
                <span className="flex items-center gap-2"><BookOpen size={14} className="text-purple-400"/> 智力 (INT)</span>
                <span className="text-white font-mono text-sm">{state.stats.int}</span>
             </div>
          </div>

          <div className="col-span-2 text-sm text-gray-400 flex flex-wrap gap-2 pt-2">
            <Backpack size={14} className="mt-1" /> 
            {state.inventory.map((item, i) => (
              <span key={i} className="bg-gray-800 px-2 py-0.5 rounded text-xs border border-gray-700">{item}</span>
            ))}
          </div>
        </div>

        {/* 剧情文本 */}
        <div className="flex-1 text-lg leading-relaxed font-serif text-gray-100 min-h-[120px]">
          <AnimatePresence mode='wait'>
            <motion.div
              key={state.history.length}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {text}
            </motion.div>
          </AnimatePresence>
          {loading && <div className="mt-4 flex items-center gap-2 text-yellow-600/50 text-sm animate-pulse">正在推演...</div>}
        </div>

        {/* 选项按钮 */}
        <div className="grid gap-3 pb-10">
          {choices.map((c, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              onClick={() => onChoiceClick(c)}
              disabled={loading}
              className="group relative bg-gray-900 border border-gray-800 hover:border-yellow-700/50 hover:bg-gray-800 p-4 rounded-lg text-left transition-all active:scale-[0.98]"
            >
              <div className="font-bold text-gray-200 mb-1 group-hover:text-yellow-500 transition-colors flex justify-between items-center">
                <span>{c.title}</span>
                {/* 检定图标提示 */}
                {(c.risk === 'high' || c.risk === 'extreme') && (
                  <div className="flex items-center gap-1 text-xs font-normal opacity-60 bg-black/30 px-2 py-1 rounded">
                    <Dice5 size={12} />
                    {c.type === 'str' ? 'STR' : c.type === 'int' ? 'INT' : 'LUCK'}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500 flex justify-between items-center mt-1">
                <span>{c.desc}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  c.risk === 'high' || c.risk === 'extreme' ? 'border-red-900/30 text-red-500 bg-red-950/20' : 'border-green-900/30 text-green-500 bg-green-950/20'
                }`}>
                  {c.risk === 'high' ? '⚠ 需检定' : c.risk === 'extreme' ? '💀 极危' : '✓ 安全'}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 状态条组件
function StatusBar({ icon, label, value, color }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">{icon} {label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div className={`h-full ${color}`} initial={{ width: 0 }} animate={{ width: `${value}%` }} />
      </div>
    </div>
  )
}