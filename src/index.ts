#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  Prompt,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// API base URL and game identity (Tour de France 2024/2025)
const API_BASE = "https://fantasybytissot.letour.fr/v1";
const GAME_IDENTITY = "630";
const GAME_VERSION = "16.17";

// X-Access-Key format: {identity}@{version}@{codeDemo}
const ACCESS_KEY = `${GAME_IDENTITY}@${GAME_VERSION}@`;

function getAuthToken(): string | undefined {
  return process.env.TDF_AUTH_TOKEN;
}

function buildHeaders(requiresAuth = false): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Access-Key": ACCESS_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = getAuthToken();
  if (requiresAuth) {
    if (!token) {
      throw new Error(
        "TDF_AUTH_TOKEN environment variable is required for this endpoint. " +
          "Log in at https://fantasy.letour.fr and extract your JWT token."
      );
    }
    headers["Authorization"] = `Token ${token}`;
  } else if (token) {
    // Include auth if available even for public endpoints
    headers["Authorization"] = `Token ${token}`;
  }
  return headers;
}

async function apiGet(path: string, requiresAuth = false): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(requiresAuth),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status} for ${path}: ${text}`);
  }

  return response.json();
}

async function apiPost(
  path: string,
  body: unknown,
  requiresAuth = false
): Promise<unknown> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(requiresAuth),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status} for ${path}: ${text}`);
  }

  return response.json();
}

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "get_game_config",
    description:
      "Get the full TdF Fantasy game configuration including budget, team rules, rider positions, and game settings. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_riders",
    description:
      "Get the list of all riders (sportifs) available in the TdF Fantasy game, including their names, teams, prices, and positions. No authentication required but only available during the active season.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_teams",
    description:
      "Get the list of all professional cycling teams (clubs) in the TdF Fantasy game. No authentication required.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_current_stage",
    description:
      "Get information about the current stage of the Tour de France, including stage number, type, status, and results. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_stage",
    description:
      "Get information about a specific stage of the Tour de France by stage number. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        stage_number: {
          type: "number",
          description: "The stage number (1-21 for a standard Tour de France)",
        },
      },
      required: ["stage_number"],
    },
  },
  {
    name: "get_stage_calendar",
    description:
      "Get the calendar/schedule information for a specific stage. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        stage_number: {
          type: "number",
          description: "The stage number",
        },
      },
      required: ["stage_number"],
    },
  },
  {
    name: "get_general_standings",
    description:
      "Get the general fantasy leaderboard standings for a league/group. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: {
          type: "number",
          description:
            "The group/league ID. Use 0 or omit for the global leaderboard.",
        },
      },
    },
  },
  {
    name: "get_stage_standings",
    description:
      "Get the fantasy leaderboard standings for a specific stage within a group. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: {
          type: "number",
          description: "The group/league ID. Use 0 for global.",
        },
        stage_number: {
          type: "number",
          description: "The stage number to get standings for",
        },
      },
      required: ["stage_number"],
    },
  },
  {
    name: "get_my_leagues",
    description:
      "Get the list of leagues/groups the authenticated user belongs to. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_league",
    description:
      "Get details about a specific league/group. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: {
          type: "number",
          description: "The group/league ID",
        },
      },
      required: ["group_id"],
    },
  },
  {
    name: "search_leagues",
    description:
      "Search for leagues/groups by name or code. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term (league name or join code)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_rider_stats",
    description:
      "Get statistics for riders, optionally filtered by position, team, or price range. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        position_ids: {
          type: "array",
          items: { type: "number" },
          description:
            "Filter by position IDs (43=Leaders, 44=Polyvalents, 45=Climbers/Grimpeurs, 46=Sprinters)",
        },
        team_ids: {
          type: "array",
          items: { type: "number" },
          description: "Filter by team IDs",
        },
        min_price: {
          type: "number",
          description: "Minimum rider price in millions",
        },
        max_price: {
          type: "number",
          description: "Maximum rider price in millions",
        },
      },
    },
  },
  {
    name: "get_top_transactions",
    description:
      "Get the most bought and sold riders (top transfers) in the fantasy game. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_user_profile",
    description:
      "Get a user's fantasy profile including their team name, points, and rank. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: {
          type: "number",
          description:
            "The user ID to look up. Omit to get the authenticated user's own profile.",
        },
      },
    },
  },
  {
    name: "get_rider_positions",
    description:
      "Get the list of rider position types used in the fantasy game (Leaders, Polyvalents, Climbers, Sprinters). Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_hall_of_fame",
    description:
      "Get the TdF Fantasy hall of fame showing top performers from previous editions. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_player_progression",
    description:
      "Get a player's point progression across stages within a group. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {
        group_id: {
          type: "number",
          description: "The group/league ID. Use 0 for global.",
        },
        stage_number: {
          type: "number",
          description: "The stage number up to which to show progression",
        },
      },
      required: ["stage_number"],
    },
  },
  {
    name: "get_notifications",
    description:
      "Get notifications for the authenticated user (transfer windows, stage results, etc.). Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_user_credits",
    description:
      "Get the authenticated user's credit balance in the fantasy game. Requires authentication.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Tool handlers
async function handleTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_game_config":
      return apiGet("/public/config.json");

    case "get_riders":
      return apiGet("/public/sportifs");

    case "get_teams":
      return apiGet("/public/clubs");

    case "get_current_stage":
      return apiGet("/private/journee", true);

    case "get_stage": {
      const stageNum = args.stage_number as number;
      return apiGet(`/private/journee/${stageNum}`, true);
    }

    case "get_stage_calendar": {
      const stageNum = args.stage_number as number;
      return apiGet(`/private/journeecalendrier/${stageNum}`, true);
    }

    case "get_general_standings": {
      const groupId = (args.group_id as number) ?? 0;
      return apiGet(`/private/classementgeneral/${groupId}`, true);
    }

    case "get_stage_standings": {
      const groupId = (args.group_id as number) ?? 0;
      const stageNum = args.stage_number as number;
      return apiGet(
        `/private/classementjournee/${groupId}/${stageNum}`,
        true
      );
    }

    case "get_my_leagues":
      return apiGet("/private/mesgroupes", true);

    case "get_league": {
      const groupId = args.group_id as number;
      return apiGet(`/private/infosgroupe/${groupId}`, true);
    }

    case "search_leagues": {
      const query = args.query as string;
      return apiPost("/private/groupessearch", { search: query }, true);
    }

    case "get_rider_stats": {
      const filters: Record<string, unknown> = {};
      if (args.position_ids) filters.positions = args.position_ids;
      if (args.team_ids) filters.clubs = args.team_ids;
      if (args.min_price !== undefined) filters.minPrice = args.min_price;
      if (args.max_price !== undefined) filters.maxPrice = args.max_price;
      return apiPost("/private/stats", { credentials: filters }, true);
    }

    case "get_top_transactions":
      return apiGet("/private/toptransaction", true);

    case "get_user_profile": {
      if (args.user_id) {
        return apiGet(`/private/joueur/${args.user_id}`, true);
      }
      // Get own profile via mesgroupes which includes user info
      return apiGet("/private/joueur/me", true);
    }

    case "get_rider_positions":
      return apiGet("/private/positions", true);

    case "get_hall_of_fame":
      return apiGet("/private/halloffame", true);

    case "get_player_progression": {
      const groupId = (args.group_id as number) ?? 0;
      const stageNum = args.stage_number as number;
      return apiGet(
        `/private/progressionjoueur/${groupId}/${stageNum}`,
        true
      );
    }

    case "get_notifications":
      return apiGet("/private/notification", true);

    case "get_user_credits":
      return apiGet("/private/usercredits", true);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Prompt definitions
const PROMPTS: Prompt[] = [
  // ── Team building ──────────────────────────────────────────────────────────
  {
    name: "strongest_team",
    description:
      "Build the strongest possible TdF Fantasy team for a given budget and racing strategy.",
    arguments: [
      {
        name: "budget",
        description: "Total budget in credits (e.g. 120)",
        required: true,
      },
      {
        name: "strategy",
        description:
          "Racing strategy to optimise for: gc (general classification), climber, sprinter, puncher, or breakaway",
        required: true,
      },
    ],
  },
  {
    name: "best_value_picks",
    description:
      "Find the best value-for-money riders under a given price cap, optionally filtered by specialty.",
    arguments: [
      {
        name: "max_price",
        description: "Maximum price per rider in credits (e.g. 15)",
        required: true,
      },
      {
        name: "specialty",
        description:
          "Optional specialty filter: climber, sprinter, puncher, gc, or breakaway",
        required: false,
      },
    ],
  },
  {
    name: "design_specialty_team",
    description:
      "Design a full 8-rider team built around a specific racing specialty.",
    arguments: [
      {
        name: "specialty",
        description:
          "Team specialty: breakaway, puncher, sprinter, climber, or gc",
        required: true,
      },
      {
        name: "budget",
        description: "Total budget in credits",
        required: true,
      },
    ],
  },
  {
    name: "go_all_in_breakaways",
    description:
      "Build a high-risk, high-reward team stacked with breakaway specialists.",
    arguments: [
      {
        name: "budget",
        description: "Total budget in credits",
        required: true,
      },
    ],
  },

  // ── Exchange planning ───────────────────────────────────────────────────────
  {
    name: "plan_transfers",
    description:
      "Plan the optimal transfer strategy for the next N stages given the remaining exchange allowance.",
    arguments: [
      {
        name: "stages_ahead",
        description: "Number of upcoming stages to plan for",
        required: true,
      },
      {
        name: "exchanges_remaining",
        description: "Number of transfers still available",
        required: true,
      },
    ],
  },
  {
    name: "who_to_drop_before_stage",
    description:
      "Identify which riders should be sold or benched before a specific stage.",
    arguments: [
      {
        name: "stage_number",
        description: "The upcoming stage number",
        required: true,
      },
    ],
  },
  {
    name: "replacement_for_abandoned_rider",
    description:
      "Find the best replacement after a key rider abandons the race.",
    arguments: [
      {
        name: "abandoned_rider_name",
        description: "Full name of the rider who abandoned",
        required: true,
      },
      {
        name: "budget",
        description: "Budget freed up by the abandoned rider (or total remaining)",
        required: true,
      },
    ],
  },
  {
    name: "final_week_strategy",
    description:
      "Devise the optimal transfer strategy for the final week of the Tour given limited exchanges.",
    arguments: [
      {
        name: "exchanges_remaining",
        description: "Number of transfers still available for the final week",
        required: true,
      },
    ],
  },

  // ── Team analysis ───────────────────────────────────────────────────────────
  {
    name: "analyze_team_form",
    description:
      "Analyse the current form and points trajectory of your fantasy team. Uses your auth token to fetch team data.",
    arguments: [],
  },
  {
    name: "who_is_underperforming",
    description:
      "Identify which riders on your team are underperforming relative to their price and expected output.",
    arguments: [],
  },
  {
    name: "flag_injury_risks",
    description:
      "Flag any riders on your team who are carrying injury concerns or showing signs of fatigue.",
    arguments: [],
  },
  {
    name: "close_gap_on_rival",
    description:
      "Suggest a strategy to close the points gap on a specific rival in your league.",
    arguments: [
      {
        name: "rival_name",
        description: "Name of the rival team or manager to target",
        required: true,
      },
    ],
  },

  // ── Preference-personalised ─────────────────────────────────────────────────
  {
    name: "team_around_nationality",
    description:
      "Build a competitive team featuring as many riders from a preferred nationality as possible.",
    arguments: [
      {
        name: "nationality",
        description: "Nationality to prioritise (e.g. French, Belgian, Colombian)",
        required: true,
      },
      {
        name: "budget",
        description: "Total budget in credits",
        required: true,
      },
    ],
  },
  {
    name: "team_around_pro_team",
    description:
      "Build the best fantasy team anchored around riders from a specific professional cycling team.",
    arguments: [
      {
        name: "pro_team_name",
        description:
          "Name of the professional team to anchor around (e.g. UAE Team Emirates, Visma–Lease a Bike)",
        required: true,
      },
      {
        name: "budget",
        description: "Total budget in credits",
        required: true,
      },
    ],
  },
  {
    name: "find_riders_like_favorite",
    description:
      "Find riders with a similar racing profile and strengths to a named favourite rider.",
    arguments: [
      {
        name: "favorite_rider_name",
        description: "Full name of the rider whose profile to match",
        required: true,
      },
    ],
  },
  {
    name: "specialty_first_team",
    description:
      "Build a team that maximises a specific specialty, with an optional nationality preference.",
    arguments: [
      {
        name: "specialty",
        description:
          "Primary specialty: breakaway, climber, sprinter, puncher, or gc",
        required: true,
      },
      {
        name: "budget",
        description: "Total budget in credits",
        required: true,
      },
      {
        name: "preferred_nationality",
        description:
          "Optional nationality preference for tie-breaking (e.g. French, Spanish)",
        required: false,
      },
    ],
  },
  {
    name: "scout_riders_from_country",
    description:
      "Scout and rank riders from a specific country worth picking up in the fantasy game.",
    arguments: [
      {
        name: "nationality",
        description: "Country/nationality to scout (e.g. Colombian, Dutch)",
        required: true,
      },
      {
        name: "max_price",
        description: "Maximum price per rider in credits",
        required: true,
      },
    ],
  },
  {
    name: "preferred_riders_value_check",
    description:
      "Check whether a list of personally preferred riders are available at good value within a budget.",
    arguments: [
      {
        name: "rider_names",
        description: "Comma-separated list of rider names to evaluate",
        required: true,
      },
      {
        name: "budget",
        description: "Total team budget in credits",
        required: true,
      },
    ],
  },
];

type Args = Record<string, string>;

function req(args: Args, key: string): string {
  const v = args[key];
  if (!v) throw new Error(`Missing required argument: ${key}`);
  return v;
}

function opt(args: Args, key: string): string | undefined {
  return args[key] || undefined;
}

function buildPromptText(name: string, args: Args): string {
  switch (name) {
    // ── Team building ─────────────────────────────────────────────────────────

    case "strongest_team": {
      const budget = req(args, "budget");
      const strategy = req(args, "strategy");
      const strategyDesc: Record<string, string> = {
        gc: "general classification contenders who accumulate points across mountain stages and time trials",
        climber: "pure climbers who excel in mountain stages",
        sprinter: "fast finishers who dominate flat stages and intermediate sprints",
        puncher: "one-day specialists and punchy finishers who target hilly stages",
        breakaway: "breakaway artists who escape in early moves and take stage wins",
      };
      const desc = strategyDesc[strategy.toLowerCase()] ?? strategy;
      return (
        `I'm playing TdF Fantasy with a budget of ${budget} credits. ` +
        `My strategy is to build a team around ${desc}.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch the full rider list and their prices from the TdF Fantasy API\n` +
        `2. Fetch upcoming stage profiles to identify which stages favour a ${strategy} strategy\n` +
        `3. Identify a shortlist of 12–15 candidates that fit the ${strategy} profile within budget\n` +
        `4. For each shortlisted rider, use the FirstCycling tools to look up their palmares and career results — ` +
        `confirm they are a genuine ${strategy} threat with a track record of results in that terrain, ` +
        `not just a fantasy price tag. Flag any who appear overpriced relative to their actual race history.\n` +
        `5. From the validated shortlist, select the strongest 8-rider team within ${budget} credits\n\n` +
        `Present the final team with: name, price, FirstCycling-verified specialty, and why they made the cut over alternatives. ` +
        `Call out anyone whose palmares didn't justify their price. ` +
        `Include total cost, remaining budget, and the best captaincy (Stage Winner Bonus) pick.`
      );
    }

    case "best_value_picks": {
      const maxPrice = req(args, "max_price");
      const specialty = opt(args, "specialty");
      const specialtyClause = specialty
        ? ` who specialise in ${specialty} racing`
        : "";
      return (
        `I'm looking for the best value fantasy picks — riders${specialtyClause} priced at ${maxPrice} credits or less.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch all riders and their current prices and stats from the TdF Fantasy API\n` +
        `2. Fetch upcoming stage profiles to assess how many scoring opportunities each rider has\n` +
        `3. Identify a longlist of affordable candidates (≤${maxPrice} credits)${specialtyClause}\n` +
        `4. For each candidate, use the FirstCycling tools to look up their recent results and terrain performance — ` +
        `check for wins or podiums in the past 12 months, their best terrain type (mountain/flat/TT/cobbles), ` +
        `and whether their current form is rising or declining. Use this to separate genuinely underpriced riders ` +
        `from those who are cheap because they've stopped performing.\n` +
        `5. Rank the top value picks by points-per-credit potential, weighted by FirstCycling form signals\n\n` +
        `For each pick: price, upcoming stage opportunities, FirstCycling form summary (recent wins, terrain fit), ` +
        `value verdict, and any risks.`
      );
    }

    case "design_specialty_team": {
      const specialty = req(args, "specialty");
      const budget = req(args, "budget");
      return (
        `Design me a complete 8-rider TdF Fantasy team built entirely around a ${specialty} strategy, within a ${budget}-credit budget.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch all riders, their prices, and positions from the TdF Fantasy API\n` +
        `2. Fetch the stage calendar to identify the stages that suit ${specialty} riders\n` +
        `3. Build a longlist of ${specialty}-type candidates within budget\n` +
        `4. For each candidate, use the FirstCycling tools to validate their ${specialty} track record — ` +
        `look at palmares for ${specialty}-relevant race types, recent results on similar terrain, and career specialty scores. ` +
        `Discard anyone whose FirstCycling history doesn't back up their ${specialty} label in the fantasy game.\n` +
        `5. From the validated candidates, select the strongest 8-rider team within ${budget} credits\n\n` +
        `Present the roster with: name, price, and a one-line FirstCycling evidence summary for why they're a ` +
        `genuine ${specialty} specialist. Note total cost, key target stages, and the best captaincy pick.`
      );
    }

    case "go_all_in_breakaways": {
      const budget = req(args, "budget");
      return (
        `I want to go all-in on breakaway specialists — high risk, high reward. ` +
        `Build me the most aggressive breakaway-focused team possible within ${budget} credits.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch all riders from the TdF Fantasy API and identify candidates listed as breakaway/polyvalent types\n` +
        `2. Fetch the stage calendar and mark stages historically likely to end in breakaway success ` +
        `(rolling terrain, medium mountains, stages with hard early climbs but no summit finish)\n` +
        `3. For each breakaway candidate, use the FirstCycling tools to look up their career results and palmares — ` +
        `count actual breakaway stage wins or long-range solo attacks in their history. ` +
        `Prioritise riders with a proven record of going in moves and succeeding; ` +
        `skip anyone whose FirstCycling profile shows they mostly contest bunch finishes or ride in support.\n` +
        `4. Pick the 8 riders who best combine: FirstCycling-verified breakaway history, ` +
        `stage-calendar coverage, and value within ${budget} credits\n\n` +
        `Show the full team, each rider's FirstCycling breakaway credential (notable solo wins or escapes), ` +
        `which stages they target, total cost, and the expected points ceiling. ` +
        `Also flag the downside scenario — which stages hurt this strategy if the peloton controls the race.`
      );
    }

    // ── Exchange planning ──────────────────────────────────────────────────────

    case "plan_transfers": {
      const stagesAhead = req(args, "stages_ahead");
      const exchangesRemaining = req(args, "exchanges_remaining");
      return (
        `I have ${exchangesRemaining} transfers remaining and need to plan the next ${stagesAhead} stages.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch my current team from the TdF Fantasy API\n` +
        `2. Fetch the upcoming ${stagesAhead} stage profiles and classify each by terrain type ` +
        `(flat sprint, rolling breakaway, mountain summit, TT, etc.)\n` +
        `3. Fetch rider stats and top transaction data\n` +
        `4. For each of my current riders, use the FirstCycling tools to check their terrain-specific performance — ` +
        `do their historical results align with the upcoming stage types? ` +
        `Flag anyone whose FirstCycling profile suggests they'll be out of their depth in the next ${stagesAhead} stages.\n` +
        `5. For each potential transfer target (riders I don't own), cross-reference their FirstCycling terrain specialty ` +
        `against the upcoming stage calendar before recommending them as a buy. ` +
        `Avoid recommending riders whose FirstCycling history doesn't support the terrain ahead.\n` +
        `6. Recommend how to deploy my ${exchangesRemaining} transfers for maximum points gain, ` +
        `with each swap validated by both fantasy stats and FirstCycling terrain fit\n\n` +
        `For each suggested transfer: who to sell (with FirstCycling reason), who to buy (with FirstCycling terrain evidence), ` +
        `before which stage, and projected points impact. Rank by expected return.`
      );
    }

    case "who_to_drop_before_stage": {
      const stageNum = req(args, "stage_number");
      return (
        `The transfer window is open before Stage ${stageNum}. Who on my current team should I consider dropping?\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch my current team and their recent points\n` +
        `2. Fetch the Stage ${stageNum} profile and remaining race calendar\n` +
        `3. Fetch rider stats and any top-transaction signals\n` +
        `4. Identify the weakest links — riders who are poor value, out of form, or poorly suited to upcoming stages\n\n` +
        `For each drop candidate: explain why they're worth selling, the credit value freed up, and suggest a replacement target. ` +
        `Rank the candidates so I know who to prioritise if I only have one transfer.`
      );
    }

    case "replacement_for_abandoned_rider": {
      const abandonedRider = req(args, "abandoned_rider_name");
      const budget = req(args, "budget");
      return (
        `${abandonedRider} has abandoned the Tour de France and I need an urgent replacement. ` +
        `I have ${budget} credits to spend.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch all available riders and their prices\n` +
        `2. Fetch the remaining race calendar and stage profiles\n` +
        `3. Identify the best replacement for ${abandonedRider} within ${budget} credits — ` +
        `ideally someone with a similar racing profile who can score points in the remaining stages\n\n` +
        `Give me the top 3 replacement options, ranked by expected points return. ` +
        `For each: name, price, racing style, and which upcoming stages they're likely to score in. ` +
        `Flag if any are being heavily bought by other managers (top transfers).`
      );
    }

    case "final_week_strategy": {
      const exchangesRemaining = req(args, "exchanges_remaining");
      return (
        `I'm heading into the final week of the Tour with ${exchangesRemaining} transfers left. Help me maximise my points.\n\n` +
        `Please use the available tools to:\n` +
        `1. Fetch my current team and points so far\n` +
        `2. Fetch the final week's stage profiles (typically stages 17–21: mountain finishes, time trial, Champs-Élysées)\n` +
        `3. Fetch current rider form and top transactions\n` +
        `4. Devise the optimal use of my ${exchangesRemaining} remaining transfers\n\n` +
        `The final week usually features: high-mountain stages where GC riders attack, ` +
        `a time trial (specialists score big), and the Champs-Élysées sprint. ` +
        `Factor in GC positions — riders out of contention may go in breaks. ` +
        `Show a stage-by-stage transfer plan with the projected points impact of each move.`
      );
    }

    // ── Team analysis ──────────────────────────────────────────────────────────

    case "analyze_team_form":
      return (
        `Please analyse my TdF Fantasy team's current form and trajectory.\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch my team and its current total points from the TdF Fantasy API\n` +
        `2. Fetch my stage-by-stage points progression\n` +
        `3. Fetch recent stage results to see how each of my riders is performing in the race\n` +
        `4. Fetch my current league standings\n` +
        `5. For each rider on my team, use the FirstCycling tools to pull their recent results (last 3–6 months) — ` +
        `this is the key enrichment step: use FirstCycling to distinguish between a rider having a genuinely bad Tour ` +
        `(poor form, illness, riding in support) versus a rider who is performing well in the race but just had ` +
        `unlucky stage draws or missed a sprint. FirstCycling recent results will show whether their ` +
        `current trajectory is consistent with their broader season form.\n\n` +
        `For each rider: fantasy points so far, points-per-credit ratio, FirstCycling recent form summary, ` +
        `and an honest outlook for remaining stages. ` +
        `Separate "underperforming due to bad form" from "underperforming due to bad luck on stage draws." ` +
        `Summarise overall team health and league trajectory.`
      );

    case "who_is_underperforming":
      return (
        `Which riders on my TdF Fantasy team are underperforming relative to their price tag?\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch my team and each rider's points so far from the TdF Fantasy API\n` +
        `2. Fetch rider stats and price data\n` +
        `3. Fetch recent stage results to put fantasy points in context\n` +
        `4. For each rider who appears to be underdelivering, use the FirstCycling tools to check their ` +
        `recent results and career pattern — look for: riders who historically fade in week 3, ` +
        `riders currently riding as a domestique for a teammate, riders whose recent results outside the ` +
        `Tour show declining form, and riders who are due a result based on recent near-misses. ` +
        `This helps distinguish "sell now" from "hold, they'll come good."\n\n` +
        `Calculate points-per-credit for each rider. For anyone flagged as underperforming: ` +
        `FirstCycling verdict (bad form vs. bad luck vs. role change), sell recommendation (yes/hold/no), ` +
        `and a suggested like-for-like upgrade with FirstCycling-validated upside.`
      );

    case "flag_injury_risks":
      return (
        `Flag any riders on my TdF Fantasy team who are at risk due to injury, illness, or fatigue.\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch my current team from the TdF Fantasy API\n` +
        `2. Fetch recent stage results and rider stats to spot sudden performance drop-offs in the race\n` +
        `3. Fetch the upcoming stage calendar to assess remaining workload\n` +
        `4. For each rider on my team, use the FirstCycling tools to check their recent results — ` +
        `look for: DNFs or withdrawals in recent races before the Tour (possible lingering injury), ` +
        `unusually low finishing positions in recent races that don't match their career baseline, ` +
        `a sudden shift to support/domestique roles at their team, or a pattern of abandoning Grand Tours. ` +
        `Cross-reference FirstCycling results with their in-race stage rankings to assess whether ` +
        `any drop-off is a one-stage blip or part of a broader deterioration.\n\n` +
        `Rate each rider's risk level (low/medium/high) based on the combined fantasy + FirstCycling signal. ` +
        `For high-risk riders, recommend a contingency replacement and verify the replacement's ` +
        `FirstCycling form is actually good before suggesting them.`
      );

    case "close_gap_on_rival": {
      const rivalName = req(args, "rival_name");
      return (
        `I need to close the points gap on "${rivalName}" in my fantasy league. Help me plan a targeted strategy.\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch the league standings to see the current gap from the TdF Fantasy API\n` +
        `2. Fetch my team and — if possible — look up "${rivalName}"'s publicly visible team\n` +
        `3. Fetch the remaining stage calendar\n` +
        `4. Fetch rider stats and top transactions\n` +
        `5. For both my team and ${rivalName}'s team, use the FirstCycling tools to assess each rider's ` +
        `upcoming stage suitability — look at terrain-specific performance history and recent form. ` +
        `Specifically: which of ${rivalName}'s riders are likely to score big in remaining stages ` +
        `(FirstCycling shows strong results on that terrain), and which of my riders are likely to ` +
        `outscore their equivalents? Identify asymmetric opportunities — stages where my riders have ` +
        `better FirstCycling credentials than ${rivalName}'s riders on that terrain type.\n\n` +
        `Recommend specific transfers that maximise my points swing versus ${rivalName}, ` +
        `grounded in FirstCycling terrain data for the remaining stages. ` +
        `Quantify the realistic points differential swing if the plan works.`
      );
    }

    // ── Preference-personalised ────────────────────────────────────────────────

    case "team_around_nationality": {
      const nationality = req(args, "nationality");
      const budget = req(args, "budget");
      return (
        `Build me a competitive TdF Fantasy team featuring as many ${nationality} riders as possible, within a ${budget}-credit budget.\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch the full rider list from the TdF Fantasy API and filter for ${nationality} riders\n` +
        `2. Fetch the stage calendar to identify stages that suit their typical strengths\n` +
        `3. For each ${nationality} rider in the fantasy game, use the FirstCycling tools to pull their ` +
        `palmares and recent results — rank them by actual race pedigree, not just fantasy price. ` +
        `Look for: Grand Tour stage wins, strong recent results on terrain matching the upcoming stages, ` +
        `and current season form. This FirstCycling ranking is the basis for selecting the best ${nationality} riders.\n` +
        `4. Build the strongest 8-rider team within ${budget} credits that maximises ${nationality} ` +
        `representation, using the FirstCycling-ranked order to choose between candidates\n\n` +
        `Show the final team with each rider's price, FirstCycling palmares highlight, and role. ` +
        `If fitting 8 ${nationality} riders within budget is impossible, show the best compromise ` +
        `and use FirstCycling data to justify which non-nationality riders fill the gaps. ` +
        `Flag any ${nationality} hidden gems whose FirstCycling form outpaces their fantasy price.`
      );
    }

    case "team_around_pro_team": {
      const proTeamName = req(args, "pro_team_name");
      const budget = req(args, "budget");
      return (
        `Build the best TdF Fantasy team anchored around riders from ${proTeamName}, within ${budget} credits.\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch all riders and filter for ${proTeamName} members\n` +
        `2. Fetch ${proTeamName}'s likely stage strategy — which riders are domestiques vs. leaders\n` +
        `3. Fetch the stage calendar to find stages where ${proTeamName} riders are likely to score\n` +
        `4. Build the strongest 8-rider team within ${budget} credits, maximising ${proTeamName} representation\n\n` +
        `Show the full team with prices. For each ${proTeamName} rider: their likely role in the race and projected scoring stages. ` +
        `If budget forces non-${proTeamName} picks, choose riders who won't compete directly ` +
        `against ${proTeamName}'s leaders (e.g. sprinters if ${proTeamName} is a GC team).`
      );
    }

    case "find_riders_like_favorite": {
      const favoriteRider = req(args, "favorite_rider_name");
      return (
        `Find TdF Fantasy riders with a similar racing profile to ${favoriteRider}.\n\n` +
        `Use the available tools to:\n` +
        `1. Use the FirstCycling tools to look up ${favoriteRider}'s profile — career specialty, ` +
        `palmares (what race types they win), terrain strengths, and recent form. ` +
        `Build a concrete profile: e.g. "solo attacker on long mountain stages, ` +
        `wins on summit finishes, also dangerous in TTs, recent wins at [races]".\n` +
        `2. Fetch the full rider list from the TdF Fantasy API with prices and positions\n` +
        `3. Fetch the stage calendar to see which terrain types dominate the remaining race\n` +
        `4. For the most promising candidates from the fantasy list, use FirstCycling to look up ` +
        `their profiles and palmares — find riders whose career specialty, terrain wins, and ` +
        `race-winning patterns most closely match ${favoriteRider}'s FirstCycling profile. ` +
        `Prioritise riders who win in the same conditions, not just riders in the same position category.\n\n` +
        `Present 5–8 similar riders, ranked by profile similarity and upcoming stage fit. ` +
        `For each: name, price, a summary of their FirstCycling profile vs ${favoriteRider}'s, ` +
        `key similarities and differences, and value verdict. ` +
        `Flag anyone who is a better value pick than ${favoriteRider} at a lower price.`
      );
    }

    case "specialty_first_team": {
      const specialty = req(args, "specialty");
      const budget = req(args, "budget");
      const nationality = opt(args, "preferred_nationality");
      const nationalityClause = nationality
        ? `, with a preference for ${nationality} riders when choosing between equally good options`
        : "";
      return (
        `Build me a TdF Fantasy team that maximises ${specialty} scoring${nationalityClause}, within ${budget} credits.\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch all riders and identify those who excel in ${specialty} scenarios\n` +
        `2. Fetch the stage calendar and mark the stages that most favour ${specialty} riders\n` +
        `3. Build the strongest 8-rider team within ${budget} credits focused on ${specialty}` +
        (nationality ? `, preferring ${nationality} riders in tie-breaks` : "") + `\n\n` +
        `Show the full roster with prices, the targeted stages, and the expected points ceiling. ` +
        `Note the total cost and remaining budget. Recommend the best captaincy pick.`
      );
    }

    case "scout_riders_from_country": {
      const nationality = req(args, "nationality");
      const maxPrice = req(args, "max_price");
      return (
        `Scout all ${nationality} riders in the TdF Fantasy game priced at ${maxPrice} credits or less. ` +
        `Which ones are worth picking up?\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch all riders from the TdF Fantasy API and filter for ${nationality} nationality at or under ${maxPrice} credits\n` +
        `2. Fetch the stage calendar to assess how many scoring opportunities each rider has\n` +
        `3. For each ${nationality} rider on the shortlist, use the FirstCycling tools to pull their ` +
        `palmares and recent results — score each rider by: number of wins or podiums in the last 12 months, ` +
        `terrain specialty vs upcoming stage types, and Grand Tour stage-win history. ` +
        `This FirstCycling data is the primary ranking signal — fantasy price alone is not enough.\n` +
        `4. Rank the ${nationality} picks by FirstCycling-weighted points-per-credit potential\n\n` +
        `For each worthwhile pick: name, price, FirstCycling palmares highlight (best recent wins or results), ` +
        `terrain fit for upcoming stages, and a buy/watch/skip verdict. ` +
        `Flag any hidden gems — ${nationality} riders whose FirstCycling form clearly outpaces their fantasy price.`
      );
    }

    case "preferred_riders_value_check": {
      const riderNames = req(args, "rider_names");
      const budget = req(args, "budget");
      const riderList = riderNames
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n");
      return (
        `I have a list of riders I personally want on my TdF Fantasy team. ` +
        `Are they available at good value within my ${budget}-credit budget?\n\n` +
        `My preferred riders:\n${riderList}\n\n` +
        `Use the available tools to:\n` +
        `1. Fetch all riders and look up each name on my list\n` +
        `2. Fetch upcoming stage profiles to assess each rider's scoring opportunities\n` +
        `3. Check current prices against their expected points return\n\n` +
        `For each rider: current price, position type, points so far, upcoming stage suitability, ` +
        `and a value verdict (great value / fair price / overpriced). ` +
        `Then tell me: can I fit all of them within ${budget} credits? ` +
        `If not, rank them by value and suggest which to prioritise and which to drop.`
      );
    }

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// Server setup
const server = new Server(
  {
    name: "tdf-fantasy-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return { prompts: PROMPTS };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const text = buildPromptText(name, args as Args);
  return {
    messages: [
      {
        role: "user",
        content: { type: "text", text },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    const result = await handleTool(name, args as Record<string, unknown>);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TdF Fantasy MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
