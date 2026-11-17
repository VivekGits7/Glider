import React from "react";

import ModelSelector from "@/features/stt/footer";
import NoticeChip from "@/common/notices/NoticeChip";
import TranscriptionStatus from "@/features/stt/footer/TranscriptionStatus";
import VoiceSelector from "@/features/tts/footer/VoiceSelector";
import RewriteSelector from "@/features/llm/footer/RewriteSelector";

interface FooterProps {
  onShowHistory: () => void;
}

/** The panel's status strip: speech model, voice, rewrite model, jobs and notices. */
const Footer: React.FC<FooterProps> = ({ onShowHistory }) => (
  <footer className="g-foot">
    <div className="g-fl min-w-0">
      <ModelSelector />
      <VoiceSelector />
      <RewriteSelector />
      <TranscriptionStatus onShowHistory={onShowHistory} />
    </div>
    <div className="g-fl gap-4">
      <NoticeChip />
    </div>
  </footer>
);

export default Footer;
