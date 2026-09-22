#include "DropfallArenaGameMode.h"

#include "DropfallArenaHUD.h"
#include "DropfallFighterPawn.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/StaticMeshActor.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "InputCoreTypes.h"
#include "Kismet/GameplayStatics.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

ADropfallArenaGameMode::ADropfallArenaGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    DefaultPawnClass = nullptr;
    HUDClass = ADropfallArenaHUD::StaticClass();

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(
        TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (CubeAsset.Succeeded())
    {
        CubeMesh = CubeAsset.Object;
    }
}

void ADropfallArenaGameMode::BeginPlay()
{
    Super::BeginPlay();
    ClearTemplateGeometry();
    BuildGreyboxArena();
    SpawnFighters();
    SpawnCamera();
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
    if (bRoundActive && WinnerIndex == 0)
    {
        CheckRingOuts();
    }
}

void ADropfallArenaGameMode::BuildGreyboxArena()
{
    if (!CubeMesh)
    {
        return;
    }

    AActor* Floor = GetWorld()->SpawnActor<AActor>(FVector::ZeroVector, FRotator::ZeroRotator);
    Floor->SetActorLabel(TEXT("Arena Floor"));
    UStaticMeshComponent* FloorMesh = NewObject<UStaticMeshComponent>(Floor, TEXT("FloorMesh"));
    Floor->SetRootComponent(FloorMesh);
    FloorMesh->SetStaticMesh(CubeMesh);
    FloorMesh->SetWorldScale3D(FVector(12.0f, 8.0f, 0.35f));
    FloorMesh->SetWorldLocation(FVector(0.0f, 0.0f, -35.0f));
    FloorMesh->SetCollisionProfileName(TEXT("BlockAll"));
    FloorMesh->RegisterComponent();

    const FVector BumperLocations[] = {
        FVector(0.0f, 0.0f, 25.0f),
        FVector(-340.0f, 260.0f, 15.0f),
        FVector(340.0f, -260.0f, 15.0f)
    };

    for (int32 Index = 0; Index < UE_ARRAY_COUNT(BumperLocations); ++Index)
    {
        AActor* Bumper = GetWorld()->SpawnActor<AActor>(BumperLocations[Index], FRotator::ZeroRotator);
        Bumper->SetActorLabel(FString::Printf(TEXT("Bumper %d"), Index + 1));
        UStaticMeshComponent* Mesh = NewObject<UStaticMeshComponent>(Bumper);
        Bumper->SetRootComponent(Mesh);
        Mesh->SetStaticMesh(CubeMesh);
        Mesh->SetWorldScale3D(Index == 0 ? FVector(0.75f, 0.75f, 0.5f) : FVector(0.55f, 0.55f, 0.35f));
        Mesh->SetCollisionProfileName(TEXT("BlockAll"));
        Mesh->RegisterComponent();
    }
}

void ADropfallArenaGameMode::SpawnFighters()
{
    PlayerOne = GetWorld()->SpawnActor<ADropfallFighterPawn>(
        FVector(-390.0f, 0.0f, 110.0f), FRotator::ZeroRotator);
    PlayerTwo = GetWorld()->SpawnActor<ADropfallFighterPawn>(
        FVector(390.0f, 0.0f, 110.0f), FRotator::ZeroRotator);

    if (PlayerOne)
    {
        PlayerOne->SetActorLabel(TEXT("Cyan Fighter"));
        PlayerOne->SetFighterColor(FLinearColor(0.02f, 0.8f, 1.0f));
    }
    if (PlayerTwo)
    {
        PlayerTwo->SetActorLabel(TEXT("Coral Fighter"));
        PlayerTwo->SetFighterColor(FLinearColor(1.0f, 0.04f, 0.12f));
    }
}

void ADropfallArenaGameMode::SpawnCamera()
{
    const FVector CameraLocation(0.0f, -2050.0f, 2150.0f);
    const FRotator CameraRotation = (FVector::ZeroVector - CameraLocation).Rotation();
    ArenaCamera = GetWorld()->SpawnActor<ACameraActor>(CameraLocation, CameraRotation);
    ArenaCamera->SetActorLabel(TEXT("Arena Camera"));
    ArenaCamera->GetCameraComponent()->SetFieldOfView(60.0f);

    if (APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0))
    {
        Controller->SetViewTarget(ArenaCamera);
        Controller->bShowMouseCursor = false;
        Controller->SetInputMode(FInputModeGameOnly());
    }
}

