import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiGet, apiPost } from "./api.js";

export const TOOLS: Tool[] = [
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

export async function handleTool(
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
      // get own profile; /joueur/me may not exist — pass explicit user_id if it 404s
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
