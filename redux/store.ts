import { configureStore } from "@reduxjs/toolkit";
import votingReducer from "@/redux/slices/votingSlice";

export const store = configureStore({
  reducer: {
    voting: votingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Contract/Provider instances live in state (web3 pattern)
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
