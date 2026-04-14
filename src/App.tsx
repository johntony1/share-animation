import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShareModal } from "./ShareModal";

export default function App() {
  const [open, setOpen] = useState(true);
  const [key, setKey] = useState(0);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center font-sans select-none">
      <AnimatePresence mode="wait">
        {open && <ShareModal key={key} onClose={() => setOpen(false)} />}
      </AnimatePresence>

      {/* Re-open button — only visible after modal is closed */}
      {!open && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => { setKey((k) => k + 1); setOpen(true); }}
          className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-200 hover:bg-blue-600 active:scale-95 transition-all cursor-pointer"
        >
          Open Share dialog
        </motion.button>
      )}
    </div>
  );
}

