
// Seeds the demo learner with 9 practice results (labelled as seeded demo history in the UI).
import { memoryText, ACCOUNT_ID } from '../site/worker.mjs';
import { MemWal } from '@mysten-incubation/memwal';
const L = 'demo-aspirant-01';
const rows = [
 ['botany-plant-physiology',1,['C4 pathway','Kranz anatomy','CAM plants']],
 ['agriculture-soil-science',2,['Cation exchange capacity','Soil pH buffering']],
 ['forestry-gs-polity',4,[]],
 ['botany-plant-physiology',2,['Photorespiration','C4 pathway']],
 ['agriculture-genetics-plant-breeding',3,['Heterosis']],
 ['forestry-gs-environment-ecology',4,[]],
 ['agriculture-soil-science',1,["Liebig's law of minimum",'Micronutrient deficiency','Cation exchange capacity']],
 ['forestry-gs-forestry',3,['Joint Forest Management']],
 ['agriculture-agronomy',2,['Pre-emergence herbicides','Crop rotation']],
];
const mw = MemWal.create({ key: process.env.MEMWAL_KEY, accountId: ACCOUNT_ID, serverUrl: 'https://relayer.memory.walrus.xyz', namespace: 'coach-' + L });
const items = rows.map(([t,s,m]) => ({ text: memoryText({ topicId: t, score: s, total: 4, missed: m }), namespace: 'coach-' + L }));
const r = await mw.rememberBulkAndWait(items);
console.log(JSON.stringify(r, (k,v)=>typeof v==='bigint'?v.toString():v).slice(0, 3000));
process.exit(0);
