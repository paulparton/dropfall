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

    const FString Score = FString::Printf(TEXT("%d    %d"),
        GameMode->GetPlayerOneScore(), GameMode->GetPlayerTwoScore());
    DrawText(Score, FLinearColor::White, CenterX - 68.0f, 28.0f, LargeFont, 1.5f);

    const FString Mode = GameMode->IsPlayerTwoAI()
        ? FString::Printf(TEXT("P1  vs  %s AI  •  F1: couch  •  F2: difficulty"),
            *GameMode->GetAIDifficultyName())
        : TEXT("P1  vs  P2  •  F1: versus AI");
    DrawText(Mode, FLinearColor(0.70f, 0.85f, 1.0f), CenterX - 205.0f, 82.0f, SmallFont, 1.0f);

    const ADropfallFighterPawn* PlayerOne = GameMode->GetPlayerOne();
    const ADropfallFighterPawn* PlayerTwo = GameMode->GetPlayerTwo();
    if (PlayerOne && PlayerTwo)
    {
        const float BarWidth = 170.0f;
        const float BarHeight = 10.0f;
        const float BarY = Canvas->ClipY - 84.0f;
        DrawRect(FLinearColor(0.04f, 0.12f, 0.16f, 0.9f), 38.0f, BarY, BarWidth, BarHeight);
        DrawRect(FLinearColor(0.10f, 0.95f, 1.0f), 38.0f, BarY,
            BarWidth * PlayerOne->GetBoostReadiness(), BarHeight);
        DrawRect(FLinearColor(0.16f, 0.05f, 0.06f, 0.9f), Canvas->ClipX - 208.0f,
            BarY, BarWidth, BarHeight);
        DrawRect(FLinearColor(1.0f, 0.22f, 0.30f), Canvas->ClipX - 208.0f,
            BarY, BarWidth * PlayerTwo->GetBoostReadiness(), BarHeight);
    }

    DrawText(TEXT("P1  WASD + SPACE"), FLinearColor(0.10f, 0.95f, 1.0f), 38.0f,
        Canvas->ClipY - 58.0f, SmallFont, 1.0f);
    DrawText(TEXT("P2  ARROWS + RIGHT SHIFT"), FLinearColor(1.0f, 0.22f, 0.30f),
        Canvas->ClipX - 245.0f, Canvas->ClipY - 58.0f, SmallFont, 1.0f);

    if (GameMode->GetWinnerIndex() > 0)
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
