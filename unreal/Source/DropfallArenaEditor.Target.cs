using UnrealBuildTool;

public class DropfallArenaEditorTarget : TargetRules
{
    public DropfallArenaEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V7;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("DropfallArena");
    }
}
