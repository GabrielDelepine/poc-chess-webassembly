import { Chess, SQUARES, WHITE } from "chess.js"
import { Chessground } from "chessground"

import type { Api as Chessground_Api } from "chessground/api.js"
import type {
  Key as Chessground_Key,
  MoveMetadata as Chessground_MoveMetadata,
} from "chessground/types.js"

// TODO let the user choose the depth (disabled for random moves)
// TODO implement stockfish (js / native with wasm)
// TODO implement Fairy-Stockfish (js / native with wasm)
// TODO fix promotion
// TODO support various languages based on the browser setting

export const SUPPORTED_ENGINES = ["random"] as const
const SUPPORTED_EVENTS = ["engineReturns"] as const

type Engine = (
  orig: Chessground_Key,
  dest: Chessground_Key,
  metadata: Chessground_MoveMetadata
) => void

export class StandaloneWebChess {
  #cg: Chessground_Api
  #chess: Chess
  #currentEngineName?: string
  #onEngineReturns: Function[] = []

  constructor(
    el: HTMLElement,
    engineName: (typeof SUPPORTED_ENGINES)[number] = "random"
  ) {
    this.#chess = new Chess()

    this.#cg = Chessground(el, {
      movable: {
        color: "white",
        free: false,
        dests: this.#getLegalMoves(),
      },
    })

    this.changeEngine(engineName)
  }

  addEventListener(type: (typeof SUPPORTED_EVENTS)[number], fn: Function) {
    switch (type) {
      case "engineReturns":
        this.#onEngineReturns.push(fn)
        break
    }
  }

  async changeEngine(
    engineName?: (typeof SUPPORTED_ENGINES)[number]
  ): Promise<void> {
    const after: Engine = this.#engines[engineName || "none"]

    const wrapper: Engine = (orig, dest, metadata) => {
      this.#chess.move({ from: orig, to: dest })

      const startAt = Date.now()

      after(orig, dest, metadata)

      this.#onEngineReturns.forEach((fn) =>
        fn({ duration: Date.now() - startAt })
      )

      this.#cg.playPremove()
    }

    this.#cg.set({
      movable: {
        events: {
          after: wrapper,
        },
      },
    })

    this.#currentEngineName = engineName
  }

  get currentEngineName() {
    return this.#currentEngineName
  }

  #engines: Record<(typeof SUPPORTED_ENGINES)[number] | "none", Engine> = {
    none: () => {
      this.#cg.set({
        turnColor: this.turnColor,
        movable: {
          color: this.turnColor,
          dests: this.#getLegalMoves(),
        },
      })
    },
    random: () => {
      // Random AI simulator (found here https://github.com/lichess-org/chessground-examples/blob/65821c0b4d310243ab8577b383ac4f60eb8228c8/src/units/play.ts)
      const moves = this.#chess.moves({ verbose: true })

      const move = moves[Math.floor(Math.random() * moves.length)]

      this.#chess.move(move.san)

      this.#cg.move(move.from, move.to)

      this.#cg.set({
        turnColor: this.turnColor,
        movable: {
          color: this.turnColor,
          dests: this.#getLegalMoves(),
        },
      })
    },
  }

  #getLegalMoves() {
    const dests = new Map()

    SQUARES.forEach((s) => {
      const ms = this.#chess.moves({ square: s, verbose: true })
      if (ms.length)
        dests.set(
          s,
          ms.map((m) => m.to)
        )
    })

    return dests
  }

  removeEventListener(
    type: (typeof SUPPORTED_EVENTS)[number],
    fnToRemove: Function
  ) {
    switch (type) {
      case "engineReturns":
        const indexes = this.#onEngineReturns
          .map((fn, index) => (fn === fnToRemove ? index : -1))
          .filter((index) => index !== -1)

        for (const index of indexes) {
          this.#onEngineReturns.splice(index, 1)
        }
        break
    }
  }

  get turnColor() {
    return this.#chess.turn() === WHITE ? "white" : "black"
  }
}
