import { motion } from "motion/react";

export default function HomePage() {
  return (
    <main className="startup">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <h1>Baspaldaq</h1>
        <p>HackAlem AI Hackathon</p>
      </motion.div>
    </main>
  );
}
