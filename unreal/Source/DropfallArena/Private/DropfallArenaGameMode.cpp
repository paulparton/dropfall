#include "DropfallArenaGameMode.h"

#include "DropfallArenaHUD.h"
#include "DropfallPlayerController.h"
#include "DropfallFighterPawn.h"
#include "DropfallProgressSave.h"
#include "DropfallSynth.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/GameViewportClient.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

const FString ADropfallArenaGameMode::ProgressSlotName = TEXT("DropfallArenaProgress");

namespace
{
void SetDevelopmentLabel(AActor* Actor, const FString& Label)
{
#if WITH_EDITOR
    if (Actor)
    {
        Actor->SetActorLabel(Label);
    }
#endif
}
}

ADropfallArenaGameMode::ADropfallArenaGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    DefaultPawnClass = nullptr;
    HUDClass = ADropfallArenaHUD::StaticClass();
    PlayerControllerClass = ADropfallPlayerController::StaticClass();


}

void ADropfallArenaGameMode::BeginPlay()
{
    Super::BeginPlay();
    ClearTemplateGeometry();
    BuildArena();
    SpawnFighters();
    SpawnCamera();
    LoadProgress();
    MatchPhase = EDropfallMatchPhase::Ready;
    AIDifficulty = EDropfallAIDifficulty::Rookie;
    SetMenuInput(true);
}

FVector2D ADropfallArenaGameMode::ScreenToArenaIntent(const FVector2D& ScreenIntent)
{
    // Derive both axes from the same pose used by the actual shared camera.
    const FRotationMatrix CameraBasis((-GetArenaCameraLocation()).Rotation());
    const FVector Right = CameraBasis.GetUnitAxis(EAxis::Y);
    const FVector Up = CameraBasis.GetUnitAxis(EAxis::Z);
    return (FVector2D(Right.X, Right.Y).GetSafeNormal() * ScreenIntent.X
        + FVector2D(Up.X, Up.Y).GetSafeNormal() * ScreenIntent.Y).GetClampedToMaxSize(1.0f);
}

void ADropfallArenaGameMode::ClearTemplateGeometry()
{
    TArray<AStaticMeshActor*> TemplateMeshes;
    for (TActorIterator<AStaticMeshActor> It(GetWorld()); It; ++It)
    {
        TemplateMeshes.Add(*It);
    }

    for (AStaticMeshActor* Actor : TemplateMeshes)
    {
        Actor->Destroy();
    }
}

void ADropfallArenaGameMode::Tick(const float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    ReadLocalInput(DeltaSeconds);
    UpdateMatchFlow(DeltaSeconds);
    if (MatchPhase == EDropfallMatchPhase::Playing && WinnerIndex == 0)
    {
        CheckRingOuts();
    }
}

void ADropfallArenaGameMode::BuildArena()
{
    if (!ArenaLayout)
    {
        ArenaLayout = GetWorld()->SpawnActor<ADropfallArenaLayout>();
        SetDevelopmentLabel(ArenaLayout, TEXT("Arena Layout"));
    }
    ArenaLayout->Build(GetMap());
    FrameArenaCamera();
}

void ADropfallArenaGameMode::FrameArenaCamera()
{
    if (!ArenaCamera) return;
    const FVector2D Half = GetMap().HalfSize();
    // Keep the same camera basis (and input mapping) while fitting every map.
    const float DistanceScale = FMath::Max(Half.X / 780.0f, Half.Y / 780.0f);
    ArenaCamera->SetActorLocation(GetArenaCameraLocation() * DistanceScale);
}

void ADropfallArenaGameMode::CycleMap()
{
    if (MatchPhase != EDropfallMatchPhase::Ready) return;
    MapIndex = (MapIndex + 1) % FDropfallMapDefinition::Count;
    BuildArena();
    ResetMatch();
}

void ADropfallArenaGameMode::ToggleTerrainRule()
{
    if (MatchPhase != EDropfallMatchPhase::Ready) return;
    bFallAway = !bFallAway;
    ResetMatch();
}

