#include "DropfallArenaHUD.h"

#include "DropfallArenaGameMode.h"
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
        ? TEXT("P1  vs  AI  •  F1: couch versus")
        : TEXT("P1  vs  P2  •  F1: versus AI");
    DrawText(Mode, FLinearColor(0.70f, 0.85f, 1.0f), CenterX - 155.0f, 82.0f, SmallFont, 1.0f);

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
}
