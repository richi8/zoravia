/** Every pack the game ships, in load order (C34). */

import { corePack } from './core';
import { emberwastePack } from './emberwaste';

export const SHIPPED_PACKS = [corePack, emberwastePack] as const;