void ADropfallArenaGameMode::SpawnFighters()
{
    PlayerOne = GetWorld()->SpawnActor<ADropfallFighterPawn>(
        GetMap().Spawn(true), FRotator::ZeroRotator);
    PlayerTwo = GetWorld()->SpawnActor<ADropfallFighterPawn>(
        GetMap().Spawn(false), FRotator::ZeroRotator);

    if (PlayerOne)
    {
        SetDevelopmentLabel(PlayerOne, TEXT("Cyan Fighter"));
        PlayerOne->SetFighterColor(FLinearColor(0.02f, 0.8f, 1.0f));
    }
    if (PlayerTwo)
    {
        SetDevelopmentLabel(PlayerTwo, TEXT("Coral Fighter"));
        PlayerTwo->SetFighterColor(FLinearColor(1.0f, 0.04f, 0.12f));
    }
}

void ADropfallArenaGameMode::SpawnCamera()
{
    const FVector CameraLocation = GetArenaCameraLocation();
    const FRotator CameraRotation = (FVector::ZeroVector - CameraLocation).Rotation();
    ArenaCamera = GetWorld()->SpawnActor<ACameraActor>(CameraLocation, CameraRotation);
    SetDevelopmentLabel(ArenaCamera, TEXT("Arena Camera"));
    ArenaCamera->GetCameraComponent()->SetFieldOfView(60.0f);
    FrameArenaCamera();

    if (APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0))
    {
        Controller->SetViewTarget(ArenaCamera);
        Controller->bShowMouseCursor = false;
        Controller->SetInputMode(FInputModeGameOnly());
    }

    if (!UGameplayStatics::GetPlayerController(this, 1))
    {
        UGameplayStatics::CreatePlayer(this, 1, true);
    }
    if (UGameViewportClient* Viewport = GetWorld()->GetGameViewport())
    {
        Viewport->SetForceDisableSplitscreen(true);
    }
    if (APlayerController* ControllerTwo = UGameplayStatics::GetPlayerController(this, 1))
    {
        ControllerTwo->SetViewTarget(ArenaCamera);
    }
}

