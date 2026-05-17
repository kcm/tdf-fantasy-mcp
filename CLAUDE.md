# TdF Fantasy MCP — Claude Context

## Purpose

MCP server for the [Tour de France Fantasy game](https://fantasy.letour.fr) by Tissot.
Exposes game data (riders, teams, stages, standings, leaderboards) and fantasy management
actions as MCP tools, and provides 18 strategic prompts that combine fantasy game data
with FirstCycling historical stats for richer analysis.

---

## API

**Base URL:** `https://fantasybytissot.letour.fr/v1`

**Required header on every request:**
```
X-Access-Key: 630@16.17@
```
Format: `{identity}@{version}@{codeDemo}` — identity `630` is Tour de France, version `16.17`.

**Private endpoints additionally require:**
```
Authorization: Token {jwt}
```
The JWT comes from logging in at fantasy.letour.fr. Set it via the `TDF_AUTH_TOKEN` environment variable. If the variable is present, the server includes it on public endpoints too (no harm done).

**Off-season behaviour:** Between editions (outside roughly June–July), the game enters maintenance mode. Most `/private/` endpoints return `{"message": "Jeu en cours de mise à jour"}`. The `/public/config.json` endpoint stays live year-round and is the main signal that the API is reachable.

---

## Build & Run

**Node 18+ required** — the server uses native `fetch` (not available in Node 16).

```bash
npm install
npm run build      # tsc → dist/
npm start          # node dist/index.js
npm run dev        # ts-node src/index.ts (no build step)
```

Entry point: `dist/index.js`
Transport: stdio (MCP standard)

Key dependency: `@modelcontextprotocol/sdk` (requires Node ≥ 18).

---

## Claude Desktop Configuration

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

If using nvm, replace `node` with the full path, e.g. `~/.nvm/versions/node/v18.20.8/bin/node`.

---

## Tools (18 total)

### Public — no auth required

| Tool | Endpoint | Description |
|------|----------|-------------|
| `get_game_config` | `GET /public/config.json` | Full game config: budget, team size, positions, rules |
| `get_riders` | `GET /public/sportifs` | All riders with names, teams, prices, positions |
| `get_teams` | `GET /public/clubs` | All professional cycling teams |

### Stages — auth required

| Tool | Endpoint | Description |
|------|----------|-------------|
| `get_current_stage` | `GET /private/journee` | Current stage info and results |
| `get_stage` | `GET /private/journee/{n}` | Specific stage by number |
| `get_stage_calendar` | `GET /private/journeecalendrier/{n}` | Stage schedule/calendar |

### Standings — auth required

| Tool | Endpoint | Description |
|------|----------|-------------|
| `get_general_standings` | `GET /private/classementgeneral/{groupId}` | Overall fantasy leaderboard |
| `get_stage_standings` | `GET /private/classementjournee/{groupId}/{n}` | Per-stage leaderboard |
| `get_player_progression` | `GET /private/progressionjoueur/{groupId}/{n}` | Points across stages |
| `get_hall_of_fame` | `GET /private/halloffame` | All-time top performers |

### Leagues — auth required

| Tool | Endpoint | Description |
|------|----------|-------------|
| `get_my_leagues` | `GET /private/mesgroupes` | Leagues the user belongs to |
| `get_league` | `GET /private/infosgroupe/{groupId}` | Details about a specific league |
| `search_leagues` | `POST /private/groupessearch` | Search leagues by name or code |

### User & Stats — auth required

| Tool | Endpoint | Description |
|------|----------|-------------|
| `get_rider_stats` | `POST /private/stats` | Rider stats with optional filters |
| `get_top_transactions` | `GET /private/toptransaction` | Most bought/sold riders |
| `get_user_profile` | `GET /private/joueur/{id}` | User fantasy profile |
| `get_rider_positions` | `GET /private/positions` | Position type definitions |
| `get_notifications` | `GET /private/notification` | User notifications |
| `get_user_credits` | `GET /private/usercredits` | Credit balance |

---

## Prompts (18 total)

All prompts follow a **two-phase pattern**:

1. **Fantasy data phase** — fetch game data (riders, prices, stages, team) using the tdf-fantasy tools above
2. **FirstCycling enrichment phase** — look up relevant riders on the `firstcycling-mcp` server for historical palmares, terrain-specific performance, and recent form before making any recommendation

The user is expected to have `firstcycling-mcp` installed alongside this server. Prompts reference "FirstCycling tools" generically so Claude resolves them at runtime.

### Team Building

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `strongest_team` | `budget` (req), `strategy` (req: gc/climber/sprinter/puncher/breakaway) | Strongest 8-rider team; validates picks against FirstCycling palmares |
| `best_value_picks` | `max_price` (req), `specialty` (opt) | Best value under price cap; enriches with FirstCycling form/terrain fit |
| `design_specialty_team` | `specialty` (req), `budget` (req) | Full team around one specialty; FirstCycling validates track record |
| `go_all_in_breakaways` | `budget` (req) | Aggressive breakaway stack; FirstCycling verifies actual breakaway history |

### Exchange Planning

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `plan_transfers` | `stages_ahead` (req), `exchanges_remaining` (req) | Optimal transfer plan; matches stage terrain against FirstCycling terrain specialties |
| `who_to_drop_before_stage` | `stage_number` (req) | Drop candidates before a stage |
| `replacement_for_abandoned_rider` | `abandoned_rider_name` (req), `budget` (req) | Replacement after a DNF |
| `final_week_strategy` | `exchanges_remaining` (req) | Final week transfer plan |

### Team Analysis

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `analyze_team_form` | none | Team form + FirstCycling recent results to separate bad form from bad luck |
| `who_is_underperforming` | none | Underperformers; FirstCycling distinguishes fading form vs. due a result |
| `flag_injury_risks` | none | Injury/fatigue flags; FirstCycling recent results spot pre-Tour injury patterns |
| `close_gap_on_rival` | `rival_name` (req) | Gap-closing strategy; FirstCycling terrain fit compared across both teams |

### Preference-Personalised

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `team_around_nationality` | `nationality` (req), `budget` (req) | Nationality-anchored team; FirstCycling ranks candidates by palmares |
| `team_around_pro_team` | `pro_team_name` (req), `budget` (req) | Pro-team-anchored fantasy team |
| `find_riders_like_favorite` | `favorite_rider_name` (req) | Similar riders; FirstCycling profile match drives similarity |
| `specialty_first_team` | `specialty` (req), `budget` (req), `preferred_nationality` (opt) | Specialty-first with optional nationality tie-break |
| `scout_riders_from_country` | `nationality` (req), `max_price` (req) | Scout a country's riders; FirstCycling palmares is the primary ranking signal |
| `preferred_riders_value_check` | `rider_names` (req, comma-sep), `budget` (req) | Value check on a personal watchlist |

---

## Rider Position IDs

| ID | Label | Description |
|----|-------|-------------|
| 43 | Leaders | GC contenders |
| 44 | Polyvalents | All-rounders |
| 45 | Grimpeurs | Climbers |
| 46 | Sprinteurs | Sprinters |
