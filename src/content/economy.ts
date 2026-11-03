import type { ContentCatalog, GameState } from '../contracts';
import { getCharacterStats } from './characters';

export interface GatheringStats { base: number; equipment: number; run: number; total: number; multiplier: number }
export interface CoinIncome { baseAmount: number; amount: number; bonusAmount: number; gatheringPercent: number; remainder: number }
const percent = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0,Math.min(1_000_000,value)) : 0;
const remainderOf = (state: GameState): number => typeof state.coinIncomeRemainder === 'number' && Number.isFinite(state.coinIncomeRemainder) && state.coinIncomeRemainder >= 0 && state.coinIncomeRemainder < 1 ? state.coinIncomeRemainder : 0;

/** Current characters are the deployed team; a run-wide bonus is counted once for the whole team. */
export function getGatheringStats(state: GameState, content?: ContentCatalog): GatheringStats {
  let base=0,equipment=0;
  const seen=new Set<string>();
  for(const character of state.characters) {
    if(seen.has(character.id))continue;
    seen.add(character.id);
    const view=getCharacterStats(state,character.id,content);
    if(!view)continue;
    base+=percent(view.base.gatheringPercent);
    equipment+=percent(view.equipment.gatheringPercent);
  }
  const run=percent(state.runBonuses?.gatheringPercent);
  const total=base+equipment+run;
  return {base,equipment,run,total,multiplier:1+total/100};
}

/** The sole positive-income mutation: no RNG, events or statistics. Spending bypasses this helper. */
export function grantCoinIncome(state: GameState, baseAmount: number, content?: ContentCatalog): CoinIncome {
  const remainder=remainderOf(state);
  const refused:CoinIncome={baseAmount:0,amount:0,bonusAmount:0,gatheringPercent:0,remainder};
  if(!Number.isFinite(baseAmount) || baseAmount<=0 || baseAmount>Number.MAX_SAFE_INTEGER
      || !Number.isFinite(state.coins) || state.coins<0 || state.coins>Number.MAX_SAFE_INTEGER) return refused;
  const stats=getGatheringStats(state,content);
  const raw=baseAmount*stats.multiplier+remainder;
  if(!Number.isFinite(raw) || raw>Number.MAX_SAFE_INTEGER) return refused;
  const nearest=Math.round(raw);
  const tolerance=Math.min(1e-9,Number.EPSILON*Math.max(1,Math.abs(raw))*4);
  const exact=Math.abs(raw-nearest)<=tolerance?nearest:raw;
  const amount=Math.floor(exact);
  if(amount>Number.MAX_SAFE_INTEGER-state.coins) return refused;
  const balance=state.coins+amount;
  if(!Number.isFinite(balance) || balance>Number.MAX_SAFE_INTEGER) return refused;
  const nextRemainder=exact-amount;
  state.coins=balance;
  state.coinIncomeRemainder=nextRemainder;
  return {baseAmount,amount,bonusAmount:amount-baseAmount,gatheringPercent:stats.total,remainder:nextRemainder};
}
