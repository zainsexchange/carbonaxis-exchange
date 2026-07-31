import {
    initializeCarbonBrain,
} from "../bootstrap/initializeCarbonBrain.js";

import {
    validateInfrastructure,
} from "../engine/infrastructureGuard.js";

import {
    semanticRetrieve,
} from "../retrieval/semanticRetriever.js";

export const bootstrapStage = {
    name: "bootstrap",

    async execute(context) {
        context.bootstrap =
            await initializeCarbonBrain();

        return context.bootstrap;
    },
};

export const infrastructureStage = {
    name: "infrastructure_validation",

    async execute(context) {
        context.infrastructure =
            validateInfrastructure();

        return context.infrastructure;
    },
};

export const semanticRetrievalStage = {
    name: "semantic_retrieval",

    async execute(context) {
        context.semantic =
            await semanticRetrieve({
                question: context.question,
                user: context.user,
            });

        return context.semantic;
    },
};
