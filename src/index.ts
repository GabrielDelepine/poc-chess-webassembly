import { Chessground } from "chessground"
import { Chess, SQUARES } from "chess.js"

function toDests(chess: Chess) {
  const dests = new Map()

  SQUARES.forEach((s) => {
    const ms = chess.moves({ square: s, verbose: true })
    if (ms.length)
      dests.set(
        s,
        ms.map((m) => m.to)
      )
  })

  return dests
}

export function init(el: HTMLElement): void {
  const chess = new Chess()

  const color = "white"

  const cg = Chessground(el, {
    movable: {
      color,
      free: false,
      dests: toDests(chess),
    },
  })

  // BEGIN: AI simulator (found here https://github.com/lichess-org/chessground-examples/blob/65821c0b4d310243ab8577b383ac4f60eb8228c8/src/units/play.ts)
  cg.set({
    movable: {
      events: {
        after: (orig, dest) => {
          chess.move({ from: orig, to: dest })

          setTimeout(() => {
            const moves = chess.moves({ verbose: true })

            const move =
              color !== "white"
                ? moves[0]
                : moves[Math.floor(Math.random() * moves.length)]

            chess.move(move.san)

            cg.move(move.from, move.to)

            cg.set({
              turnColor: chess.turn() === "w" ? "white" : "black",
              movable: {
                color: chess.turn() === "w" ? "white" : "black",
                dests: toDests(chess),
              },
            })

            cg.playPremove()
          }, 300)
        },
      },
    },
  })
  // END: AI simulator
}