void ADropfallArenaGameMode::ReadLocalInput(const float DeltaSeconds)
{
    APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0);
    if (!Controller || !PlayerOne || !PlayerTwo)
    {
        return;
    }

    if (Controller->WasInputKeyJustPressed(EKeys::M)
        || Controller->WasInputKeyJustPressed(EKeys::Gamepad_Special_Right))
    {
        ReturnToSetup();
        return;
    }
    if (MatchPhase == EDropfallMatchPhase::Ready)
    {
        if (Controller->WasInputKeyJustPressed(EKeys::E)
            || Controller->WasInputKeyJustPressed(EKeys::Gamepad_RightShoulder)) CycleMap();
        if (Controller->WasInputKeyJustPressed(EKeys::F)
            || Controller->WasInputKeyJustPressed(EKeys::Gamepad_LeftShoulder)) ToggleTerrainRule();
        const bool bNext = Controller->WasInputKeyJustPressed(EKeys::Right)
            || Controller->WasInputKeyJustPressed(EKeys::Gamepad_DPad_Right)
            || Controller->WasInputKeyJustPressed(EKeys::Tab);
        const bool bPrevious = Controller->WasInputKeyJustPressed(EKeys::Left)
            || Controller->WasInputKeyJustPressed(EKeys::Gamepad_DPad_Left);
        if (bNext || bPrevious)
        {
            SelectPlayMode(static_cast<EDropfallPlayMode>(
                (static_cast<int32>(PlayMode) + (bNext ? 1 : 2)) % 3));
        }
        if (Controller->WasInputKeyJustPressed(EKeys::Q)
            || Controller->WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Top))
        {
            CycleAIDifficulty();
        }
    }
    if (Controller->WasInputKeyJustPressed(EKeys::R))
    {
        StartSelectedMode();
        return;
    }

    APlayerController* ControllerTwo = UGameplayStatics::GetPlayerController(this, 1);
    const bool bStartPressed = Controller->WasInputKeyJustPressed(EKeys::Enter)
        || Controller->WasInputKeyJustPressed(EKeys::SpaceBar)
        || Controller->WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Bottom)
        || (ControllerTwo && ControllerTwo->WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Bottom));
    if ((MatchPhase == EDropfallMatchPhase::Ready || MatchPhase == EDropfallMatchPhase::MatchOver)
        && bStartPressed)
    {
        ConfirmSelection();
        return;
    }

    if (MatchPhase != EDropfallMatchPhase::Playing || WinnerIndex != 0)
    {
        PlayerOne->SetMoveIntent(FVector2D::ZeroVector);
        PlayerTwo->SetMoveIntent(FVector2D::ZeroVector);
        return;
    }

    const FVector2D PlayerOneScreenIntent(
        Controller->IsInputKeyDown(EKeys::D) ? 1.0f : Controller->IsInputKeyDown(EKeys::A) ? -1.0f : 0.0f,
        Controller->IsInputKeyDown(EKeys::W) ? 1.0f : Controller->IsInputKeyDown(EKeys::S) ? -1.0f : 0.0f);
    FVector2D PlayerOneIntent = ScreenToArenaIntent(PlayerOneScreenIntent);
    const FVector2D GamepadScreenIntent(
        Controller->GetInputAnalogKeyState(EKeys::Gamepad_LeftX),
        Controller->GetInputAnalogKeyState(EKeys::Gamepad_LeftY));
    if (GamepadScreenIntent.SizeSquared() > FMath::Square(0.2f))
    {
        PlayerOneIntent = ScreenToArenaIntent(GamepadScreenIntent);
    }
    PlayerOne->SetMoveIntent(PlayerOneIntent);
    if (Controller->WasInputKeyJustPressed(EKeys::SpaceBar)
        || Controller->WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Bottom))
    {
        PlayerOne->TryBoost();
    }

    AIClock += DeltaSeconds;
    if (bPlayerTwoAI)
    {
        UpdateAI(DeltaSeconds);
    }
    else
    {
        const FVector2D PlayerTwoScreenIntent(
            Controller->IsInputKeyDown(EKeys::Right) ? 1.0f : Controller->IsInputKeyDown(EKeys::Left) ? -1.0f : 0.0f,
            Controller->IsInputKeyDown(EKeys::Up) ? 1.0f : Controller->IsInputKeyDown(EKeys::Down) ? -1.0f : 0.0f);
        FVector2D PlayerTwoIntent = ScreenToArenaIntent(PlayerTwoScreenIntent);
        if (ControllerTwo)
        {
            const FVector2D PlayerTwoGamepadScreenIntent(
                ControllerTwo->GetInputAnalogKeyState(EKeys::Gamepad_LeftX),
                ControllerTwo->GetInputAnalogKeyState(EKeys::Gamepad_LeftY));
            if (PlayerTwoGamepadScreenIntent.SizeSquared() > FMath::Square(0.2f))
            {
                PlayerTwoIntent = ScreenToArenaIntent(PlayerTwoGamepadScreenIntent);
            }
        }
        PlayerTwo->SetMoveIntent(PlayerTwoIntent);
        if (Controller->WasInputKeyJustPressed(EKeys::RightShift)
            || (ControllerTwo && ControllerTwo->WasInputKeyJustPressed(EKeys::Gamepad_FaceButton_Bottom)))
        {
            PlayerTwo->TryBoost();
        }
    }
}

void ADropfallArenaGameMode::UpdateMatchFlow(const float DeltaSeconds)
{
    if (MatchPhase == EDropfallMatchPhase::Countdown)
    {
        CountdownRemaining = FMath::Max(0.0f, CountdownRemaining - DeltaSeconds);
        if (CountdownRemaining <= 0.0f)
        {
            MatchPhase = EDropfallMatchPhase::Playing;
            RoundElapsedSeconds = 0.0f;
        }
        return;
    }

    if (MatchPhase == EDropfallMatchPhase::Playing)
    {
        RoundElapsedSeconds += DeltaSeconds;
        if (PlayMode == EDropfallPlayMode::Ladder)
        {
            LadderRun.Tick(DeltaSeconds);
        }
        UpdateArenaTerrain();
    }
}

