/** Every pack the game ships, in load order (C34; Rimeholm added in C35). */

import { corePack } from './core';
import { emberwastePack } from './emberwaste';
import { rimeholmPack } from './rimeholm';

export const SHIPPED_PACKS = [corePack, emberwastePack, rimeholmPack] as const;
