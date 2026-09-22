#include "DropfallArenaHUD.h"

#include "DropfallArenaGameMode.h"
#include "DropfallFighterPawn.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"

void ADropfallArenaHUD::DrawHUD()
{
    Super::DrawHUD();

    const ADropfallArenaGameMode* GameMode = GetWorld()->GetAuthGameMode<ADropfallArenaGameMode>();
    if (!Canvas || !GameMode || !GEngine)
    {
        return;
    }

    UFont* LargeFont = GEngine->GetLargeFont();
    UFont* SmallFont = GEngine->GetSmallFont();
    const float CenterX = Canvas->ClipX * 0.5f;

    DrawRect(FLinearColor(0.01f, 0.025f, 0.06f, 0.72f), CenterX - 275.0f, 18.0f, 550.0f, 96.0f);
    DrawRect(FLinearColor(0.01f, 0.025f, 0.06f, 0.74f), 18.0f,
        Canvas->ClipY - 104.0f, 240.0f, 78.0f);
    DrawRect(FLinearColor(0.01f, 0.025f, 0.06f, 0.74f), Canvas->ClipX - 258.0f,
        Canvas->ClipY - 104.0f, 240.0f, 78.0f);

    const FString Score = FString::Printf(TEXT("%d    %d"),
        GameMode->GetPlayerOneScore(), GameMode->GetPlayerTwoScore());
    DrawText(Score, FLinearColor::White, CenterX - 68.0f, 28.0f, LargeFont, 1.5f);

    const FString Mode = GameMode->IsPlayerTwoAI()
        ? FString::Printf(TEXT("P1  vs  %s AI  •  TAB: couch  •  Q: difficulty"),
            *GameMode->GetAIDifficultyName())
        : TEXT("P1  vs  P2  •  TAB: versus AI");
    DrawText(Mode, FLinearColor(0.70f, 0.85f, 1.0f), CenterX - 205.0f, 82.0f, SmallFont, 1.0f);

    if (GameMode->IsRoundActive())
    {
        const FString Timer = GameMode->IsSuddenDeath()
            ? FString::Printf(TEXT("SUDDEN DROP  %02d"), FMath::CeilToInt(GameMode->GetRoundTimeRemaining()))
            : FString::Printf(TEXT("%02d"), FMath::CeilToInt(GameMode->GetRoundTimeRemaining()));
        DrawText(Timer, GameMode->IsSuddenDeath()
            ? FLinearColor(1.0f, 0.30f, 0.08f) : FLinearColor(0.75f, 0.86f, 1.0f),
            CenterX - (GameMode->IsSuddenDeath() ? 76.0f : 14.0f), 116.0f, SmallFont, 1.0f);
    }

    const ADropfallFighterPawn* PlayerOne = GameMode->GetPlayerOne();
    const ADropfallFighterPawn* PlayerTwo = GameMode->GetPlayerTwo();
    if (PlayerOne && PlayerTwo)
    {
        const float BarWidth = 170.0f;
        const float BarHeight = 10.0f;
        const float BarY = Canvas->ClipY - 91.0f;
        DrawRect(FLinearColor(0.04f, 0.12f, 0.16f, 0.9f), 38.0f, BarY, BarWidth, BarHeight);
        DrawRect(FLinearColor(0.10f, 0.95f, 1.0f), 38.0f, BarY,
            BarWidth * PlayerOne->GetBoostReadiness(), BarHeight);
        DrawRect(FLinearColor(0.16f, 0.05f, 0.06f, 0.9f), Canvas->ClipX - 208.0f,
            BarY, BarWidth, BarHeight);
        DrawRect(FLinearColor(1.0f, 0.22f, 0.30f), Canvas->ClipX - 208.0f,
            BarY, BarWidth * PlayerTwo->GetBoostReadiness(), BarHeight);
    }

    DrawText(TEXT("P1  WASD / STICK  +  BOOST"), FLinearColor(0.10f, 0.95f, 1.0f), 38.0f,
        Canvas->ClipY - 66.0f, SmallFont, 0.9f);
    const FString PlayerTwoStatus = GameMode->IsPlayerTwoAI()
        ? FString::Printf(TEXT("%s  WINS %d  BEST %d"), *GameMode->GetAIDifficultyName(),
            GameMode->GetAIWins(), GameMode->GetAIBestStreak())
        : TEXT("P2  ARROWS / PAD 2  +  BOOST");
    DrawText(PlayerTwoStatus,
        FLinearColor(1.0f, 0.22f, 0.30f), Canvas->ClipX - 245.0f,
        Canvas->ClipY - 66.0f, SmallFont, 0.9f);

    if (GameMode->GetMatchPhase() == EDropfallMatchPhase::Ready)
    {
        DrawRect(FLinearColor(0.01f, 0.02f, 0.05f, 0.80f), CenterX - 235.0f,
            Canvas->ClipY * 0.39f, 470.0f, 132.0f);
        DrawText(TEXT("DROPFALL ARENA"), FLinearColor(0.85f, 0.96f, 1.0f),
            CenterX - 145.0f, Canvas->ClipY * 0.41f, LargeFont, 1.35f);
        DrawText(TEXT("PRESS ENTER / SPACE / GAMEPAD A TO DROP IN"), FLinearColor(1.0f, 0.72f, 0.15f),
            CenterX - 185.0f, Canvas->ClipY * 0.50f, SmallFont, 1.0f);
    }
    else if (GameMode->GetMatchPhase() == EDropfallMatchPhase::Countdown)
    {
        const int32 Count = FMath::Max(1, FMath::CeilToInt(GameMode->GetCountdownRemaining()));
        const FString CountText = Count > 1 ? FString::FromInt(Count) : TEXT("DROP!");
        DrawText(CountText, FLinearColor(1.0f, 0.72f, 0.15f),
            CenterX - (Count > 1 ? 22.0f : 70.0f), Canvas->ClipY * 0.42f,
            LargeFont, Count > 1 ? 2.6f : 2.0f);
    }
    else if (GameMode->GetWinnerIndex() > 0)
    {
        const FString Winner = FString::Printf(TEXT("%s WINS"),
            GameMode->GetWinnerIndex() == 1 ? TEXT("CYAN") : TEXT("CORAL"));
        DrawText(Winner, FLinearColor::White, CenterX - 105.0f, Canvas->ClipY * 0.43f,
            LargeFont, 1.8f);
        DrawText(TEXT("Press R for a rematch"), FLinearColor::White, CenterX - 92.0f,
            Canvas->ClipY * 0.53f, SmallFont, 1.0f);
    }
    else if (!GameMode->IsRoundActive() && GameMode->GetLastScoringPlayer() > 0)
    {
        const FString Point = GameMode->GetLastScoringPlayer() == 1
            ? TEXT("CYAN SCORES") : TEXT("CORAL SCORES");
        DrawText(Point, FLinearColor::White, CenterX - 95.0f, Canvas->ClipY * 0.46f,
            LargeFont, 1.35f);
    }
}
