"""Command routing for the web server and command-line calculator."""

import argparse
from pathlib import Path

from .paths import EXAMPLES_DIR


def main(argv=None):
    parser = argparse.ArgumentParser(prog="wattwise", description="Local energy planning with WattWise.")
    commands = parser.add_subparsers(dest="command")
    parser.set_defaults(command="serve", port=8765)

    serve = commands.add_parser("serve", help="Start the local web application (the default command).")
    serve.add_argument("--port", type=int, default=8765)

    estimate = commands.add_parser("estimate", help="Run the command-line energy calculator.")
    estimate.add_argument("--input", type=Path, default=EXAMPLES_DIR / "household.json")
    estimate.add_argument("--mode", choices=["manual", "simulated"], default="manual")
    estimate.add_argument("--gemma", action="store_true", help="Send the summary to hosted Gemma for explanation.")

    args = parser.parse_args(argv)
    if args.command == "serve":
        from .server import serve as run_server

        run_server(args.port)
        return 0

    from .cli import main as estimate_energy

    return estimate_energy(args.input, args.mode, args.gemma)


if __name__ == "__main__":
    raise SystemExit(main())
