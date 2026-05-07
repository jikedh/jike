import { motion } from "framer-motion";
import { cn } from "shared/utils/utils";

type CinematicProjectLoaderProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  fixed?: boolean;
  instant?: boolean;
};

export function CinematicProjectLoader({
  title = "正在进入项目",
  subtitle = "同步工程资产与画布视图",
  className,
  fixed = false,
  instant = false,
}: CinematicProjectLoaderProps) {
  return (
    <motion.div
      initial={instant ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{
        opacity: 0,
        scale: 1.22,
        filter: "blur(26px)",
        transition: { duration: 0.92, ease: [0.22, 1, 0.36, 1] },
      }}
      transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden bg-[#09090b] text-white will-change-transform",
        fixed ? "fixed inset-0 z-[120]" : "h-full w-full",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.42, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-[10%] -top-[20%] h-[50vw] max-h-[800px] w-[50vw] max-w-[800px] rounded-full bg-[#B43FEB] blur-[150px] mix-blend-screen"
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.18, 0.38, 0.18] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[20%] -right-[10%] h-[50vw] max-h-[800px] w-[50vw] max-w-[800px] rounded-full bg-[#2b5aed] blur-[150px] mix-blend-screen"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.12, 0.3, 0.12] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-[10%] -top-[20%] h-[50vw] max-h-[800px] w-[50vw] max-w-[800px] rounded-full bg-[#ff3366] blur-[150px] mix-blend-screen"
        />
        <motion.div
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.12, 0.3, 0.12] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-[20%] -left-[10%] h-[50vw] max-h-[800px] w-[50vw] max-w-[800px] rounded-full bg-[#00f0ff] blur-[150px] mix-blend-screen"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[5] bg-[#09090b]/42" />
      <div
        className="pointer-events-none absolute inset-0 z-[6] opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.08 }}
        transition={{ duration: 1.5 }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-[100px]"
      />

      <motion.div
        initial={
          instant
            ? { opacity: 1, scale: 1, filter: "blur(0px)" }
            : { opacity: 0, scale: 1.05, filter: "blur(20px)" }
        }
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{
          opacity: 0,
          scale: 1.34,
          filter: "blur(18px)",
          transition: { duration: 0.82, ease: [0.22, 1, 0.36, 1] },
        }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-9 px-6 text-center"
      >
        <motion.div
          className="relative flex items-center gap-4 px-2 py-1 text-white/90"
          animate={{
            filter: [
              "drop-shadow(0 0 8px rgba(255,255,255,0.35))",
              "drop-shadow(0 0 22px rgba(255,255,255,0.78))",
              "drop-shadow(0 0 8px rgba(255,255,255,0.35))",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="relative flex items-center justify-center">
            <svg
              width="44"
              height="44"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="overflow-visible"
            >
              <motion.path
                d="M20 0L22.4264 17.5736L40 20L22.4264 22.4264L20 40L17.5736 22.4264L0 20L17.5736 17.5736L20 0Z"
                fill="white"
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: "20px 20px" }}
              />
              <motion.path
                d="M32 8L33.0909 13.9091L39 15L33.0909 16.0909L32 22L30.9091 16.0909L25 15L30.9091 13.9091L32 8Z"
                fill="white"
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                style={{ transformOrigin: "32px 15px" }}
              />
              <motion.path
                d="M8 28L8.60606 31.3939L12 32L8.60606 32.6061L8 36L7.39394 32.6061L4 32L7.39394 31.3939L8 28Z"
                fill="white"
                animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.9, 0.3] }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1,
                }}
                style={{ transformOrigin: "8px 32px" }}
              />
            </svg>
            <motion.div
              className="absolute right-[-4px] top-[-4px] h-1 w-1 rounded-full bg-white blur-[1px]"
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.2,
              }}
            />
            <motion.div
              className="absolute bottom-[-2px] left-[-6px] h-1.5 w-1.5 rounded-full bg-white blur-[1px]"
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.2,
              }}
            />
          </div>
          <span className="ml-1 text-[44px] font-bold leading-none tracking-tight">
            即刻 AI
          </span>
        </motion.div>

        {title || subtitle ? (
          <div className="space-y-2">
            {title ? (
              <div className="text-[26px] font-bold tracking-normal text-white">
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div className="text-sm text-white/50">{subtitle}</div>
            ) : null}
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0.35, 1, 0.35],
            textShadow: [
              "0 0 0px rgba(255,255,255,0)",
              "0 0 10px rgba(255,255,255,0.6)",
              "0 0 0px rgba(255,255,255,0)",
            ],
          }}
          transition={{
            delay: 0.8,
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="mr-[-0.3em] text-sm font-bold uppercase tracking-[0.3em] text-white/60"
        >
          Loading ...
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
