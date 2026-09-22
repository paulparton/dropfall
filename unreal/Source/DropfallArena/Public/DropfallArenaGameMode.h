#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "DropfallProgressSave.h"
#include "DropfallArenaLayout.h"
#include "DropfallArenaGameMode.generated.h"

class ACameraActor;
class UMaterialInterface;
class ADropfallFighterPawn;
class UDropfallProgressSave;
class UStaticMesh;
class UStaticMeshComponent;

UENUM(BlueprintType)
enum class EDropfallAIDifficulty : uint8
{
    Rookie,
    Rival,
    Ace
};

UENUM(BlueprintType)
enum class EDropfallPlayMode : uint8
{
    Practice,
    Ladder,
    Couch
};

UENUM(BlueprintType)
enum class EDropfallMatchPhase : uint8
{
    Ready,
    Countdown,
    Playing,
    RoundOver,
    MatchOver
};

USTRUCT(BlueprintType)
struct FDropfallArenaTuning
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 WinningScore = 3;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float CountdownSeconds = 2.4f;

};

UCLASS()
class DROPFALLARENA_API ADropfallArenaGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    ADropfallArenaGameMode();

    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;

    /** Converts view-space input (right, up) into the arena's fixed world axes. */
    static FVector2D ScreenToArenaIntent(const FVector2D& ScreenIntent);
    static FVector GetArenaCameraLocation() { return FVector(0.0f, -2050.0f, 2150.0f); }

    int32 GetPlayerOneScore() const { return PlayerOneScore; }
    int32 GetPlayerTwoScore() const { return PlayerTwoScore; }
    int32 GetWinnerIndex() const { return WinnerIndex; }
    bool IsPlayerTwoAI() const { return bPlayerTwoAI; }
    bool IsRoundActive() const { return MatchPhase == EDropfallMatchPhase::Playing; }
    int32 GetLastScoringPlayer() const { return LastScoringPlayer; }
    EDropfallAIDifficulty GetAIDifficulty() const { return AIDifficulty; }
    EDropfallMatchPhase GetMatchPhase() const { return MatchPhase; }
    float GetCountdownRemaining() const { return CountdownRemaining; }
    float GetRoundTimeRemaining() const;
    bool IsSuddenDeath() const;
    int32 GetAIWins() const;
    int32 GetAIBestStreak() const;
    int32 GetAICurrentStreak() const;
    FString GetAIDifficultyName() const;
    const ADropfallFighterPawn* GetPlayerOne() const { return PlayerOne; }
    const ADropfallFighterPawn* GetPlayerTwo() const { return PlayerTwo; }
    EDropfallPlayMode GetPlayMode() const { return PlayMode; }
    const FDropfallLadderRun& GetLadderRun() const { return LadderRun; }
    const UDropfallProgressSave* GetProgress() const { return ProgressSave; }
    int32 GetLadderRank() const { return LadderRank; }
    bool DidSaveFail() const { return bSaveFailed; }
    void SelectPlayMode(EDropfallPlayMode Mode);
    void ConfirmSelection();
    void ReturnToSetup();
    void CycleAIDifficulty();
    void CycleMap();
    void ToggleTerrainRule();
    FDropfallMapDefinition GetMap() const { return FDropfallMapDefinition::Get(MapIndex); }
    bool IsFallAway() const { return bFallAway; }
    FString GetTerrainRuleName() const { return bFallAway ? TEXT("FALL AWAY") : TEXT("STABLE ARENA"); }

private:
    void ClearTemplateGeometry();
    void BuildArena();
    void FrameArenaCamera();
    void SpawnFighters();
    void SpawnCamera();
    void ReadLocalInput(float DeltaSeconds);
    void UpdateMatchFlow(float DeltaSeconds);
    void UpdateArenaTerrain();
    void BeginCountdown();
    void UpdateAI(float DeltaSeconds);
    FVector2D CalculateAIIntent() const;
    void CheckRingOuts();
    void AwardPoint(int32 ScoringPlayer);
    void ResetRound();
    void ResetMatch();
    void SetMenuInput(bool bMenu);
    void StartSelectedMode();
    void SaveProgress();
    void LoadProgress();
    void RecordAIResult(bool bPlayerWon);

    UPROPERTY()
    TObjectPtr<ADropfallFighterPawn> PlayerOne;

    UPROPERTY()
    TObjectPtr<ADropfallFighterPawn> PlayerTwo;

    UPROPERTY()
    TObjectPtr<ACameraActor> ArenaCamera;

    UPROPERTY()
    TObjectPtr<ADropfallArenaLayout> ArenaLayout;

    UPROPERTY()
    TObjectPtr<UDropfallProgressSave> ProgressSave;

    UPROPERTY(EditAnywhere, Category = "Dropfall|Arena")
    FDropfallArenaTuning ArenaTuning;

    int32 PlayerOneScore = 0;
    int32 PlayerTwoScore = 0;
    int32 WinnerIndex = 0;
    int32 LastScoringPlayer = 0;
    bool bPlayerTwoAI = true;
    EDropfallMatchPhase MatchPhase = EDropfallMatchPhase::Ready;
    float CountdownRemaining = 0.0f;
    float RoundElapsedSeconds = 0.0f;
    float AIClock = 0.0f;
    float AIThinkRemaining = 0.0f;
    float AIBoostRemaining = 0.0f;
    FVector2D CachedAIIntent = FVector2D::ZeroVector;
    EDropfallAIDifficulty AIDifficulty = EDropfallAIDifficulty::Rival;
    EDropfallPlayMode PlayMode = EDropfallPlayMode::Ladder;
    FDropfallLadderRun LadderRun;
    int32 LadderRank = 0;
    bool bSaveFailed = false;
    int32 MapIndex = 0;
    bool bFallAway = true;
    FTimerHandle RoundResetTimer;

    static const FString ProgressSlotName;
};
