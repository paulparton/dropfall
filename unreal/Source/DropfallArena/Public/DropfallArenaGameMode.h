#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "DropfallArenaGameMode.generated.h"

class ACameraActor;
class ADropfallFighterPawn;
class UStaticMesh;

UENUM(BlueprintType)
enum class EDropfallAIDifficulty : uint8
{
    Rookie,
    Rival,
    Ace
};

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
    bool IsRoundActive() const { return bRoundActive; }
    int32 GetLastScoringPlayer() const { return LastScoringPlayer; }
    EDropfallAIDifficulty GetAIDifficulty() const { return AIDifficulty; }
    FString GetAIDifficultyName() const;
    const ADropfallFighterPawn* GetPlayerOne() const { return PlayerOne; }
    const ADropfallFighterPawn* GetPlayerTwo() const { return PlayerTwo; }

private:
    void ClearTemplateGeometry();
    void BuildGreyboxArena();
    void SpawnFighters();
    void SpawnCamera();
    void ReadLocalInput(float DeltaSeconds);
    void UpdateAI(float DeltaSeconds);
    FVector2D CalculateAIIntent() const;
    void CheckRingOuts();
    void AwardPoint(int32 ScoringPlayer);
    void ResetRound();
    void ResetMatch();
    void ToggleOpponentMode();
    void CycleAIDifficulty();

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
    int32 LastScoringPlayer = 0;
    bool bPlayerTwoAI = true;
    bool bRoundActive = true;
    float AIClock = 0.0f;
    float AIThinkRemaining = 0.0f;
    float AIBoostRemaining = 0.0f;
    FVector2D CachedAIIntent = FVector2D::ZeroVector;
    EDropfallAIDifficulty AIDifficulty = EDropfallAIDifficulty::Rival;
    FTimerHandle RoundResetTimer;

    static constexpr int32 WinningScore = 3;
};
