import React from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/common/settings/useSettings";
import { Input } from "@/common/ui/Input";
import { SettingContainer } from "@/common/ui/SettingContainer";

interface HistoryLimitProps {
  grouped?: boolean;
}

export const HistoryLimit: React.FC<HistoryLimitProps> = ({
  grouped = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();

  const historyLimit = getSetting("history_limit") ?? 5;

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      updateSetting("history_limit", value);
    }
  };

  return (
    <SettingContainer
      title={t("settings.debug.historyLimit.title")}
      description={t("settings.debug.historyLimit.description")}
      grouped={grouped}
      layout="horizontal"
    >
      <div className="flex items-center space-x-2">
        <Input
          type="number"
          min="0"
          max="1000"
          value={historyLimit}
          onChange={handleChange}
          disabled={isUpdating("history_limit")}
          className="w-20"
        />
        <span className="text-sm text-text">
          {t("settings.debug.historyLimit.entries")}
        </span>
      </div>
    </SettingContainer>
  );
};
