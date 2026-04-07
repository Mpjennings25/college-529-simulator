import { useState, useEffect, useRef } from 'react';
import { runSimulation } from '../lib/simulation';
import type { SimulationInputs, SimulationResults } from '../lib/types';

export function useSimulation(inputs: SimulationInputs): {
  results: SimulationResults | null;
  isRunning: boolean;
} {
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputsRef = useRef<SimulationInputs>(inputs);
  inputsRef.current = inputs;

  // JSON.stringify gives deep equality: only re-triggers when values change, not references.
  const inputsKey = JSON.stringify(inputs);

  useEffect(() => {
    setIsRunning(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const r = runSimulation(inputsRef.current);
      setResults(r);
      setIsRunning(false);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [inputsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { results, isRunning };
}
