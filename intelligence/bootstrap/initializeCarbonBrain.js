import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

let initialized = false;
let initializationPromise = null;

async function connectMongo() {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    await mongoose.connect(process.env.MONGO_URI);

    return mongoose.connection;
}

export async function initializeCarbonBrain() {
    if (initialized) {
        return {
            initialized: true,
            cached: true,
            mongo: mongoose.connection.name,
        };
    }

    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        const startedAt = Date.now();

        await connectMongo();

        initialized = true;

        return {
            initialized: true,
            cached: false,
            mongo: mongoose.connection.name,
            startupTime: Date.now() - startedAt,
        };
    })();

    return initializationPromise;
}

export function isCarbonBrainInitialized() {
    return initialized;
}

export function resetCarbonBrainInitialization() {
    initialized = false;
    initializationPromise = null;
}