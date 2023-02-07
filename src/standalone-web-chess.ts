import { Chess, SQUARES, WHITE } from "chess.js"
import type { Move } from "chess.js"
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

export const SUPPORTED_ENGINES = [
  "random",
  "stockfish-SF_classical",
  // description = SF_classical, not ESM package
  // source = https://github.com/lichess-org/stockfish.wasm/blob/master/index.html https://www.npmjs.com/package/stockfish.wasm
  // "stockfish-nnue",
  // // description = NNUE
  // // source = https://github.com/hi-ogawa/Stockfish
] as const // todo, return name + url source code
const SUPPORTED_EVENTS = ["engineReturns"] as const

type Engine = (
  orig: Chessground_Key,
  dest: Chessground_Key,
  metadata: Chessground_MoveMetadata
) => Promise<Move | string>

export class StandaloneWebChess {
  #cg: Chessground_Api
  #chess: Chess
  #currentEngineName?: string
  #engineDepth: number = 15
  #onEngineReturns: Function[] = []
  #sf: any // stockfish not ESM from

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
    if (engineName === "stockfish-SF_classical") {
      // NOT AN ESM MODULE
      this.#sf = await (window as any).Stockfish()
    }

    this.#cg.set({
      movable: {
        events: {
          after: async (orig, dest, metadata) => {
            // inform chess.js of the move
            this.#chess.move({ from: orig, to: dest })

            const startAt = Date.now()

            if (engineName) {
              const selectedMove = await this.#engines[engineName](
                orig,
                dest,
                metadata
              )

              this.#onEngineReturns.forEach((fn) =>
                fn({ duration: Date.now() - startAt })
              )

              const { from, to } = this.#chess.move(selectedMove)

              this.#cg.move(from, to)
            }

            this.#cg.set({
              turnColor: this.turnColor,
              movable: {
                color: this.turnColor,
                dests: this.#getLegalMoves(),
              },
            })

            this.#cg.playPremove()
          },
        },
      },
    })

    this.#currentEngineName = engineName
  }

  changeEngineDepth(engineDepth: number) {
    if (engineDepth < 0 || engineDepth > 30) {
      throw new Error(
        "StandaloneWebChess.changeEngineDepth: Invalid engine depth value"
      )
    }

    this.#engineDepth = engineDepth
  }

  get currentEngineDepth() {
    return this.#engineDepth
  }

  get currentEngineName() {
    return this.#currentEngineName
  }

  #engines: Record<(typeof SUPPORTED_ENGINES)[number], Engine> = {
    random: async () => {
      // Random AI simulator (found here https://github.com/lichess-org/chessground-examples/blob/65821c0b4d310243ab8577b383ac4f60eb8228c8/src/units/play.ts)
      const moves = this.#chess.moves({ verbose: true })

      const selectedMove = moves[Math.floor(Math.random() * moves.length)]

      return selectedMove
    },
    "stockfish-SF_classical": () => {
      return new Promise((resolve) => {
        const listener = (line: any) => {
          console.info(line)

          if (typeof line === "string" && line.startsWith("bestmove ")) {
            const [, bestmove, , ponder] = line.split(" ")

            this.#sf.removeMessageListener(listener)

            resolve(bestmove)
          }
        }

        this.#sf.addMessageListener(listener)

        this.#sf.postMessage(`position fen ${this.#chess.fen()}`)
        this.#sf.postMessage(`go depth ${this.#engineDepth}`)
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
