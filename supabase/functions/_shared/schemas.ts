import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  extendZodWithOpenApi,
} from "https://esm.sh/@asteasolutions/zod-to-openapi@7.0.0";

extendZodWithOpenApi(z);

// --- REQUEST SCHEMAS ---

export const LoginSchema = z.object({
  email: z.string().email().openapi({ example: "user@email.com" }),
  password: z.string().min(6).openapi({ example: "password123" }),
});

export const LoginQuerySchema = z.object({
  grant_type: z.string().openapi({ example: "password" }),
});

export const CreateGameSchema = z.object({
  title: z.string().min(1).openapi({ example: "Partita di test" }),
});

export const GetGamesSchema = z.object({
  status: z.enum(["in_progress", "finished"]).openapi({ example: "in_progress" }),
});

export const SubmitMoveSchema = z.object({
  game_id: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  notation: z.string().min(2).openapi({ example: "e4" }),
});

export const ResignGameSchema = z.object({
  game_id: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  resigning_player: z.enum(["white", "black"]).openapi({ example: "white" }),
});

// --- RESPONSE SCHEMAS ---

export const GameSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(["in_progress", "finished"]),
});

export const GetGamesResponseSchema = z.object({
  games: z.array(GameSchema),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const MoveResponseSchema = z.object({
  success: z.boolean(),
  game_over: z.boolean().optional(),
  message: z.string().optional(),
});
