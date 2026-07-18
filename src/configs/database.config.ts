import mongoose from "mongoose";
import { env } from "./env.config";

declare global {
  // eslint-disable-next-line no-var
  var mongooseConnectionPromise: Promise<typeof mongoose> | undefined;
}

export const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  global.mongooseConnectionPromise ??= mongoose.connect(env.databaseUrl, {
    serverSelectionTimeoutMS: 10000,
  });

  return global.mongooseConnectionPromise;
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  global.mongooseConnectionPromise = undefined;
};

export const runInTransaction = async <T>(
  work: (session: mongoose.ClientSession) => Promise<T>,
) => {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });

    if (result === undefined) {
      throw new Error("Transaction completed without a result");
    }

    return result;
  } finally {
    await session.endSession();
  }
};
