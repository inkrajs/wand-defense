/** Development-only asset source. Open /scripts/app-icon.html through Vite.
 * exportAppIcons() exports the public Inkra renderer into static favicon/PWA art.
 * The ordinary icon has transparent rounded corners; maskable art is full bleed.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PencilIcon, type PencilIconPath } from '@inkra/react';
import '@inkra/react/styles.css';
import { getCharacterPresentationIcon } from '../src/ui/characterPresentationIcons';

const outline = getCharacterPresentationIcon('fire').paths;
const filled: readonly PencilIconPath[] = [
  { d: 'M6 16c1-4 3-8 6-12 3 4 5 8 6 12Z', mode: 'wash', color: '#c65d38' },
  { d: 'M4 17c3-1 5-1 8-1s5 0 8 1l-1 2H5l-1-2Z', mode: 'wash', color: '#9d4c32' },
  ...outline,
];
createRoot(document.getElementById('root')!).render(
  <PencilIcon paths={outline} filledPaths={filled} variant="filled" width={440} height={440}
    sourceSize={24} viewBox={{ x: 1, y: 1, width: 22, height: 22 }}
    strokeWidth={0.5} intensity={0.96} breaks={0.1} pressureVariation={0.65}
    fillColor="#c65d38" style={{color:'#87452f'}} seed="endless-wizard-app-icon-v2" />
);

Object.assign(window, { exportAppIcons() {
  const source = document.querySelector('canvas');
  if (!source) throw new Error('Wait for the Inkra canvas to render');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const draw = (rounded: boolean) => {
    context.clearRect(0,0,512,512);
    context.save();
    if (rounded) { context.beginPath(); context.roundRect(0,0,512,512,104); context.clip(); }
    context.fillStyle = '#f4f0e3'; context.fillRect(0,0,512,512);
    context.drawImage(source,36,36,440,440);
    context.restore();
    return canvas.toDataURL('image/png');
  };
  const rounded = draw(true);
  const small = document.createElement('canvas');small.width=small.height=192;
  small.getContext('2d')!.drawImage(canvas,0,0,192,192);
  const smallIcon = small.toDataURL('image/png');
  // Embed smallIcon in wizard-rounded.svg; save PNGs to public/icons/.
  return { rounded, maskable:draw(false), small:smallIcon };
} });