void ADropfallArenaGameMode::UpdateArenaTerrain()
{
    if (ArenaLayout) ArenaLayout->SetRoundTime(RoundElapsedSeconds, bFallAway);
}

void ADropfallArenaGameMode::BeginCountdown()
{
    SetMenuInput(false);
    MatchPhase = EDropfallMatchPhase::Countdown;
    CountdownRemaining = ArenaTuning.CountdownSeconds;
    RoundElapsedSeconds = 0.0f;
    PlayerOne->SetMoveIntent(FVector2D::ZeroVector);
    PlayerTwo->SetMoveIntent(FVector2D::ZeroVector);
    FDropfallSynth::PlayTone(this, FVector::ZeroVector, 440.0f, 0.12f, 0.10f);
}

void ADropfallArenaGameMode::UpdateAI(const float DeltaSeconds)
{
    AIThinkRemaining -= DeltaSeconds;
    AIBoostRemaining -= DeltaSeconds;

    const float ThinkInterval = AIDifficulty == EDropfallAIDifficulty::Rookie ? 0.32f
        : AIDifficulty == EDropfallAIDifficulty::Rival ? 0.16f : 0.07f;
    if (AIThinkRemaining <= 0.0f)
    {
        CachedAIIntent = CalculateAIIntent();
        AIThinkRemaining = ThinkInterval;
    }
    PlayerTwo->SetMoveIntent(CachedAIIntent);

    const float BoostDistance = AIDifficulty == EDropfallAIDifficulty::Rookie ? 235.0f
        : AIDifficulty == EDropfallAIDifficulty::Rival ? 315.0f : 390.0f;
    const float BoostInterval = AIDifficulty == EDropfallAIDifficulty::Rookie ? 2.2f
        : AIDifficulty == EDropfallAIDifficulty::Rival ? 1.45f : 0.9f;
    const float Distance = FVector::Dist2D(PlayerOne->GetActorLocation(), PlayerTwo->GetActorLocation());
    if (AIBoostRemaining <= 0.0f && Distance < BoostDistance && PlayerTwo->TryBoost())
    {
        AIBoostRemaining = BoostInterval;
    }
}

