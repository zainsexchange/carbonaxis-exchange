import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const READY_STATE = {
    DISCONNECTED: 0,
    CONNECTED: 1,
    CONNECTING: 2,
    DISCONNECTING: 3,
};

function getMongoStatus() {
    const state = mongoose.connection.readyState;

    return {
        connected: state === READY_STATE.CONNECTED,
        readyState: state,
        database: mongoose.connection.name || null,
        host: mongoose.connection.host || null,
    };
}

function validateMongo() {
    const status = getMongoStatus();

    if (!status.connected) {
        throw new Error(
            "MongoDB connection is not available."
        );
    }

    return status;
}

function validateEnvironment() {
    const required = [
        "OPENAI_API_KEY",
        "MONGO_URI",
    ];

    const missing = required.filter(
        (key) => !process.env[key]
    );

    if (missing.length) {
        throw new Error(
            `Missing environment variables: ${missing.join(", ")}`
        );
    }

    return {
        valid: true,
    };
}

export function validateInfrastructure() {
    return {
        environment: validateEnvironment(),
        mongo: validateMongo(),
    };
}

export {
    getMongoStatus,
};