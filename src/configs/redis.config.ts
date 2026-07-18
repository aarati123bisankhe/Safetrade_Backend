import { RedisStore } from "rate-limit-redis";
import { createClient, type RedisClientType } from "redis";
import { env } from "./env.config";

let redisClient: RedisClientType | null = null;
let redisStoreAvailable = false;
let redisConnectionAttempted = false;
let redisUnavailableLogged = false;

export const getRedisClient = () => {
  if (!env.redisEnabled || !env.redisUrl || env.nodeEnv === "test") {
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: env.redisUrl,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });

    redisClient.on("error", (error) => {
      if (!redisUnavailableLogged) {
        console.warn(
          "Redis is enabled but not reachable. Falling back to in-memory rate limiting.",
        );
        console.warn(error);
        redisUnavailableLogged = true;
      }
    });

    redisConnectionAttempted = true;

    void redisClient.connect().then(
      () => {
        redisStoreAvailable = true;
        redisUnavailableLogged = false;
      },
      () => undefined,
    );
  }

  return redisClient;
};

export const createRateLimitStore = (prefix: string) => {
  const client = getRedisClient();

  if (!client) {
    return undefined;
  }

  if (!client.isReady) {
    return undefined;
  }

  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => client.sendCommand(args),
  });
};

export const isRedisRateLimitEnabled = () =>
  Boolean(
    env.redisEnabled &&
      env.redisUrl &&
      env.nodeEnv !== "test" &&
      redisStoreAvailable,
  );

export const hasRedisConnectionAttempted = () => redisConnectionAttempted;
