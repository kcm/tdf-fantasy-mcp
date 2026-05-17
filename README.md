# TdF Fantasy MCP

An MCP (Model Context Protocol) server for the [Tour de France Fantasy game](https://fantasy.letour.fr) by Tissot.

## Overview

This server exposes the Tour de France Fantasy game API as MCP tools, letting you query riders, teams, stages, standings, and leaderboards from any MCP-compatible client (Claude Desktop, etc.).

The underlying API lives at `https://fantasybytissot.letour.fr/v1`.

## Requirements

- **Node.js >= 20** — the server uses native `fetch`, which requires Node 18+ and is stable from Node 20 onward. Check your version with `node --version`; use [nvm](https://github.com/nvm-sh/nvm) to switch if needed.
- **Recommended companion: [firstcycling-mcp](https://github.com/r-huijts/firstcycling-mcp)** — 11 of the 18 prompts follow a two-phase pattern that enriches fantasy recommendations with FirstCycling historical palmares and terrain data. The tools work without it, but the prompts produce noticeably better output when both servers are connected.
- **Auth token** — public tools (`get_game_config`, `get_riders`, `get_teams`) work without authentication. All other tools require a valid JWT from the game. See [Authentication](#authentication) below.

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

## Prompts

The server exposes 18 MCP prompts that clients like Claude Desktop surface as slash commands or quick actions. Select a prompt, fill in the arguments, and Claude will call the relevant tools automatically.

Prompts follow a **two-phase pattern**: first fetch live fantasy data (riders, prices, stage calendar, your team) using the tdf-fantasy tools, then enrich the analysis with [firstcycling-mcp](https://github.com/r-huijts/firstcycling-mcp) for historical palmares, recent form, and terrain-specific performance. Having both servers connected gives the best results.

**Example — finding the best value climbers under 14 credits:**
> Invoke `best_value_picks` with `max_price=14`, `specialty=climber`
>
> Claude fetches all affordable riders from the fantasy API, checks the upcoming mountain stage profiles, then looks each candidate up on FirstCycling to verify their climbing palmares and current form before ranking them.

### Team Building

| Prompt | Arguments | What it does |
|--------|-----------|--------------|
| `strongest_team` | `budget` (req), `strategy` (req: gc/climber/sprinter/puncher/breakaway) | Builds the strongest 8-rider team for your budget and strategy; validates picks against FirstCycling palmares |
| `best_value_picks` | `max_price` (req), `specialty` (opt) | Finds best value-for-money riders under a price cap; enriches with FirstCycling form and terrain fit |
| `design_specialty_team` | `specialty` (req), `budget` (req) | Designs a full team around one racing specialty; FirstCycling validates each rider's track record |
| `go_all_in_breakaways` | `budget` (req) | Builds an aggressive breakaway-specialist team; FirstCycling verifies actual breakaway history |

### Exchange Planning

| Prompt | Arguments | What it does |
|--------|-----------|--------------|
| `plan_transfers` | `stages_ahead` (req), `exchanges_remaining` (req) | Plans optimal transfers for the next N stages; matches terrain against FirstCycling specialties before recommending swaps |
| `who_to_drop_before_stage` | `stage_number` (req) | Identifies drop candidates before a specific stage with replacement suggestions |
| `replacement_for_abandoned_rider` | `abandoned_rider_name` (req), `budget` (req) | Finds the best replacement after a key rider abandons |
| `final_week_strategy` | `exchanges_remaining` (req) | Devises an end-of-Tour transfer plan for the mountain stages, TT, and Champs-Élysées |

### Team Analysis

| Prompt | Arguments | What it does |
|--------|-----------|--------------|
| `analyze_team_form` | none | Analyses your team's points trajectory; uses FirstCycling recent results to distinguish bad form from bad luck |
| `who_is_underperforming` | none | Identifies underperformers relative to price; FirstCycling checks whether they're fading or due a result |
| `flag_injury_risks` | none | Flags injury and fatigue risks; FirstCycling recent results spot pre-Tour patterns |
| `close_gap_on_rival` | `rival_name` (req) | Plans a gap-closing strategy; compares both teams' riders via FirstCycling terrain fit for remaining stages |

### Preference-Personalised

| Prompt | Arguments | What it does |
|--------|-----------|--------------|
| `team_around_nationality` | `nationality` (req), `budget` (req) | Builds a team featuring as many riders of a given nationality as possible; ranked by FirstCycling palmares |
| `team_around_pro_team` | `pro_team_name` (req), `budget` (req) | Anchors a fantasy team around riders from a specific professional team |
| `find_riders_like_favorite` | `favorite_rider_name` (req) | Finds riders with a similar profile; FirstCycling career match drives the comparison |
| `specialty_first_team` | `specialty` (req), `budget` (req), `preferred_nationality` (opt) | Builds a specialty-first team with an optional nationality tie-break |
| `scout_riders_from_country` | `nationality` (req), `max_price` (req) | Scouts a country's riders under a price cap; FirstCycling palmares is the primary ranking signal |
| `preferred_riders_value_check` | `rider_names` (req, comma-separated), `budget` (req) | Checks whether a personal watchlist fits within budget and at good value |