FVector2D ADropfallArenaGameMode::CalculateAIIntent() const
{
    FVector TargetLocation = PlayerOne->GetActorLocation();
    if (AIDifficulty == EDropfallAIDifficulty::Ace)
    {
        TargetLocation += PlayerOne->GetVelocity() * 0.22f;
    }

    const FVector ToPlayer = TargetLocation - PlayerTwo->GetActorLocation();
    const FVector2D Chase(ToPlayer.X, ToPlayer.Y);
    const FVector2D Strafe(-Chase.Y, Chase.X);
    const float ChaseWeight = AIDifficulty == EDropfallAIDifficulty::Rookie ? 0.72f : 1.0f;
    const float StrafeWeight = AIDifficulty == EDropfallAIDifficulty::Rookie ? 0.35f
        : AIDifficulty == EDropfallAIDifficulty::Rival ? 0.24f : 0.14f;
    FVector2D Intent = Chase.GetSafeNormal() * ChaseWeight
        + Strafe.GetSafeNormal() * FMath::Sin(AIClock * 1.7f) * StrafeWeight;

    const FVector AILocation = PlayerTwo->GetActorLocation();
    const float EdgePressure = AIDifficulty == EDropfallAIDifficulty::Rookie ? 0.8f
        : AIDifficulty == EDropfallAIDifficulty::Rival ? 1.5f : 2.4f;
    const FVector2D SafeSize = GetMap().SafeHalfSize(RoundElapsedSeconds, bFallAway);
    const float SafeEdgeX = SafeSize.X - 95.0f;
    const float SafeEdgeY = SafeSize.Y - 95.0f;
    if (FMath::Abs(AILocation.X) > SafeEdgeX || FMath::Abs(AILocation.Y) > SafeEdgeY)
    {
        const FVector2D ToCenter(-AILocation.X, -AILocation.Y);
        Intent += ToCenter.GetSafeNormal() * EdgePressure;
    }
    // Predict obstruction ahead; ramps remain valid routes, solid cover is skirted.
    FHitResult Hit;
    FCollisionQueryParams Query(SCENE_QUERY_STAT(DropfallBotAvoidance), false);
    Query.AddIgnoredActor(PlayerOne);
    Query.AddIgnoredActor(PlayerTwo);
    const FVector Heading(Intent.GetSafeNormal(), 0);
    if (GetWorld()->SweepSingleByChannel(Hit, AILocation, AILocation + Heading * 240,
        FQuat::Identity, ECC_Visibility, FCollisionShape::MakeSphere(45), Query)
        && Hit.GetComponent() && Hit.GetComponent()->ComponentHasTag(TEXT("ArenaObstacle")))
    {
        const FVector2D Normal(Hit.ImpactNormal);
        FVector2D Tangent(-Normal.Y, Normal.X);
        if (FVector2D::DotProduct(Tangent, Chase) < 0) Tangent *= -1;
        Intent = Tangent + Normal * 0.35f;
        if (FMath::Abs(AILocation.X) > SafeEdgeX || FMath::Abs(AILocation.Y) > SafeEdgeY)
            Intent += FVector2D(-AILocation.X, -AILocation.Y).GetSafeNormal() * EdgePressure;
    }
    return Intent.GetClampedToMaxSize(1.0f);
}

void ADropfallArenaGameMode::CheckRingOuts()
{
    const bool bPlayerOneOut = PlayerOne->GetActorLocation().Z < -260.0f;
    const bool bPlayerTwoOut = PlayerTwo->GetActorLocation().Z < -260.0f;

    if (bPlayerOneOut && bPlayerTwoOut)
    {
        MatchPhase = EDropfallMatchPhase::RoundOver;
        GetWorldTimerManager().SetTimer(RoundResetTimer, this,
            &ADropfallArenaGameMode::ResetRound, 1.0f, false);
    }
    else if (bPlayerOneOut)
    {
        AwardPoint(2);
    }
    else if (bPlayerTwoOut)
    {
        AwardPoint(1);
    }
}

void ADropfallArenaGameMode::AwardPoint(const int32 ScoringPlayer)
{
    MatchPhase = EDropfallMatchPhase::RoundOver;
    LastScoringPlayer = ScoringPlayer;
    PlayerOne->SetMoveIntent(FVector2D::ZeroVector);
    PlayerTwo->SetMoveIntent(FVector2D::ZeroVector);
    FDropfallSynth::PlayTone(this, FVector::ZeroVector,
        ScoringPlayer == 1 ? 760.0f : 620.0f, 0.24f, 0.16f);
    if (ScoringPlayer == 1)
    {
        ++PlayerOneScore;
        WinnerIndex = PlayerOneScore >= ArenaTuning.WinningScore ? 1 : 0;
    }
    else
    {
        ++PlayerTwoScore;
        WinnerIndex = PlayerTwoScore >= ArenaTuning.WinningScore ? 2 : 0;
    }

    if (WinnerIndex == 0)
    {
        GetWorldTimerManager().SetTimer(RoundResetTimer, this,
            &ADropfallArenaGameMode::ResetRound, 1.0f, false);
    }
    else
    {
        MatchPhase = EDropfallMatchPhase::MatchOver;
        SetMenuInput(true);
        FDropfallSynth::PlayTone(this, FVector::ZeroVector,
            WinnerIndex == 1 ? 1040.0f : 820.0f, 0.55f, 0.20f);
        if (bPlayerTwoAI)
        {
            RecordAIResult(WinnerIndex == 1);
        }
        if (PlayMode == EDropfallPlayMode::Ladder
            && LadderRun.ResolveMatch(WinnerIndex == 1, PlayerTwoScore)
            && LadderRun.bCompleted && ProgressSave)
        {
            LadderRank = ProgressSave->RecordLadderRun(LadderRun, GetMap().Id, bFallAway);
            SaveProgress();
        }
    }
}

