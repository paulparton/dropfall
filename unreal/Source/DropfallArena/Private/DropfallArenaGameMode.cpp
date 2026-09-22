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
    PlayerOne->SetMoveIntent(PlayerOneIntent);
    if (Controller->WasInputKeyJustPressed(EKeys::SpaceBar))
    {
        PlayerOne->TryBoost();
    }

    AIClock += DeltaSeconds;
    if (bPlayerTwoAI)
    {
        PlayerTwo->SetMoveIntent(GetAIIntent(DeltaSeconds));
        const float Distance = FVector::Dist2D(PlayerOne->GetActorLocation(), PlayerTwo->GetActorLocation());
        if (Distance < 310.0f && FMath::Fmod(AIClock, 1.4f) < DeltaSeconds)
        {
            PlayerTwo->TryBoost();
        }
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

FVector2D ADropfallArenaGameMode::GetAIIntent(float DeltaSeconds) const
{
    const FVector ToPlayer = PlayerOne->GetActorLocation() - PlayerTwo->GetActorLocation();
    const FVector2D Chase(ToPlayer.X, ToPlayer.Y);
    const FVector2D Strafe(-Chase.Y, Chase.X);
    return (Chase.GetSafeNormal() + Strafe.GetSafeNormal() * FMath::Sin(AIClock * 1.7f) * 0.28f)
        .GetClampedToMaxSize(1.0f);
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
