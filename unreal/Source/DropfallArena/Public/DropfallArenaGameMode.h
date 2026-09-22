#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "DropfallArenaGameMode.generated.h"

class ACameraActor;
class ADropfallFighterPawn;
class UStaticMesh;

UCLASS()
class DROPFALLARENA_API ADropfallArenaGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    ADropfallArenaGameMode();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    int32 GetPlayerOneScore() const { return PlayerOneScore; }
    int32 GetPlayerTwoScore() const { return PlayerTwoScore; }
    int32 GetWinnerIndex() const { return WinnerIndex; }
    bool IsPlayerTwoAI() const { return bPlayerTwoAI; }

private:
    void ClearTemplateGeometry();
    void BuildGreyboxArena();
    void SpawnFighters();
    void SpawnCamera();
    void ReadLocalInput(float DeltaSeconds);
    FVector2D GetAIIntent(float DeltaSeconds) const;
    void CheckRingOuts();
    void AwardPoint(int32 ScoringPlayer);
    void ResetRound();
    void ResetMatch();
    void ToggleOpponentMode();

    UPROPERTY()
    TObjectPtr<ADropfallFighterPawn> PlayerOne;

    UPROPERTY()
    TObjectPtr<ADropfallFighterPawn> PlayerTwo;

    UPROPERTY()
    TObjectPtr<ACameraActor> ArenaCamera;

    UPROPERTY()
    TObjectPtr<UStaticMesh> CubeMesh;

    int32 PlayerOneScore = 0;
    int32 PlayerTwoScore = 0;
    int32 WinnerIndex = 0;
    bool bPlayerTwoAI = true;
    bool bRoundActive = true;
    float AIClock = 0.0f;
    FTimerHandle RoundResetTimer;

    static constexpr int32 WinningScore = 3;
};
