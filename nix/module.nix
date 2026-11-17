# NixOS module for Glider speech-to-text
#
# Handles system-level configuration that the package wrapper cannot:
#   - udev rule for /dev/uinput (rdev grab() needs it for virtual input)
#
# Note: users must add themselves to the "input" group for evdev hotkey access.
#
# Usage in your flake:
#
#   inputs.glider.url = "github:VivekGits7/Glider?dir=app";
#
#   nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
#     modules = [
#       glider.nixosModules.default
#       { programs.glider.enable = true; }
#     ];
#   };
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.glider;
in
{
  options.programs.glider = {
    enable = lib.mkEnableOption "Glider offline speech-to-text";

    package = lib.mkOption {
      type = lib.types.package;
      defaultText = lib.literalExpression "glider.packages.\${system}.glider";
      description = "The Glider package to use.";
    };
  };

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];

    # rdev grab() creates virtual input devices via /dev/uinput.
    # Default permissions are crw------- root root — open it to the input group.
    services.udev.extraRules = ''
      KERNEL=="uinput", GROUP="input", MODE="0660"
    '';
  };
}
