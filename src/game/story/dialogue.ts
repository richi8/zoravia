/**
 * Dialogue runner (C26): walks a pack's dialogue graph against the party. Pure; the scene
 * shows each `view` and calls `next` when the player is done reading (with the choice, when
 * the view had some).
 *
 * Reaching a node runs its actions first (and moves quests on), so the notes they make
 * ("You received …", "Quest updated: …") show right after the node's pages. Nodes with no
 * pages and no notes are passed through at once (routing nodes).
 */

import type { DialogueChoice, DialogueNode, GameContent } from '@game/data';
import type { Party } from '@game/player';
import { act } from './actions';
import { holds } from './conditions';

export interface DialogueView {
  /** Spoken pages. */
  readonly pages: readonly string[];
  readonly speaker: string | undefined;
  /** What the actions did, shown after the pages without a speaker. */
  readonly notes: readonly string[];
  /** Choice labels, offered with the last page or note. Empty: no choice. */
  readonly choices: readonly string[];
}

/** Most nodes passed through without showing anything (guards against loops). */
const MAX_HOPS = 64;

export class DialogueRun {
  private current: DialogueView | undefined;
  private choiceList: DialogueChoice[] = [];
  private pending: string | undefined;
  private state: Party;
  private readonly nodes: Readonly<Record<string, DialogueNode>>;

  /**
   * @param speaker who speaks when a node names no one (the NPC talked to).
   */
  constructor(
    private readonly content: GameContent,
    dialogueId: string,
    party: Party,
    private readonly speaker?: string,
  ) {
    this.state = party;
    const dialogue = content.dialogues.require(dialogueId);
    this.nodes = dialogue.nodes;
    this.enter(dialogue.start, []);
  }

  /** The party with every action so far applied. */
  get party(): Party {
    return this.state;
  }

  /** What to show now; undefined once the dialogue has ended. */
  get view(): DialogueView | undefined {
    return this.current;
  }

  get done(): boolean {
    return this.current === undefined;
  }

  /**
   * The current view was read. `choice` is an index into `view.choices` (out of range or
   * left out on a choice view: the last choice, like `Q`).
   */
  next(choice?: number): void {
    const view = this.current;
    if (!view) return;
    if (view.choices.length) {
      const c = this.choiceList[choice ?? -1] ?? this.choiceList[this.choiceList.length - 1];
      const r = act(this.content, this.state, c?.do ?? []);
      this.state = r.party;
      if (r.notes.length) {
        // What the choice did shows first, then the node it leads to.
        this.choiceList = [];
        this.pending = c?.goto;
        this.current = { pages: [], speaker: undefined, notes: r.notes, choices: [] };
        return;
      }
      this.enter(c?.goto, []);
      return;
    }
    this.enter(this.pending, []);
  }

  private enter(start: string | undefined, carried: string[]): void {
    const nodes = this.nodes;
    let id = start;
    let notes = carried;
    for (let hop = 0; hop < MAX_HOPS && id !== undefined; hop++) {
      const node = nodes[id];
      if (!node) break;
      const r = act(this.content, this.state, node.do ?? []);
      this.state = r.party;
      notes = [...notes, ...r.notes];
      const pages = node.say ?? [];
      const speaker = node.speaker ?? this.speaker;
      const offered = (node.choices ?? []).filter(
        (c) => !c.if || holds(this.content, this.state, c.if),
      );
      if (offered.length) {
        this.choiceList = offered;
        this.pending = undefined;
        this.current = { pages, speaker, notes, choices: offered.map((c) => c.text) };
        return;
      }
      // A node whose choices are all hidden ends the dialogue.
      const next = node.choices ? undefined : this.route(node);
      if (pages.length || notes.length) {
        this.choiceList = [];
        this.pending = next;
        this.current = { pages, speaker, notes, choices: [] };
        return;
      }
      id = next;
    }
    this.choiceList = [];
    this.pending = undefined;
    this.current = notes.length ? { pages: [], speaker: undefined, notes, choices: [] } : undefined;
  }

  private route(node: DialogueNode): string | undefined {
    for (const b of node.branch ?? []) if (holds(this.content, this.state, b.if)) return b.goto;
    return node.goto;
  }
}
