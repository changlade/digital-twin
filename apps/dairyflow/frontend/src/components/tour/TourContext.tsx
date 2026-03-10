import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { tourSteps } from "./tourSteps";

interface TourContextValue {
  isActive: boolean;
  stepIndex: number;
  totalSteps: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  goTo: (index: number) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const navigatingRef = useRef(false);

  const navigateToStep = useCallback(
    (index: number) => {
      const step = tourSteps[index];
      if (!step) return;
      navigatingRef.current = true;
      navigate(step.route);
      // Delay is handled in TourOverlay after navigation
    },
    [navigate]
  );

  const start = useCallback(() => {
    setStepIndex(0);
    setIsActive(true);
    navigateToStep(0);
  }, [navigateToStep]);

  const stop = useCallback(() => {
    setIsActive(false);
    navigatingRef.current = false;
  }, []);

  const next = useCallback(() => {
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= tourSteps.length) {
        setIsActive(false);
        return prev;
      }
      navigateToStep(next);
      return next;
    });
  }, [navigateToStep]);

  const prev = useCallback(() => {
    setStepIndex((prev) => {
      const next = Math.max(0, prev - 1);
      navigateToStep(next);
      return next;
    });
  }, [navigateToStep]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= tourSteps.length) return;
      setStepIndex(index);
      navigateToStep(index);
    },
    [navigateToStep]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") stop();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isActive, next, prev, stop]);

  return (
    <TourContext.Provider
      value={{ isActive, stepIndex, totalSteps: tourSteps.length, start, next, prev, stop, goTo }}
    >
      {children}
    </TourContext.Provider>
  );
}
