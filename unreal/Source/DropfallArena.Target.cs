using UnrealBuildTool;

public class DropfallArenaTarget : TargetRules
{
    public DropfallArenaTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V7;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("DropfallArena");
    }
}
