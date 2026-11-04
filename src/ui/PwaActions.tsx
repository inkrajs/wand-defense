import { useSyncExternalStore } from 'react';
import { Button, PencilIcon, PencilLine, PencilText, type PencilIconPath } from '@inkra/react';
import { applyPwaUpdate, checkPwaUpdate, getInstallInstructions, getPwaState, installPwa, subscribePwa } from '../pwa';
import type { PwaState } from '../pwa/state';
import './PwaActions.css';

const checkPaths: PencilIconPath[] = [{d: 'M20 6v6h-6M19 12a7 7 0 1 1-2-5', mode: 'stroke'}];
const applyPaths: PencilIconPath[] = [{d: 'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5', mode: 'stroke'}];
const installPaths: PencilIconPath[] = [{d: 'M4 3h16v13H4zM8 21h8m-4-5v5M9 8l3 3 3-3m-3-3v6', mode: 'stroke'}];

function updateDescription(state: PwaState): string {
  if (!state.production) return '开发预览不提供安装与更新，请使用正式站点。';
  if (!state.supported) return '当前浏览器不支持应用更新，可在浏览器中重新打开正式站点。';
  switch (state.update) {
    case 'idle': return '打开应用、回到前台或恢复网络时会自动检查更新。';
    case 'checking': return '正在检查更新…';
    case 'downloading': return '正在下载应用资源，游戏可以继续运行。';
    case 'current': return '当前没有可应用的新版本。';
    case 'offline-ready': return '首次离线资源已准备好；下次打开时即可使用。';
    case 'available': return '更新已下载。点击应用更新后，将重新打开当前页面。';
    case 'applying': return '正在应用更新…';
    case 'offline': return '当前离线，联网后会再次检查，也可手动重试。';
    case 'timeout': return '检查更新超时，可以重试。';
    case 'failed': return '暂时无法检查或下载更新，可以稍后重试。';
    case 'restart-required': return '当前旧窗口无法直接应用更新。请关闭此应用的所有旧窗口，再重新打开；本机存档会保留。';
    default: return '当前无法检查更新。';
  }
}

export function PwaActions() {
  const state = useSyncExternalStore(subscribePwa, getPwaState, getPwaState);
  const installing = state.install === 'prompting' || state.install === 'awaiting';
  const installDescription = !state.production ? '安装功能仅在正式站点提供。'
    : state.install === 'installed' ? '已安装到当前设备，或正在以独立应用窗口运行。'
    : state.install === 'available' ? '可将游戏安装到当前设备。'
    : state.install === 'prompting' ? '请在系统安装提示中选择。'
    : state.install === 'awaiting' ? '已接受安装，正在等待系统确认完成。'
    : `${state.install === 'dismissed' ? '你已取消本次安装。' : state.install === 'failed' ? '无法打开安装提示。' : ''}${getInstallInstructions()}`;
  return <div className="pwa-actions">
    <section className="pwa-actions__section" aria-label="应用更新">
      <PencilText as="p" className="pwa-actions__status" role="status">{updateDescription(state)}</PencilText>
      <div className="pwa-actions__buttons">
        <Button variant="outline" disabled={!state.production || !state.supported || ['checking', 'downloading', 'applying'].includes(state.update)} onClick={() => {void checkPwaUpdate();}}>
          <PencilIcon paths={checkPaths} sourceSize={24} size={24} decorative />检查更新
        </Button>
        <Button variant="outline" disabled={state.update !== 'available'} onClick={() => {void applyPwaUpdate();}}>
          <PencilIcon paths={applyPaths} sourceSize={24} size={24} decorative />应用更新
        </Button>
      </div>
    </section>
    <PencilLine seed="pwa-actions-divider" aria-hidden="true" />
    <section className="pwa-actions__section" aria-label="安装到当前设备">
      <PencilText as="p" className="pwa-actions__status" role="status">{installDescription}</PencilText>
      <div className="pwa-actions__buttons">
        <Button variant="outline" disabled={!state.production || state.install !== 'available' || installing} onClick={() => {void installPwa();}}>
          <PencilIcon paths={installPaths} sourceSize={24} size={24} decorative />安装到当前设备
        </Button>
      </div>
    </section>
  </div>;
}
