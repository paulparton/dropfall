#include "DropfallFighterPawn.h"

#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

ADropfallFighterPawn::ADropfallFighterPawn()
{
    PrimaryActorTick.bCanEverTick = true;
    bReplicates = true;

    Body = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Body"));
    SetRootComponent(Body);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(
        TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (SphereMesh.Succeeded())
    {
        Body->SetStaticMesh(SphereMesh.Object);
    }

    static ConstructorHelpers::FObjectFinder<UMaterialInterface> ShapeMaterial(
        TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
    if (ShapeMaterial.Succeeded())
    {
        Body->SetMaterial(0, ShapeMaterial.Object);
    }

    Body->SetWorldScale3D(FVector(1.05f));
    Body->SetSimulatePhysics(true);
    Body->SetEnableGravity(true);
    Body->SetCollisionProfileName(TEXT("PhysicsActor"));
    Body->SetLinearDamping(0.65f);
    Body->SetAngularDamping(0.25f);
    Body->BodyInstance.bUseCCD = true;
    Body->SetGenerateOverlapEvents(false);
}

void ADropfallFighterPawn::BeginPlay()
{
    Super::BeginPlay();
    Body->SetMassOverrideInKg(NAME_None, 95.0f, true);
}

void ADropfallFighterPawn::Tick(const float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    BoostCooldownRemaining = FMath::Max(0.0f, BoostCooldownRemaining - DeltaSeconds);

    const FVector Direction(MoveIntent.X, MoveIntent.Y, 0.0f);
    if (!Direction.IsNearlyZero())
    {
        LastMoveDirection = Direction.GetSafeNormal();
        Body->AddForce(LastMoveDirection * MoveAcceleration, NAME_None, true);
    }

    FVector Velocity = Body->GetPhysicsLinearVelocity();
    const FVector PlanarVelocity(Velocity.X, Velocity.Y, 0.0f);
    const float AllowedSpeed = BoostCooldownRemaining > BoostCooldown - 0.35f
        ? BoostMaxPlanarSpeed
        : MaxPlanarSpeed;
    if (PlanarVelocity.SizeSquared() > FMath::Square(AllowedSpeed))
    {
        const FVector ClampedPlanar = PlanarVelocity.GetSafeNormal() * AllowedSpeed;
        Velocity.X = ClampedPlanar.X;
        Velocity.Y = ClampedPlanar.Y;
        Body->SetPhysicsLinearVelocity(Velocity);
    }
}

void ADropfallFighterPawn::SetMoveIntent(const FVector2D& Intent)
{
    MoveIntent = Intent.GetClampedToMaxSize(1.0f);
}

void ADropfallFighterPawn::TryBoost()
{
    if (BoostCooldownRemaining > 0.0f)
    {
        return;
    }

    Body->AddImpulse(LastMoveDirection * BoostImpulse, NAME_None, true);
    BoostCooldownRemaining = BoostCooldown;
}

void ADropfallFighterPawn::ResetFighter(const FVector& SpawnLocation)
{
    Body->SetPhysicsLinearVelocity(FVector::ZeroVector);
    Body->SetPhysicsAngularVelocityInDegrees(FVector::ZeroVector);
    SetActorLocationAndRotation(SpawnLocation, FRotator::ZeroRotator, false, nullptr,
        ETeleportType::TeleportPhysics);
    MoveIntent = FVector2D::ZeroVector;
    LastMoveDirection = SpawnLocation.X < 0.0f ? FVector::ForwardVector : -FVector::ForwardVector;
    BoostCooldownRemaining = 0.0f;
}

void ADropfallFighterPawn::SetFighterColor(const FLinearColor& Color)
{
    UMaterialInterface* BaseMaterial = Body->GetMaterial(0);
    if (!BaseMaterial)
    {
        return;
    }

    UMaterialInstanceDynamic* Material = UMaterialInstanceDynamic::Create(BaseMaterial, this);
    Material->SetVectorParameterValue(TEXT("Color"), Color);
    Material->SetVectorParameterValue(TEXT("BaseColor"), Color);
    Body->SetMaterial(0, Material);
}
