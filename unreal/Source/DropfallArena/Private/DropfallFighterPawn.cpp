#include "DropfallFighterPawn.h"

#include "Components/PrimitiveComponent.h"
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
    Body->SetNotifyRigidBodyCollision(true);
    Body->OnComponentHit.AddDynamic(this, &ADropfallFighterPawn::HandleBodyHit);
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
    ImpactLockoutRemaining = FMath::Max(0.0f, ImpactLockoutRemaining - DeltaSeconds);

    const FVector Direction(MoveIntent.X, MoveIntent.Y, 0.0f);
    if (!Direction.IsNearlyZero())
    {
        LastMoveDirection = Direction.GetSafeNormal();
        Body->AddForce(LastMoveDirection * Tuning.MoveAcceleration, NAME_None, true);
    }

    FVector Velocity = Body->GetPhysicsLinearVelocity();
    const FVector PlanarVelocity(Velocity.X, Velocity.Y, 0.0f);
    const float AllowedSpeed = IsBoostActive()
        ? Tuning.BoostMaxPlanarSpeed
        : Tuning.MaxPlanarSpeed;
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

bool ADropfallFighterPawn::TryBoost()
{
    if (BoostCooldownRemaining > 0.0f)
    {
        return false;
    }

    Body->AddImpulse(LastMoveDirection * Tuning.BoostImpulse, NAME_None, true);
    BoostCooldownRemaining = Tuning.BoostCooldown;
    return true;
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
    ImpactLockoutRemaining = 0.0f;
}

float ADropfallFighterPawn::GetBoostReadiness() const
{
    if (Tuning.BoostCooldown <= UE_SMALL_NUMBER)
    {
        return 1.0f;
    }
    return 1.0f - FMath::Clamp(BoostCooldownRemaining / Tuning.BoostCooldown, 0.0f, 1.0f);
}

float ADropfallFighterPawn::GetPlanarSpeed() const
{
    return Body ? Body->GetPhysicsLinearVelocity().Size2D() : 0.0f;
}

bool ADropfallFighterPawn::IsBoostActive() const
{
    return BoostCooldownRemaining > Tuning.BoostCooldown - BoostSpeedWindow;
}

void ADropfallFighterPawn::HandleBodyHit(UPrimitiveComponent* HitComponent, AActor* OtherActor,
    UPrimitiveComponent* OtherComponent, FVector NormalImpulse, const FHitResult& Hit)
{
    ADropfallFighterPawn* OtherFighter = Cast<ADropfallFighterPawn>(OtherActor);
    if (!OtherFighter || OtherFighter == this || ImpactLockoutRemaining > 0.0f
        || OtherFighter->ImpactLockoutRemaining > 0.0f
        || GetUniqueID() > OtherFighter->GetUniqueID())
    {
        return;
    }

    const FVector RelativeVelocity = Body->GetPhysicsLinearVelocity()
        - OtherFighter->Body->GetPhysicsLinearVelocity();
    const float ClosingSpeed = RelativeVelocity.Size2D();
    if (ClosingSpeed < MinimumImpactSpeed)
    {
        return;
    }

    FVector ImpactDirection = OtherFighter->GetActorLocation() - GetActorLocation();
    ImpactDirection.Z = 0.0f;
    ImpactDirection = ImpactDirection.GetSafeNormal();
    if (ImpactDirection.IsNearlyZero())
    {
        return;
    }

    const float ImpactStrength = FMath::Clamp(
        (ClosingSpeed - MinimumImpactSpeed) * ImpactVelocityScale,
        MinimumImpactImpulse, MaximumImpactImpulse);
    Body->AddImpulse(-ImpactDirection * ImpactStrength, NAME_None, true);
    OtherFighter->Body->AddImpulse(ImpactDirection * ImpactStrength, NAME_None, true);
    ImpactLockoutRemaining = ImpactLockout;
    OtherFighter->ImpactLockoutRemaining = ImpactLockout;
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
