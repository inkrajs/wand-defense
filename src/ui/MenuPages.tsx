import { useEffect, useRef, type ReactNode } from "react";
import { Button, PencilText } from "@inkra/react";
import { CharacterPage } from "./CharacterPage";
import type { Command, CommandResult, GameState } from "../contracts";
import "./MenuPages.css";

export type MenuPage = "menu" | "settings" | "agent" | "accessibility" | "character";
const pages: ReadonlyArray<{ id: Exclude<MenuPage, "menu">; label: string }> = [
  { id: "character", label: "角色" },
  { id: "settings", label: "设置" },
  { id: "agent", label: "Agent" },
  { id: "accessibility", label: "辅助功能" },
];
type Props = { dispatch: (command: Command) => CommandResult; page: MenuPage | null; navigate: (page: MenuPage) => void; close: () => void; agentPanel?: ReactNode; state: GameState; unlock: () => void; toggleCheats: () => void; heal: () => void };
export function MenuPages({ page, navigate, close, agentPanel, state, unlock, toggleCheats, heal, dispatch }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (page) heading.current?.focus(); }, [page]);
  return <section className="menu-page" hidden={!page} aria-label="游戏菜单" onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); page === "menu" ? close() : navigate("menu"); } }}>
    <div className="menu-page__content">
      <PencilText as="h2" ref={heading} tabIndex={-1} seed="menu-heading">{page === "menu" ? "菜单" : pages.find(item => item.id === page)?.label ?? "菜单"}</PencilText>
      <nav className="menu-page__items" aria-label="菜单选项" hidden={page !== "menu"}>
        {pages.map(item => <Button key={item.id} variant="outline" onClick={() => navigate(item.id)}>{item.label}</Button>)}
        <Button onClick={close}>继续游戏</Button>
      </nav>
      <div className="menu-page__detail" hidden={page !== "character"}><CharacterPage state={state} dispatch={dispatch} /></div>
      <div className="menu-page__detail" hidden={page !== "settings"}>
        <PencilText as="h3" seed="debug-heading">调试选项</PencilText><PencilText as="p" seed="debug-help">作弊功能需在本机明确解锁。</PencilText>
        {!state.cheats.unlocked ? <Button variant="outline" onClick={unlock}>解锁作弊</Button> : <><Button variant="outline" onClick={toggleCheats}>{state.cheats.enabled ? "关闭作弊" : "启用作弊"}</Button>{state.cheats.enabled && <Button variant="secondary" onClick={heal}>恢复领地</Button>}</>}
      </div>
      <div className="menu-page__detail" hidden={page !== "agent"}>{agentPanel ?? <PencilText as="p" seed="agent-unavailable">Agent 连接不可用。</PencilText>}</div>
      <div className="menu-page__detail" hidden={page !== "accessibility"}><PencilText as="p" seed="accessibility-help">界面支持键盘操作；可使用系统的文字缩放与减少动态效果设置。</PencilText></div>
      {page && page !== "menu" && <Button variant="ghost" onClick={() => navigate("menu")}>返回菜单</Button>}
    </div>
  </section>;
}
