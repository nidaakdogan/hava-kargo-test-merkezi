import { createPortal } from "react-dom";

function RunningPill({ text, isVisible }) {
  if (!isVisible) return null;
  
  return createPortal(
    <div className="test-pill">
      {text}
    </div>,
    document.body
  );
}

export default RunningPill;
