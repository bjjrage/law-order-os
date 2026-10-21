import { LegalBoard } from '../../src/orchestration/index.js';
import { MemoryBoardStore } from '../../src/persistence/index.js';
import { createOfflineProviders } from '../../src/providers/offline.js';
import { DEFAULT_CONFIG, type BoardConfig } from '../../src/providers/config.js';
import { demoFixture, simulationPrices } from '../../src/cli/demo.js';
export {demoFixture,syntheticDocument,citationFor,DEMO_ACTOR,EMPTY_METADATA,simulationPrices} from '../../src/cli/demo.js';
export function harness(config:Partial<BoardConfig>={}){
  const fixture=demoFixture();const store=new MemoryBoardStore();const providers=createOfflineProviders({...DEFAULT_CONFIG,...config});
  const board=new LegalBoard(fixture.index,store,providers,{...DEFAULT_CONFIG,...config},simulationPrices());return {...fixture,store,providers,board};
}
