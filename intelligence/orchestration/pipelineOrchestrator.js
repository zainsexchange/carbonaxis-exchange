const PIPELINE_STATUS = Object.freeze({
    IDLE: "idle",
    RUNNING: "running",
    COMPLETED: "completed",
    FAILED: "failed",
});

function now() {
    return Date.now();
}

function validateContext(context) {
    if (!context || typeof context !== "object") {
        throw new TypeError(
            "Pipeline context must be an object.",
        );
    }

    if (!context.metrics) {
        context.metrics = {};
    }

    if (!context.metrics.stageExecutionTimes) {
        context.metrics.stageExecutionTimes = {};
    }

    if (!Array.isArray(context.stageHistory)) {
        context.stageHistory = [];
    }

    if (!Array.isArray(context.pipelineErrors)) {
        context.pipelineErrors = [];
    }
}

function validateStages(stages) {
    if (!Array.isArray(stages)) {
        throw new TypeError(
            "Pipeline stages must be an array.",
        );
    }

    for (const stage of stages) {
        if (!stage || typeof stage !== "object") {
            throw new TypeError(
                "Each pipeline stage must be an object.",
            );
        }

        if (
            typeof stage.name !== "string" ||
            !stage.name.trim()
        ) {
            throw new TypeError(
                "Each pipeline stage must have a valid name.",
            );
        }

        if (typeof stage.execute !== "function") {
            throw new TypeError(
                `Pipeline stage "${stage.name}" must provide an execute function.`,
            );
        }
    }
}

function recordStageEntry(
    context,
    stageName,
) {
    context.stageHistory.push({
        stage: stageName,
        status: PIPELINE_STATUS.RUNNING,
        enteredAt: new Date().toISOString(),
    });
}

function recordStageCompletion(
    context,
    stageName,
    executionTime,
    skipped = false,
) {
    const historyEntry =
        context.stageHistory[
            context.stageHistory.length - 1
        ];

    if (
        historyEntry &&
        historyEntry.stage === stageName
    ) {
        historyEntry.status =
            PIPELINE_STATUS.COMPLETED;

        historyEntry.completedAt =
            new Date().toISOString();

        historyEntry.executionTime =
            executionTime;

        historyEntry.skipped =
            skipped;
    }

    context.metrics.stageExecutionTimes[
        stageName
    ] = executionTime;
}

function recordStageFailure(
    context,
    stageName,
    error,
    executionTime,
) {
    const historyEntry =
        context.stageHistory[
            context.stageHistory.length - 1
        ];

    if (
        historyEntry &&
        historyEntry.stage === stageName
    ) {
        historyEntry.status =
            PIPELINE_STATUS.FAILED;

        historyEntry.completedAt =
            new Date().toISOString();

        historyEntry.executionTime =
            executionTime;
    }

    context.metrics.stageExecutionTimes[
        stageName
    ] = executionTime;

    context.pipelineErrors.push({
        stage: stageName,
        name: error?.name || "Error",
        message:
            error?.message ||
            "Unknown pipeline stage error.",
        timestamp: new Date().toISOString(),
    });
}

async function shouldSkipStage(
    stage,
    context,
) {
    if (typeof stage.shouldSkip !== "function") {
        return false;
    }

    return Boolean(
        await stage.shouldSkip(context),
    );
}

async function executeStage(
    stage,
    context,
) {
    const stageName = stage.name.trim();

    recordStageEntry(
        context,
        stageName,
    );

    const startedAt = now();

    try {
        const skipped =
            await shouldSkipStage(
                stage,
                context,
            );

        if (skipped) {
            const executionTime =
                now() - startedAt;

            recordStageCompletion(
                context,
                stageName,
                executionTime,
                true,
            );

            return {
                stage: stageName,
                skipped: true,
                result: null,
            };
        }

        const result =
            await stage.execute(context);

        const executionTime =
            now() - startedAt;

        recordStageCompletion(
            context,
            stageName,
            executionTime,
        );

        return {
            stage: stageName,
            skipped: false,
            result,
        };
    } catch (error) {
        const executionTime =
            now() - startedAt;

        recordStageFailure(
            context,
            stageName,
            error,
            executionTime,
        );

        if (stage.continueOnError === true) {
            return {
                stage: stageName,
                skipped: false,
                result: null,
                error,
            };
        }

        error.pipelineStage = stageName;

        throw error;
    }
}

export async function executePipeline({
    context,
    stages,
}) {
    validateContext(context);
    validateStages(stages);

    const startedAt = now();

    context.pipelineStatus =
        PIPELINE_STATUS.RUNNING;

    context.pipelineStartedAt =
        new Date().toISOString();

    const results = {};

    try {
        for (const stage of stages) {
            const stageResult =
                await executeStage(
                    stage,
                    context,
                );

            results[stageResult.stage] =
                stageResult;
        }

        context.pipelineStatus =
            PIPELINE_STATUS.COMPLETED;

        context.pipelineCompletedAt =
            new Date().toISOString();

        context.metrics.pipelineExecutionTime =
            now() - startedAt;

        return {
            status:
                PIPELINE_STATUS.COMPLETED,
            context,
            results,
        };
    } catch (error) {
        context.pipelineStatus =
            PIPELINE_STATUS.FAILED;

        context.pipelineCompletedAt =
            new Date().toISOString();

        context.metrics.pipelineExecutionTime =
            now() - startedAt;

        return {
            status:
                PIPELINE_STATUS.FAILED,
            context,
            results,
            error: {
                name:
                    error?.name ||
                    "Error",
                message:
                    error?.message ||
                    "Unknown pipeline error.",
                stage:
                    error?.pipelineStage ||
                    null,
                stack:
                    error?.stack ||
                    null,
            },
        };
    }
}

export {
    PIPELINE_STATUS,
    executeStage,
};