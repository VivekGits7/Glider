# Home-manager module for Glider speech-to-text
#
# Provides a systemd user service for autostart.
# Usage: imports = [ glider.homeManagerModules.default ];
#        services.glider.enable = true;
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.glider;
in
{
  options.services.glider = {
    enable = lib.mkEnableOption "Glider speech-to-text user service";

    package = lib.mkOption {
      type = lib.types.package;
      defaultText = lib.literalExpression "glider.packages.\${system}.glider";
      description = "The Glider package to use.";
    };
  };

  config = lib.mkIf cfg.enable {
    systemd.user.services.glider = {
      Unit = {
        Description = "Glider speech-to-text";
        After = [ "graphical-session.target" ];
        PartOf = [ "graphical-session.target" ];
      };
      Service = {
        ExecStart = "${cfg.package}/bin/glider";
        Restart = "on-failure";
        RestartSec = 5;
      };
      Install.WantedBy = [ "graphical-session.target" ];
    };
  };
}
