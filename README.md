# TdF Fantasy MCP

An MCP (Model Context Protocol) server for the [Tour de France Fantasy game](https://fantasy.letour.fr) by Tissot.

## Overview

This server exposes the Tour de France Fantasy game API as MCP tools, letting you query riders, teams, stages, standings, and leaderboards from any MCP-compatible client (Claude Desktop, etc.).

The underlying API lives at `https://fantasybytissot.letour.fr/v1`.

## Setup

### Install

```bash
npm install
npm run build
```

### Authentication

Some tools require a valid auth token from the game. To obtain one:

1. Open [fantasy.letour.fr](https://fantasy.letour.fr) in your browser
2. Log in to your account
3. Open DevTools → Network tab
4. Make any in-game action and look for requests to `fantasybytissot.letour.fr/v1/private/`
5. Copy the `Authorization` header value (everything after `Token `)

Set it as an environment variable before running:

```bash
export TDF_AUTH_TOKEN="your_jwt_token_here"
```

Tools that don't require auth (`get_game_config`, `get_riders`, `get_teams`) work without a token.

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tdf-fantasy": {
      "command": "node",
      "args": ["/path/to/tdf-fantasy-mcp/dist/index.js"],
      "env": {
        "TDF_AUTH_TOKEN": "your_jwt_token_here"
      }
    }
  }
}
```

## Available Tools

### Public (no auth required)

| Tool | Description |
|------|-------------|
| `get_game_config` | Full game configuration: budget, team size, rider positions, rules |
| `get_riders` | All riders with names, teams, prices, positions (active season only) |
| `get_teams` | All professional cycling teams |

### Private (auth required)

| Tool | Description |
|------|-------------|
| `get_current_stage` | Current stage info and results |
| `get_stage` | Specific stage info by number |
| `get_stage_calendar` | Stage schedule/calendar |
| `get_general_standings` | Overall fantasy leaderboard for a group |
| `get_stage_standings` | Per-stage leaderboard for a group |
| `get_my_leagues` | Your leagues/groups |
| `get_league` | Details about a specific league |
| `search_leagues` | Search for leagues by name or code |
| `get_rider_stats` | Rider statistics with optional filters |
| `get_top_transactions` | Most bought/sold riders |
| `get_user_profile` | User fantasy profile and team |
| `get_rider_positions` | Position type definitions |
| `get_hall_of_fame` | All-time top performers |
| `get_player_progression` | Point progression across stages |
| `get_notifications` | Your game notifications |
| `get_user_credits` | Your credit balance |

## Rider Positions

| ID | Name | Description |
|----|------|-------------|
| 43 | Leaders | GC contenders |
| 44 | Polyvalents | All-rounders |
| 45 | Grimpeurs | Climbers |
| 46 | Sprinteurs | Sprinters |

## Notes

- The API goes into maintenance mode (`{"message": "Jeu en cours de mise à jour"}`) between editions of the Tour de France. Most private endpoints return this message off-season.
- The game runs annually during the Tour de France (typically July).
- Budget per team: 120M (standard), 160M (mercato mode)
- Team size: 8 riders

## Development

```bash
npm run dev    # Run with ts-node (no build step)
npm run build  # Compile to dist/
npm start      # Run compiled output
```
