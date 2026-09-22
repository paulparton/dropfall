#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "DropfallProgressSave.generated.h"

UCLASS()
class DROPFALLARENA_API UDropfallProgressSave : public USaveGame
{
    GENERATED_BODY()

public:
    void EnsureValid();

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<int32> WinsByDifficulty;

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<int32> BestStreakByDifficulty;

    UPROPERTY(VisibleAnywhere, Category = "Dropfall|Progress")
    TArray<int32> CurrentStreakByDifficulty;
};
