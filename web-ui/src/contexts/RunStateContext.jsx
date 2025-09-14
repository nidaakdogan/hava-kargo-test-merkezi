import React, { createContext, useContext, useReducer, useCallback } from 'react';

// RunState store - tek gerçek kaynak
const initialState = {
  runState: 'idle', // 'idle' | 'running' | 'committing'
  activeRunId: null,
  lastUpdated: 0, // summary versiyonu
  webDuration: null,
  mobileDuration: null
};

// Action types
const RUN_STATE_ACTIONS = {
  START_RUN: 'START_RUN',
  SET_ALREADY_RUNNING: 'SET_ALREADY_RUNNING',
  SET_COMMITTING: 'SET_COMMITTING',
  SET_IDLE: 'SET_IDLE',
  SET_DURATIONS: 'SET_DURATIONS',
  UPDATE_LAST_UPDATED: 'UPDATE_LAST_UPDATED'
};

// Reducer
const runStateReducer = (state, action) => {
  switch (action.type) {
    case RUN_STATE_ACTIONS.START_RUN:
      return {
        ...state,
        runState: 'running',
        activeRunId: action.runId || `temp_${Date.now()}`,
        webDuration: null,
        mobileDuration: null
      };
    
    case RUN_STATE_ACTIONS.SET_ALREADY_RUNNING:
      return {
        ...state,
        runState: 'running',
        activeRunId: action.runId
      };
    
    case RUN_STATE_ACTIONS.SET_COMMITTING:
      return {
        ...state,
        runState: 'committing'
      };
    
    case RUN_STATE_ACTIONS.SET_IDLE:
      return {
        ...state,
        runState: 'idle',
        activeRunId: null,
        webDuration: null,
        mobileDuration: null
      };
    
    case RUN_STATE_ACTIONS.SET_DURATIONS:
      return {
        ...state,
        webDuration: action.webDuration,
        mobileDuration: action.mobileDuration
      };
    
    case RUN_STATE_ACTIONS.UPDATE_LAST_UPDATED:
      return {
        ...state,
        lastUpdated: action.timestamp
      };
    
    default:
      return state;
  }
};

// Context
const RunStateContext = createContext();

// Provider
export const RunStateProvider = ({ children }) => {
  const [state, dispatch] = useReducer(runStateReducer, initialState);

  // Actions
  const startRun = useCallback((runId) => {
    dispatch({ type: RUN_STATE_ACTIONS.START_RUN, runId });
  }, []);

  const setAlreadyRunning = useCallback((runId) => {
    dispatch({ type: RUN_STATE_ACTIONS.SET_ALREADY_RUNNING, runId });
  }, []);

  const setCommitting = useCallback(() => {
    dispatch({ type: RUN_STATE_ACTIONS.SET_COMMITTING });
  }, []);

  const setIdle = useCallback(() => {
    dispatch({ type: RUN_STATE_ACTIONS.SET_IDLE });
  }, []);

  const setDurations = useCallback((webDuration, mobileDuration) => {
    dispatch({ 
      type: RUN_STATE_ACTIONS.SET_DURATIONS, 
      webDuration, 
      mobileDuration 
    });
  }, []);

  const updateLastUpdated = useCallback((timestamp) => {
    dispatch({ type: RUN_STATE_ACTIONS.UPDATE_LAST_UPDATED, timestamp });
  }, []);

  const value = {
    ...state,
    startRun,
    setAlreadyRunning,
    setCommitting,
    setIdle,
    setDurations,
    updateLastUpdated
  };

  return (
    <RunStateContext.Provider value={value}>
      {children}
    </RunStateContext.Provider>
  );
};

// Hook
export const useRunState = () => {
  const context = useContext(RunStateContext);
  if (!context) {
    throw new Error('useRunState must be used within RunStateProvider');
  }
  return context;
};

export default RunStateContext;
