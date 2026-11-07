"use client";

import React from "react";
import {
  Gamepad2,
  Home,
  LayoutGrid,
  Bookmark,
  PlusCircle,
  ChevronUp,
  Download,
  Flame,
} from "lucide-react";

interface SidebarProps {
  activeTab: "home" | "categories" | "library" | "create";
  onSelectTab: (tab: "home" | "categories" | "library" | "create") => void;
  onSelectFastLaunch: (gameTitle: string) => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  onSelectFastLaunch,
}: SidebarProps) {
  const fastLaunchGames = [
    {
      title: "Minecraft",
      image: "https://images.unsplash.com/photo-1627856013091-fed6e4e30025?auto=format&fit=crop&w=120&q=80",
    },
    {
      title: "Red Dead Redemption 2",
      image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=120&q=80",
    },
    {
      title: "Far Cry 6",
      image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=120&q=80",
    },
    {
      title: "Mafia: Definitive Edition",
      image: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=120&q=80",
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-[#0E141D] border-r border-[#17212F] flex flex-col justify-between p-5 select-none min-h-screen">
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2 cursor-pointer" onClick={() => onSelectTab("home")}>
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
            <Gamepad2 className="w-6 h-6 text-[#0A0E14]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black tracking-wider text-white uppercase leading-none font-mono">
              PLAY
            </span>
            <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase mt-0.5">
              GAMESTORE
            </span>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1.5 mb-8">
          <button
            onClick={() => onSelectTab("home")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
              activeTab === "home"
                ? "bg-[#182333] text-white shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-[#131A24]"
            }`}
          >
            <Home className="w-4 h-4 text-zinc-300" />
            <span>Home</span>
          </button>

          <button
            onClick={() => onSelectTab("categories")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
              activeTab === "categories"
                ? "bg-[#182333] text-white shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-[#131A24]"
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-zinc-400" />
            <span>Categories</span>
          </button>

          <button
            onClick={() => onSelectTab("library")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
              activeTab === "library"
                ? "bg-[#182333] text-white shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-[#131A24]"
            }`}
          >
            <Bookmark className="w-4 h-4 text-zinc-400" />
            <span>My Library</span>
          </button>

          <button
            onClick={() => onSelectTab("create")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
              activeTab === "create"
                ? "bg-[#0078FF] text-white shadow-lg shadow-[#0078FF]/30 font-bold"
                : "text-[#0084FF] hover:bg-[#131A24] font-bold"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-[#0084FF]" />
            <span>Anunciar / Vender</span>
          </button>
        </nav>

        {/* FAST LAUNCH SECTION */}
        <div>
          <h4 className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase px-2 mb-3">
            FAST LAUNCH
          </h4>
          <div className="space-y-2">
            {fastLaunchGames.map((game) => (
              <button
                key={game.title}
                onClick={() => onSelectFastLaunch(game.title)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#131A24] transition-colors text-left group"
              >
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-8 h-8 rounded-lg object-cover bg-zinc-800 shrink-0"
                />
                <span className="text-xs font-semibold text-zinc-300 group-hover:text-white truncate">
                  {game.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Download / Status Widget */}
      <div className="mt-8 pt-4">
        <div className="p-3 rounded-2xl bg-[#131C28] border border-[#1A2637] flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=80&q=80"
                alt="Cyberpunk 2077"
                className="w-8 h-8 rounded-lg object-cover"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white truncate max-w-[100px]">
                  Cyberpunk 2077
                </span>
                <span className="text-[10px] text-zinc-400">Downloading</span>
              </div>
            </div>
            <button className="text-zinc-500 hover:text-white">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-[#1C2A3D] overflow-hidden">
              <div className="h-full bg-[#0084FF] rounded-full w-[68%]" />
            </div>
            <span className="text-[10px] font-bold text-zinc-300">68%</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
