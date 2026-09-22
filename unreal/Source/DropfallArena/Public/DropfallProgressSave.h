#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "DropfallProgressSave.generated.h"

/** A run may only advance after the current match has resolved. */
USTRUCT()
struct FDropfallLadderRun
{
    GENERATED_BODY()

    int32 Stage = 0;
    int32 RoundsConceded = 0;
    float ActiveSeconds = 0.0f;
    bool bActive = false;
    bool bAwaitingAdvance = false;
    bool bCompleted = false;

    void Start();
    void Tick(float Seconds);
    bool ResolveMatch(bool bWon, int32 OpponentScore);
    bool Advance();
};

USTRUCT()
struct FDropfallLadderRecord
{
    GENERATED_BODY()

    UPROPERTY()
    int32 RoundsConceded = 0;

    UPROPERTY()
    float ActiveSeconds = 0.0f;

    UPROPERTY()
    FDateTime CompletedAt;
};

UCLASS()
class DROPFALLARENA_API UDropfallProgressSave : public USaveGame
{
    GENERATED_BODY()

public:
    void EnsureValid();
    /** Returns a one-based rank, or zero when the run does not enter the board. */
    int32 RecordLadderRun(const FDropfallLadderRun& Run);

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<FDropfallLadderRecord> LadderRecords;

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<int32> WinsByDifficulty;

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<int32> BestStreakByDifficulty;

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<int32> CurrentStreakByDifficulty;
};
