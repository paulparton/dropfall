#include "DropfallArenaHUD.h"

#include "DropfallArenaGameMode.h"
#include "DropfallFighterPawn.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/Font.h"
#include "Engine/LocalPlayer.h"
#include "Engine/GameViewportClient.h"
#include "SceneView.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
const FLinearColor Ink(0.012f, 0.022f, 0.045f, 0.97f);
const FLinearColor Panel(0.027f, 0.05f, 0.085f, 0.96f);
const FLinearColor Muted(0.53f, 0.66f, 0.76f);
const FLinearColor Cyan(0.10f, 0.91f, 1.0f);
const FLinearColor Coral(1.0f, 0.26f, 0.32f);
const FLinearColor Gold(1.0f, 0.76f, 0.25f);

FString RunTime(const float Seconds)
{
    const int32 Whole = FMath::FloorToInt(Seconds);
    return FString::Printf(TEXT("%02d:%02d.%01d"), Whole / 60, Whole % 60,
        FMath::FloorToInt((Seconds - Whole) * 10.0f));
}
}

ADropfallArenaHUD::ADropfallArenaHUD()
{
    static ConstructorHelpers::FObjectFinder<UFont> FontAsset(TEXT("/Engine/EngineFonts/RobotoDistanceField.RobotoDistanceField"));
    MenuFont = FontAsset.Object;
}

