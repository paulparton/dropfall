#if WITH_DEV_AUTOMATION_TESTS

#include "DropfallArenaGameMode.h"
#include "DropfallFighterPawn.h"
#include "DropfallMonetizationSubsystem.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallScreenInputTest,
    "DropfallArena.Input.ScreenRelativeMapping",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDropfallScreenInputTest::RunTest(const FString& Parameters)
{
    const FVector2D Up = ADropfallArenaGameMode::ScreenToArenaIntent(FVector2D(0.0f, 1.0f));
    const FVector2D Right = ADropfallArenaGameMode::ScreenToArenaIntent(FVector2D(1.0f, 0.0f));
    const FRotationMatrix CameraBasis((-ADropfallArenaGameMode::GetArenaCameraLocation()).Rotation());
    const FVector CameraUp = CameraBasis.GetUnitAxis(EAxis::Z);
    const FVector CameraRight = CameraBasis.GetUnitAxis(EAxis::Y);
    TestTrue(TEXT("W projects upward through the real camera"),
        FVector::DotProduct(FVector(Up.X, Up.Y, 0), CameraUp) > 0.5f);
    TestTrue(TEXT("D projects rightward through the real camera"),
        FVector::DotProduct(FVector(Right.X, Right.Y, 0), CameraRight) > 0.99f);
    const FVector2D Down = ADropfallArenaGameMode::ScreenToArenaIntent(FVector2D(0, -1));
    TestTrue(TEXT("S projects downward"), FVector::DotProduct(FVector(Down.X, Down.Y, 0), CameraUp) < -0.5f);
    TestTrue(TEXT("diagonal input cannot move faster"),
        ADropfallArenaGameMode::ScreenToArenaIntent(FVector2D(1, 1)).Size() <= 1.0001f);
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallMonetizationPolicyTest,
    "DropfallArena.ProductIntegrity.MonetizationPolicy",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDropfallMonetizationPolicyTest::RunTest(const FString& Parameters)
{
    TestFalse(TEXT("active matches never allow ads"),
        UDropfallMonetizationSubsystem::IsAdPlacementAllowed(false, EDropfallAdContext::ActiveMatch));
    TestTrue(TEXT("free front end may offer a restrained placement"),
        UDropfallMonetizationSubsystem::IsAdPlacementAllowed(false, EDropfallAdContext::FrontEnd));
    TestFalse(TEXT("paid entitlement disables all placements"),
        UDropfallMonetizationSubsystem::IsAdPlacementAllowed(true, EDropfallAdContext::FrontEnd));
    return true;
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(FDropfallCombatTuningTest,
    "DropfallArena.Combat.DefaultTuningSanity",
    EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FDropfallCombatTuningTest::RunTest(const FString& Parameters)
{
    const FDropfallFighterTuning Tuning;
    TestTrue(TEXT("boost is faster than normal movement"),
        Tuning.BoostMaxPlanarSpeed > Tuning.MaxPlanarSpeed);
    TestTrue(TEXT("boost cooldown is positive"), Tuning.BoostCooldown > 0.0f);
    TestTrue(TEXT("movement acceleration is positive"), Tuning.MoveAcceleration > 0.0f);
    return true;
}

#endif
