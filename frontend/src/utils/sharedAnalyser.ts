let analyser: AnalyserNode | null = null;

export const setSharedAnalyser = (a: AnalyserNode | null): void => {
  analyser = a;
};

export const getSharedAnalyser = (): AnalyserNode | null => analyser;