void ADropfallArenaHUD::DrawHUD()
{
    Super::DrawHUD();
    const ADropfallArenaGameMode* Game = GetWorld()->GetAuthGameMode<ADropfallArenaGameMode>();
    if (!Canvas || !Game || !GEngine) return;
    APlayerController* Controller = GetOwningPlayerController();
    if (!Controller || Controller != UGameplayStatics::GetPlayerController(this, 0)) return;

    // Layout and hit targets share a fitted 1280x720 design space.
    const float Scale = FMath::Min(Canvas->ClipX / 1280.0f, Canvas->ClipY / 720.0f);
    const FVector2D Offset((Canvas->ClipX - 1280.0f * Scale) * 0.5f,
        (Canvas->ClipY - 720.0f * Scale) * 0.5f);
    UFont* Font = MenuFont ? MenuFont.Get() : GEngine->GetLargeFont();
    float FontWidth = 0.0f, FontHeight = 0.0f;
    GetTextSize(TEXT("Ag"), FontWidth, FontHeight, Font, 1.0f);
    const auto Rect = [&](float X, float Y, float W, float H, FLinearColor Color)
    {
        DrawRect(Color, Offset.X + X * Scale, Offset.Y + Y * Scale, W * Scale, H * Scale);
    };
    const auto Label = [&](const FString& Value, float X, float Y, float Size, FLinearColor Color)
    {
        DrawText(Value, Color, Offset.X + X * Scale, Offset.Y + Y * Scale,
            Font, Size * Scale / FMath::Max(FontHeight, 1.0f));
    };
    const auto Center = [&](const FString& Value, float X, float Y, float Size, FLinearColor Color)
    {
        float W, H;
        GetTextSize(Value, W, H, Font, Size / FMath::Max(FontHeight, 1.0f));
        Label(Value, X - W * 0.5f, Y, Size, Color);
    };
    const auto Button = [&](FName Name, const FString& Value, float X, float Y, float W, FLinearColor Color)
    {
        Rect(X, Y, W, 52, Color);
        Center(Value, X + W * 0.5f, Y + 15, 20, Ink);
        AddHitBox(Offset + FVector2D(X, Y) * Scale, FVector2D(W, 52) * Scale, Name, true);
    };
    FName ClickedBox;
    FVector2D ViewOrigin = FVector2D::ZeroVector;
    if (const ULocalPlayer* LocalPlayer = Controller->GetLocalPlayer())
    {
        FSceneViewProjectionData Projection;
        if (LocalPlayer->ViewportClient && LocalPlayer->GetProjectionData(LocalPlayer->ViewportClient->Viewport, Projection))
        {
            ViewOrigin = FVector2D(Projection.GetConstrainedViewRect().Min);
        }
    }
    const auto MenuHit = [&](FName Name, float X, float Y, float W, float H)
    {
        // Use the same view offset as the engine's HUD hit tests, including letterboxing.
        if (PendingMenuClick.IsSet())
        {
            const FVector2D Mouse = PendingMenuClick.GetValue() - ViewOrigin;
            const FVector2D Min = Offset + FVector2D(X, Y) * Scale;
            const FVector2D Max = Min + FVector2D(W, H) * Scale;
            if (Mouse.X >= Min.X && Mouse.X <= Max.X && Mouse.Y >= Min.Y && Mouse.Y <= Max.Y)
            {
                ClickedBox = Name;
            }
        }
    };
    const auto Board = [&]()
    {
        Rect(826, 164, 406, 436, Panel);
        Label(TEXT("LOCAL LEADERBOARD"), 852, 188, 23, FLinearColor::White);
        Label(TEXT("Complete all three opponents to place."), 852, 225, 16, Muted);
        Label(TEXT("FEWEST CONCEDED, THEN FASTEST TIME"), 852, 255, 12, Gold);
        Rect(852, 284, 354, 1, Muted.CopyWithNewOpacity(0.3f));
        const UDropfallProgressSave* Progress = Game->GetProgress();
        const TArray<FDropfallLadderRecord> Records = Progress ? Progress->GetBoard(Game->GetMap().Id, Game->IsFallAway()) : TArray<FDropfallLadderRecord>();
        for (int32 Index = 0; Index < 5; ++Index)
        {
            const float Y = 305 + Index * 46.0f;
            Label(FString::Printf(TEXT("%02d"), Index + 1), 854, Y, 19, Index == 0 ? Gold : Muted);
            if (Records.IsValidIndex(Index))
            {
                const FDropfallLadderRecord& Record = Records[Index];
                Label(FString::Printf(TEXT("%d conceded"), Record.RoundsConceded), 900, Y, 18, FLinearColor::White);
                Label(RunTime(Record.ActiveSeconds), 1110, Y, 18, Cyan);
            }
            else
            {
                Label(TEXT("Open spot"), 900, Y, 18, Muted);
                Label(TEXT("--:--"), 1120, Y, 18, Muted);
            }
        }
        Label(Game->GetMap().Name + TEXT(" / ") + Game->GetTerrainRuleName(), 852, 554, 15, Gold);
        Label(TEXT("This device / separate records per map and rule"), 852, 578, 13, Muted);
    };

    const EDropfallMatchPhase Phase = Game->GetMatchPhase();
    const bool bLadder = Game->GetPlayMode() == EDropfallPlayMode::Ladder;
    if (Phase == EDropfallMatchPhase::Ready || Phase == EDropfallMatchPhase::MatchOver)
    {
        DrawRect(Ink.CopyWithNewOpacity(0.94f), 0, 0, Canvas->ClipX, Canvas->ClipY);
        Rect(48, 43, 42, 5, Cyan);
        Label(TEXT("DROPFALL"), 48, 62, 49, FLinearColor::White);
        Label(TEXT("A R E N A"), 351, 83, 23, Cyan);
        Label(TEXT("LOCAL PLAY  /  FIRST TO THREE"), 49, 125, 15, Muted);
        Board();

        if (Phase == EDropfallMatchPhase::Ready)
        {
            const TCHAR* Names[] = { TEXT("PRACTICE"), TEXT("SOLO LADDER"), TEXT("COUCH VERSUS") };
            const TCHAR* Details[] = { TEXT("Learn your opponent"), TEXT("Three wins. One run."), TEXT("Two players. One screen.") };
            for (int32 Index = 0; Index < 3; ++Index)
            {
                const float X = 48 + Index * 252.0f;
                const bool bSelected = static_cast<int32>(Game->GetPlayMode()) == Index;
                Rect(X, 164, 236, 118, bSelected ? FLinearColor(0.055f, 0.15f, 0.20f) : Panel);
                Rect(X, 164, 236, 4, bSelected ? Cyan : Muted.CopyWithNewOpacity(0.2f));
                Label(Names[Index], X + 18, 194, 23, bSelected ? Cyan : FLinearColor::White);
                Label(Details[Index], X + 18, 240, 15, Muted);
                AddHitBox(Offset + FVector2D(X, 164) * Scale, FVector2D(236, 118) * Scale,
                    FName(*FString::Printf(TEXT("Mode%d"), Index)), true);
                MenuHit(FName(*FString::Printf(TEXT("Mode%d"), Index)), X, 164, 236, 118);
            }
            Rect(48, 300, 740, 82, Panel);
            Label(TEXT("MAP  /  ") + Game->GetMap().Name, 68, 315, 25, Cyan);
            Label(Game->GetMap().Description, 68, 350, 17, Muted);
            Label(TEXT("E / RB / click"), 602, 320, 16, Muted);
            MenuHit(TEXT("Map"), 48, 300, 740, 82);
            Rect(48, 390, 740, 75, Panel);
            Label(Game->GetTerrainRuleName(), 68, 403, 23, Gold);
            Label(Game->IsFallAway() ? TEXT("Outer falls at 30s. Middle at 50s. Final arena stays.")
                : TEXT("The entire floor stays. No collapse timer. Win by ring-out."), 68, 437, 16, Muted);
            Label(TEXT("F / LB / click"), 602, 410, 16, Muted);
            MenuHit(TEXT("Terrain"), 48, 390, 740, 75);
            if (bLadder)
            {
                Label(TEXT("ROOKIE / RIVAL / ACE  -  Win to climb; lose to restart."), 48, 491, 20, Gold);
            }
            else if (Game->IsPlayerTwoAI())
            {
                Label(TEXT("OPPONENT: ") + Game->GetAIDifficultyName() + TEXT("   /   Q / Y / click to change"), 48, 491, 20, Cyan);
                MenuHit(TEXT("Difficulty"), 48, 477, 740, 52);
            }
            else
            {
                Label(TEXT("P1: WASD + Space    /    P2: Arrows + R Shift"), 48, 491, 20, FLinearColor::White);
            }
            Button(TEXT("Confirm"), bLadder ? TEXT("START RUN") : TEXT("START MATCH"), 48, 548, 290, Cyan);
            MenuHit(TEXT("Confirm"), 48, 548, 290, 52);
            Label(TEXT("Enter / Space / gamepad A"), 364, 565, 19, Muted);
        }
        else
        {
            const FDropfallLadderRun& Run = Game->GetLadderRun();
            const bool bWon = Game->GetWinnerIndex() == 1;
            const FString Title = bLadder ? (Run.bCompleted ? TEXT("LADDER CLEARED")
                : bWon ? TEXT("NEXT CHALLENGER") : TEXT("RUN ENDED"))
                : bWon ? TEXT("CYAN WINS") : TEXT("CORAL WINS");
            Label(Title, 48, 181, 47, bWon ? Cyan : Coral);
            Label(FString::Printf(TEXT("%d : %d   /   %s"), Game->GetPlayerOneScore(),
                Game->GetPlayerTwoScore(), Game->IsPlayerTwoAI() ? *Game->GetAIDifficultyName() : TEXT("COUCH VERSUS")),
                48, 257, 31, FLinearColor::White);
            Rect(48, 326, 740, 178, Panel);
            if (bLadder)
            {
                Label(FString::Printf(TEXT("%d ROUNDS CONCEDED     /     %s"), Run.RoundsConceded, *RunTime(Run.ActiveSeconds)),
                    72, 353, 24, Gold);
                const FString Detail = Run.bCompleted
                    ? (Game->GetLadderRank() > 0 ? FString::Printf(TEXT("Local leaderboard: #%d. Take another shot at the top."), Game->GetLadderRank())
                        : TEXT("Three opponents beaten. Can you reach the top five?"))
                    : bWon ? TEXT("Keep climbing. Your time resumes with the next round.")
                        : TEXT("A fresh run begins at Rookie. Read the edge and go again.");
                Label(Detail, 72, 410, 20, FLinearColor::White);
                Label(TEXT("Only completed runs enter the leaderboard."), 72, 458, 17, Muted);
            }
            else
            {
                Label(TEXT("ONE MORE ROUND?"), 72, 353, 27, Gold);
                Label(TEXT("Rematch instantly, or return to setup to change your match."), 72, 415, 20, Muted);
            }
            Button(TEXT("Confirm"), bLadder && Run.bAwaitingAdvance ? TEXT("NEXT OPPONENT")
                : bLadder ? TEXT("NEW RUN") : TEXT("REMATCH"), 48, 548, 330, Cyan);
            Button(TEXT("Setup"), TEXT("MATCH SETUP"), 400, 548, 300, Muted);
            MenuHit(TEXT("Confirm"), 48, 548, 330, 52);
            MenuHit(TEXT("Setup"), 400, 548, 300, 52);
            Label(TEXT("Enter / gamepad A: continue     M / Start: setup"), 48, 615, 17, Muted);
        }
        Label(TEXT("MOVE  WASD / left stick    BOOST  Space / gamepad A"), 48, 664, 17, FLinearColor::White);
        if (Game->DidSaveFail())
        {
            Label(TEXT("Save failed. Records are available this session only."), 826, 624, 15, Coral);
        }
        else if (Phase == EDropfallMatchPhase::Ready)
        {
            Label(TEXT("Choose mode: Left / Right / D-pad / click"), 826, 664, 15, Muted);
        }
        PendingMenuClick.Reset();
        if (!ClickedBox.IsNone()) NotifyHitBoxClick(ClickedBox);
        return;
    }

    PendingMenuClick.Reset();

    Rect(352, 22, 576, 108, Ink.CopyWithNewOpacity(0.82f));
    Label(TEXT("CYAN"), 379, 44, 19, Cyan);
    Label(Game->IsPlayerTwoAI() ? Game->GetAIDifficultyName() : TEXT("CORAL"), 803, 44, 19, Coral);
    Center(FString::Printf(TEXT("%d  :  %d"), Game->GetPlayerOneScore(), Game->GetPlayerTwoScore()),
        640, 33, 44, FLinearColor::White);
    Center(bLadder ? FString::Printf(TEXT("SOLO LADDER  /  OPPONENT %d OF 3"), Game->GetLadderRun().Stage + 1)
        : TEXT("FIRST TO THREE"), 640, 96, 16, Muted);
    if (Phase == EDropfallMatchPhase::Playing)
    {
        const FString Timer = !Game->IsFallAway() ? TEXT("STABLE ARENA / NO COLLAPSE")
            : Game->GetRoundTimeRemaining() <= 0 ? TEXT("FINAL ARENA / CORE HOLDS")
            : FString::Printf(TEXT("%s / %02d"), Game->IsSuddenDeath() ? TEXT("RED SECTIONS FALL IN") : TEXT("NEXT DROP"),
                FMath::CeilToInt(Game->GetRoundTimeRemaining()));
        Center(Timer, 640, 146, 22, Game->IsSuddenDeath() ? Gold : FLinearColor::White);
        Center(Game->GetMap().Name, 640, 178, 14, Muted);
    }
    const ADropfallFighterPawn* Fighters[] = { Game->GetPlayerOne(), Game->GetPlayerTwo() };
    for (int32 Index = 0; Index < 2; ++Index)
    {
        if (!Fighters[Index]) continue;
        const float X = Index == 0 ? 32 : 948;
        const FLinearColor Color = Index == 0 ? Cyan : Coral;
        Rect(X, 602, 300, 84, Ink.CopyWithNewOpacity(0.85f));
        const float Ready = Fighters[Index]->GetBoostReadiness();
        Label(Ready >= 0.999f ? TEXT("BOOST READY") : TEXT("RECHARGING"), X + 18, 615, 18, Color);
        Rect(X + 18, 643, 264, 5, Muted.CopyWithNewOpacity(0.2f));
        Rect(X + 18, 643, 264 * Ready, 5, Color);
        Label(Index == 0 ? TEXT("WASD + SPACE / PAD 1") : Game->IsPlayerTwoAI()
            ? TEXT("AI OPPONENT") : TEXT("ARROWS + R SHIFT / PAD 2"), X + 18, 659, 13, Muted);
    }
    Center(bLadder ? TEXT("R: new run   /   M: abandon to setup")
        : TEXT("R: rematch   /   M: setup"), 640, 672, 15, Muted);
    if (Phase == EDropfallMatchPhase::Countdown)
    {
        const int32 Count = FMath::Max(1, FMath::CeilToInt(Game->GetCountdownRemaining()));
        Center(Count > 1 ? FString::FromInt(Count) : TEXT("DROP!"), 640, 310, 88, Gold);
    }
    else if (Phase == EDropfallMatchPhase::RoundOver)
    {
        Rect(390, 299, 500, 86, Ink.CopyWithNewOpacity(0.85f));
        Center(Game->GetLastScoringPlayer() == 0 ? TEXT("DOUBLE DROP")
            : Game->GetLastScoringPlayer() == 1 ? TEXT("CYAN SCORES") : TEXT("CORAL SCORES"),
            640, 322, 37, FLinearColor::White);
    }
}

void ADropfallArenaHUD::NotifyHitBoxClick(FName BoxName)
{
    Super::NotifyHitBoxClick(BoxName);
    ADropfallArenaGameMode* Game = GetWorld()->GetAuthGameMode<ADropfallArenaGameMode>();
    if (!Game) return;
    if (BoxName == TEXT("Confirm")) Game->ConfirmSelection();
    else if (BoxName == TEXT("Setup")) Game->ReturnToSetup();
    else if (BoxName == TEXT("Difficulty")) Game->CycleAIDifficulty();
    else if (BoxName == TEXT("Map")) Game->CycleMap();
    else if (BoxName == TEXT("Terrain")) Game->ToggleTerrainRule();
    else if (BoxName == TEXT("Mode0")) Game->SelectPlayMode(EDropfallPlayMode::Practice);
    else if (BoxName == TEXT("Mode1")) Game->SelectPlayMode(EDropfallPlayMode::Ladder);
    else if (BoxName == TEXT("Mode2")) Game->SelectPlayMode(EDropfallPlayMode::Couch);
}
