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
    TestEqual(TEXT("screen up maps to camera-top arena direction"), Up, FVector2D(0.0f, -1.0f));
    TestEqual(TEXT("screen right maps to camera-right arena direction"), Right, FVector2D(-1.0f, 0.0f));
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