void ADropfallArenaGameMode::ResetRound()
{
    PlayerOne->ResetFighter(GetMap().Spawn(true));
    PlayerTwo->ResetFighter(GetMap().Spawn(false));
    LastScoringPlayer = 0;
    AIClock = 0.0f;
    AIThinkRemaining = 0.0f;
    AIBoostRemaining = 0.0f;
    CachedAIIntent = FVector2D::ZeroVector;
    RoundElapsedSeconds = 0.0f;
    if (ArenaLayout) ArenaLayout->SetRoundTime(0, bFallAway);
    BeginCountdown();
}

void ADropfallArenaGameMode::ResetMatch()
{
    GetWorldTimerManager().ClearTimer(RoundResetTimer);
    PlayerOneScore = 0;
    PlayerTwoScore = 0;
    WinnerIndex = 0;
    LastScoringPlayer = 0;
    AIClock = 0.0f;
    AIThinkRemaining = 0.0f;
    AIBoostRemaining = 0.0f;
    CachedAIIntent = FVector2D::ZeroVector;
    CountdownRemaining = 0.0f;
    RoundElapsedSeconds = 0.0f;
    PlayerOne->ResetFighter(GetMap().Spawn(true));
    PlayerTwo->ResetFighter(GetMap().Spawn(false));
    if (ArenaLayout) ArenaLayout->SetRoundTime(0, bFallAway);
    MatchPhase = EDropfallMatchPhase::Ready;
}

void ADropfallArenaGameMode::CycleAIDifficulty()
{
    if (MatchPhase != EDropfallMatchPhase::Ready || PlayMode != EDropfallPlayMode::Practice)
    {
        return;
    }
    if (AIDifficulty == EDropfallAIDifficulty::Rookie)
    {
        AIDifficulty = EDropfallAIDifficulty::Rival;
    }
    else if (AIDifficulty == EDropfallAIDifficulty::Rival)
    {
        AIDifficulty = EDropfallAIDifficulty::Ace;
    }
    else
    {
        AIDifficulty = EDropfallAIDifficulty::Rookie;
    }
    bPlayerTwoAI = true;
    ResetMatch();
}

FString ADropfallArenaGameMode::GetAIDifficultyName() const
{
    switch (AIDifficulty)
    {
    case EDropfallAIDifficulty::Rookie:
        return TEXT("ROOKIE");
    case EDropfallAIDifficulty::Ace:
        return TEXT("ACE");
    default:
        return TEXT("RIVAL");
    }
}

float ADropfallArenaGameMode::GetRoundTimeRemaining() const
{
    return bFallAway ? GetMap().NextDrop(RoundElapsedSeconds) : 0;
}

bool ADropfallArenaGameMode::IsSuddenDeath() const
{
    return MatchPhase == EDropfallMatchPhase::Playing
        && bFallAway && GetMap().NextDrop(RoundElapsedSeconds) <= FDropfallMapDefinition::WarningSeconds;
}

void ADropfallArenaGameMode::LoadProgress()
{
    ProgressSave = Cast<UDropfallProgressSave>(
        UGameplayStatics::LoadGameFromSlot(ProgressSlotName, 0));
    if (!ProgressSave)
    {
        ProgressSave = Cast<UDropfallProgressSave>(
            UGameplayStatics::CreateSaveGameObject(UDropfallProgressSave::StaticClass()));
    }
    ProgressSave->EnsureValid();
}

