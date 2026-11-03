import type { ContentCatalog, GameEvent, GameState, RunStatistics } from '../contracts';

const fields = ['spellsAcquired','arcanaAcquired','charactersAcquired','levelsGained','enemiesDefeated','bossesDefeated','coinsEarned','wavesCleared'] as const;
const validCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const amount = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0;
const lowerSum = (left: number, right: number): number => Math.min(Number.MAX_SAFE_INTEGER, left + right);
export type RunCounter = typeof fields[number];
const isBoss = (definitionId: unknown): boolean => typeof definitionId === 'string' && ['boss-minor','boss-major','boss-apex'].includes(definitionId);
export function createRunStatistics(): RunStatistics {
  return {version:1,complete:true,spellsAcquired:0,arcanaAcquired:0,charactersAcquired:0,levelsGained:0,enemiesDefeated:0,bossesDefeated:0,coinsEarned:0,wavesCleared:0};
}

/** All counters stay projection-safe. Overflow or malformed values can never remain exact. */
export function addRunStatistic(stats: RunStatistics, counter: RunCounter, increment: number): RunStatistics {
  const next = createRunStatistics();
  next.complete = stats.complete === true;
  for (const field of fields) {
    if (!validCount(stats[field])) next.complete = false;
    next[field] = amount(stats[field]);
  }
  if (!validCount(increment)) next.complete = false;
  const addition = amount(increment);
  if (addition > Number.MAX_SAFE_INTEGER - next[counter]) next.complete = false;
  next[counter] = lowerSum(next[counter], addition);
  return next;
}

/** Consume only the new engine transition events; coinIncrease is its positive balance difference. */
export function accumulateBattleStatistics(stats: RunStatistics, events: readonly GameEvent[], coinIncrease: number): RunStatistics {
  let next = addRunStatistic(stats, 'coinsEarned', coinIncrease);
  const seen = new Set<number>();
  for (const event of events) {
    if (seen.has(event.seq)) continue;
    seen.add(event.seq);
    if (event.type === 'enemyKilled') {
      next = addRunStatistic(next, 'enemiesDefeated', 1);
      if (isBoss(event.data.definitionId)) next = addRunStatistic(next, 'bossesDefeated', 1);
    } else if (event.type === 'waveCleared') next = addRunStatistic(next, 'wavesCleared', 1);
    else if (event.type === 'characterLevelUp') {
      const {level, previousLevel} = event.data;
      if (Number.isSafeInteger(level) && Number.isSafeInteger(previousLevel) && (previousLevel as number) >= 1 && (level as number) > (previousLevel as number)) next = addRunStatistic(next, 'levelsGained', (level as number) - (previousLevel as number));
      else next.complete = false;
    }
  }
  return next;
}

/** Old saves supply confirmed lower bounds, never a reconstructed exact total. */
export function restoreRunStatistics(state: GameState, content: ContentCatalog): RunStatistics {
  const saved = state.runStatistics;
  if (saved?.version === 1 && typeof saved.complete === 'boolean' && fields.every(key => validCount(saved[key]))) return {...saved};
  const stats = createRunStatistics();
  stats.complete = false;
  const starterIds = new Set(['spark-1','amplify-1']);
  for (const item of Object.values(state.items)) {
    // Merge outputs may consist entirely of starter items; they are not proof of acquisition.
    if (starterIds.has(item.id) || item.id.endsWith(':merged') || item.id.endsWith(':output')) continue;
    if (item.kind === 'spell') stats.spellsAcquired++;
    if (item.kind === 'arcana') stats.arcanaAcquired++;
  }
  let historySpells=0,historyArcana=0,historyCharacters=0,historyCoins=0;
  for (const entry of state.rewardHistory ?? []) {
    const reward=entry.reward;
    if (reward.kind === 'character') historyCharacters++;
    if (reward.kind === 'coins') historyCoins = lowerSum(historyCoins, amount(reward.amount));
    if (reward.kind === 'item' && reward.definitionId) {
      if (Object.hasOwn(content.spells,reward.definitionId)) historySpells++;
      else if (Object.hasOwn(content.arcana,reward.definitionId)) historyArcana++;
    }
  }
  stats.spellsAcquired=Math.max(stats.spellsAcquired,historySpells);
  stats.arcanaAcquired=Math.max(stats.arcanaAcquired,historyArcana);
  stats.charactersAcquired=Math.max(Math.max(0,state.characters.length-1),historyCharacters);
  const currentLevels=state.characters.reduce((sum,character)=>lowerSum(sum,Math.max(0,amount(character.level)-1)),0);
  let boundary=0;
  state.events.forEach((event,index)=>{if(event.type==='game.restarted')boundary=index;});
  const events=state.events.slice(boundary);
  const seen=new Set<number>();
  const battleCoins=events.reduce((sum,event)=>{
    if(seen.has(event.seq))return sum;
    seen.add(event.seq);
    return lowerSum(sum,['enemyKilled','waveCleared'].includes(event.type)?amount(event.data.coins):0);
  },0);
  const recovered=accumulateBattleStatistics(stats,events,0);
  recovered.levelsGained=Math.max(currentLevels,recovered.levelsGained);
  recovered.coinsEarned=Math.max(amount(state.coins),lowerSum(historyCoins,battleCoins));
  return recovered;
}
