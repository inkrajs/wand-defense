import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, PencilIcon, PencilText, type PencilIconPath } from "@inkra/react";
import { Preferences } from "./Preferences";
import type { Command, CommandResult, GameState } from "../contracts";
import "./MenuPages.css";

export type MenuPage = "menu" | "settings" | "agent" | "accessibility" | "character";
type Props = {
  dispatch: (command: Command) => CommandResult;
  page: MenuPage | null;
  navigate: (page: MenuPage) => void;
  close: () => void;
  restart: () => void;
  agentPanel?: ReactNode;
  state: GameState;
  unlock: () => void;
  toggleCheats: () => void;
  heal: () => void;
};

const closePaths: PencilIconPath[] = [{ d: "M5 5l14 14M19 5 5 19", mode: "stroke" }];
const agentPaths: PencilIconPath[] = [{ d: "M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8", mode: "stroke" }, { d: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z", mode: "stroke" }];
const settingsPaths: PencilIconPath[] = [{ d: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4", mode: "stroke" }, { d: "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z", mode: "stroke" }];
const restartPaths: PencilIconPath[] = [{ d: "M20 7v5h-5M19 12a7 7 0 1 1-2-5", mode: "stroke" }];
const backPaths: PencilIconPath[] = [{ d: "M19 12H5m7 7-7-7 7-7", mode: "stroke" }];
const unlockPaths: PencilIconPath[] = [{ d: "M7 10V7a5 5 0 0 1 9.6-2M5 10h14v11H5zM12 14v3", mode: "stroke" }];
const healPaths: PencilIconPath[] = [{ d: "M12 4v16M4 12h16", mode: "stroke" }];
const cheatPaths: PencilIconPath[] = [{ d: "M12 3 20 6v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-3Z", mode: "stroke" }];

function MenuItem({ icon, children, onClick, className = "" }: { icon: readonly PencilIconPath[]; children: string; onClick: () => void; className?: string }) {
  return <Button variant="ghost" fullWidth align="start" className={`menu-page__item ${className}`} onClick={onClick}>
    <span className="menu-page__row"><PencilIcon paths={icon} sourceSize={24} size={32} decorative /><PencilText as="span">{children}</PencilText></span>
  </Button>;
}

export function MenuPages({ page, navigate, close, restart, agentPanel, state, unlock, toggleCheats, heal, dispatch }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [displayPage, setDisplayPage] = useState<MenuPage | null>(page);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (closeTimer.current !== undefined) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
    if (page !== null) {
      setDisplayPage(page);
      setClosing(false);
    } else if (displayPage !== null) {
      setClosing(true);
      const reduced = document.documentElement.dataset.gameReduceMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      closeTimer.current = window.setTimeout(() => {
        setClosing(false);
        closeTimer.current = undefined;
      }, reduced ? 0 : 280);
    }
    return () => {
      if (closeTimer.current !== undefined) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = undefined;
      }
    };
  }, [page]);
  useEffect(() => { if (page) heading.current?.focus(); }, [displayPage, page]);
  function back() { page === "character" ? close() : navigate("menu"); }

  return <section className="menu-page" data-open={page !== null} data-closing={closing} aria-hidden={page === null} inert={page === null} aria-label="游戏菜单" onKeyDown={(event) => { if (event.key === "Escape" && page) { event.preventDefault(); page === "menu" ? close() : back(); } }}>
    <Button className="menu-page__close" size="icon" variant="ghost" aria-label="关闭菜单" onClick={close}><PencilIcon paths={closePaths} sourceSize={24} size={32} decorative /></Button>
    <div className="menu-page__content">
      <div className="menu-page__view" key={displayPage ?? "closed"}>
        <PencilText as="h2" ref={heading} tabIndex={-1} seed="menu-heading">{displayPage === "menu" || displayPage === null ? "菜单" : displayPage === "character" ? "角色" : displayPage === "settings" ? "设置" : displayPage === "agent" ? "Agent" : "辅助功能"}</PencilText>

      <nav className="menu-page__items" aria-label="菜单选项" hidden={displayPage !== "menu"}>
        <MenuItem icon={restartPaths} onClick={restart}>重新开始</MenuItem>
        <MenuItem icon={settingsPaths} onClick={() => navigate("settings")}>设置</MenuItem>
        <MenuItem icon={agentPaths} onClick={() => navigate("agent")}>Agent</MenuItem>
      </nav>

      <div className="menu-page__detail" hidden={displayPage !== "settings"}>
        <Preferences />
        <section className="menu-page__debug" aria-label="调试选项">
          <PencilText as="h3" seed="debug-heading">调试选项</PencilText>
          <PencilText as="p" seed="debug-help">作弊功能需在本机明确解锁。</PencilText>
          <div className="menu-page__debug-items">
            {!state.cheats.unlocked ? <MenuItem icon={unlockPaths} onClick={unlock}>解锁作弊</MenuItem> : <>
              <MenuItem icon={cheatPaths} onClick={toggleCheats}>{state.cheats.enabled ? "关闭作弊" : "启用作弊"}</MenuItem>
              {state.cheats.enabled && <MenuItem icon={healPaths} onClick={heal}>恢复领地</MenuItem>}
            </>}
          </div>
        </section>
      </div>
      <div className="menu-page__detail" hidden={displayPage !== "accessibility"}><PencilText as="p" seed="accessibility-help">界面支持键盘操作；可使用系统的文字缩放与减少动态效果设置。</PencilText></div>

      {displayPage && displayPage !== "menu" && <Button size="icon" variant="ghost" className="menu-page__back" aria-label="返回菜单" onClick={back}><PencilIcon paths={backPaths} sourceSize={24} size={32} decorative /></Button>}
      </div>
      <div className="menu-page__detail menu-page__agent" data-active={displayPage === "agent"} aria-hidden={displayPage !== "agent"} inert={displayPage !== "agent"}>
        {agentPanel ?? <PencilText as="p" seed="agent-unavailable">Agent 连接不可用。</PencilText>}
      </div>
    </div>
  </section>;
}