void ADropfallArenaGameMode::RecordAIResult(const bool bPlayerWon)
{
    if (!ProgressSave)
    {
        return;
    }

    const int32 Index = static_cast<int32>(AIDifficulty);
    if (bPlayerWon)
    {
        ++ProgressSave->WinsByDifficulty[Index];
        ++ProgressSave->CurrentStreakByDifficulty[Index];
        ProgressSave->BestStreakByDifficulty[Index] = FMath::Max(
            ProgressSave->BestStreakByDifficulty[Index],
            ProgressSave->CurrentStreakByDifficulty[Index]);
    }
    else
    {
        ProgressSave->CurrentStreakByDifficulty[Index] = 0;
    }
    SaveProgress();
}

void ADropfallArenaGameMode::SaveProgress()
{
    bSaveFailed = !ProgressSave || !UGameplayStatics::SaveGameToSlot(ProgressSave, ProgressSlotName, 0);
}

void ADropfallArenaGameMode::SetMenuInput(const bool bMenu)
{
    if (APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0))
    {
        Controller->bShowMouseCursor = bMenu;
        // HUD handles menu clicks once through local input; actor clicks are unused.
        Controller->bEnableClickEvents = false;
        if (bMenu)
        {
            // GameOnly enables high-precision mouse capture even if the viewport
            // capture mode is later changed. GameAndUI explicitly releases it.
            FInputModeGameAndUI InputMode;
            InputMode.SetHideCursorDuringCapture(false);
            InputMode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
            Controller->SetInputMode(InputMode);
            // Keep CaptureDuringMouseDown: SceneViewport intentionally skips
            // forwarding mouse presses to PlayerController in NoCapture mode.
        }
        else
        {
            Controller->SetInputMode(FInputModeGameOnly());
        }
    }
}

void ADropfallArenaGameMode::SelectPlayMode(const EDropfallPlayMode Mode)
{
    if (MatchPhase != EDropfallMatchPhase::Ready)
    {
        return;
    }
    PlayMode = Mode;
    bPlayerTwoAI = Mode != EDropfallPlayMode::Couch;
    if (Mode == EDropfallPlayMode::Ladder)
    {
        AIDifficulty = EDropfallAIDifficulty::Rookie;
    }
}

void ADropfallArenaGameMode::StartSelectedMode()
{
    LadderRun = FDropfallLadderRun();
    LadderRank = 0;
    bPlayerTwoAI = PlayMode != EDropfallPlayMode::Couch;
    if (PlayMode == EDropfallPlayMode::Ladder)
    {
        LadderRun.Start();
        AIDifficulty = EDropfallAIDifficulty::Rookie;
    }
    ResetMatch();
    BeginCountdown();
}

void ADropfallArenaGameMode::ConfirmSelection()
{
    if (MatchPhase == EDropfallMatchPhase::Ready)
    {
        StartSelectedMode();
    }
    else if (MatchPhase == EDropfallMatchPhase::MatchOver)
    {
        if (PlayMode == EDropfallPlayMode::Ladder && LadderRun.Advance())
        {
            AIDifficulty = static_cast<EDropfallAIDifficulty>(LadderRun.Stage);
            ResetMatch();
            BeginCountdown();
        }
        else
        {
            StartSelectedMode();
        }
    }
}

void ADropfallArenaGameMode::ReturnToSetup()
{
    // Leaving a run abandons it; only defeating Ace records a leaderboard entry.
    LadderRun = FDropfallLadderRun();
    LadderRank = 0;
    ResetMatch();
    SelectPlayMode(PlayMode);
    SetMenuInput(true);
}

int32 ADropfallArenaGameMode::GetAIWins() const
{
    return ProgressSave ? ProgressSave->WinsByDifficulty[static_cast<int32>(AIDifficulty)] : 0;
}

int32 ADropfallArenaGameMode::GetAIBestStreak() const
{
    return ProgressSave ? ProgressSave->BestStreakByDifficulty[static_cast<int32>(AIDifficulty)] : 0;
}

int32 ADropfallArenaGameMode::GetAICurrentStreak() const
{
    return ProgressSave ? ProgressSave->CurrentStreakByDifficulty[static_cast<int32>(AIDifficulty)] : 0;
}