void ADropfallArenaGameMode::ReadLocalInput(const float DeltaSeconds)
{
    APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0);
    if (!Controller || !PlayerOne || !PlayerTwo)
    {
        return;
    }

    if (Controller->WasInputKeyJustPressed(EKeys::F1))
    {
        ToggleOpponentMode();
    }
    if (Controller->WasInputKeyJustPressed(EKeys::F2))
    {
        CycleAIDifficulty();
    }
    if (Controller->WasInputKeyJustPressed(EKeys::R))
    {
        ResetMatch();
    }

    if (!bRoundActive || WinnerIndex != 0)
    {
        PlayerOne->SetMoveIntent(FVector2D::ZeroVector);
        PlayerTwo->SetMoveIntent(FVector2D::ZeroVector);
        return;
    }

    FVector2D PlayerOneIntent(
        Controller->IsInputKeyDown(EKeys::W) ? 1.0f : Controller->IsInputKeyDown(EKeys::S) ? -1.0f : 0.0f,
        Controller->IsInputKeyDown(EKeys::D) ? 1.0f : Controller->IsInputKeyDown(EKeys::A) ? -1.0f : 0.0f);
    const FVector2D GamepadIntent(
        Controller->GetInputAnalogKeyState(EKeys::Gamepad_LeftY),
        Controller->GetInputAnalogKeyState(EKeys::Gamepad_LeftX));
    if (GamepadIntent.SizeSquared() > FMath::Square(0.2f))
    {
        PlayerOneIntent = GamepadIntent;
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
        FVector2D PlayerTwoIntent(
            Controller->IsInputKeyDown(EKeys::Up) ? 1.0f : Controller->IsInputKeyDown(EKeys::Down) ? -1.0f : 0.0f,
            Controller->IsInputKeyDown(EKeys::Right) ? 1.0f : Controller->IsInputKeyDown(EKeys::Left) ? -1.0f : 0.0f);
        PlayerTwo->SetMoveIntent(PlayerTwoIntent);
        if (Controller->WasInputKeyJustPressed(EKeys::RightShift))
        {
            PlayerTwo->TryBoost();
        }
    }
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
    if (FMath::Abs(AILocation.X) > 940.0f || FMath::Abs(AILocation.Y) > 590.0f)
    {
        const FVector2D ToCenter(-AILocation.X, -AILocation.Y);
        Intent += ToCenter.GetSafeNormal() * EdgePressure;
    }
    return Intent.GetClampedToMaxSize(1.0f);
}

void ADropfallArenaGameMode::CheckRingOuts()
{
    const bool bPlayerOneOut = PlayerOne->GetActorLocation().Z < -260.0f;
    const bool bPlayerTwoOut = PlayerTwo->GetActorLocation().Z < -260.0f;

    if (bPlayerOneOut && bPlayerTwoOut)
    {
        bRoundActive = false;
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
    bRoundActive = false;
    LastScoringPlayer = ScoringPlayer;
    PlayerOne->SetMoveIntent(FVector2D::ZeroVector);
    PlayerTwo->SetMoveIntent(FVector2D::ZeroVector);
    if (ScoringPlayer == 1)
    {
        ++PlayerOneScore;
        WinnerIndex = PlayerOneScore >= WinningScore ? 1 : 0;
    }
    else
    {
        ++PlayerTwoScore;
        WinnerIndex = PlayerTwoScore >= WinningScore ? 2 : 0;
    }

    if (WinnerIndex == 0)
    {
        GetWorldTimerManager().SetTimer(RoundResetTimer, this,
            &ADropfallArenaGameMode::ResetRound, 1.0f, false);
    }
}

void ADropfallArenaGameMode::ResetRound()
{
    PlayerOne->ResetFighter(FVector(-390.0f, 0.0f, 110.0f));
    PlayerTwo->ResetFighter(FVector(390.0f, 0.0f, 110.0f));
    LastScoringPlayer = 0;
    AIThinkRemaining = 0.0f;
    AIBoostRemaining = 0.0f;
    bRoundActive = true;
}

void ADropfallArenaGameMode::ResetMatch()
{
    GetWorldTimerManager().ClearTimer(RoundResetTimer);
    PlayerOneScore = 0;
    PlayerTwoScore = 0;
    WinnerIndex = 0;
    ResetRound();
}

void ADropfallArenaGameMode::ToggleOpponentMode()
{
    bPlayerTwoAI = !bPlayerTwoAI;
    ResetMatch();
}

void ADropfallArenaGameMode::CycleAIDifficulty()
{
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
